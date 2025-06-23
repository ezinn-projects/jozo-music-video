/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState, memo } from "react";
import { useSearchParams } from "react-router-dom";
import { logo } from "../../assets";
import { RecordingStudio } from "../../RecordingStudio";
import { CUTE_MESSAGES, FALLBACK_VIDEO_ID } from "./constants";
import { useBackupVideo } from "./hooks/useBackupVideo";
import { useSocketConnection } from "./hooks/useSocketConnection";
import { useVideoEvents } from "./hooks/useVideoEvents";
import PauseOverlay from "./PauseOverlay";
import {
  BackupState,
  VideoState,
  VolumeToast,
  YouTubePlayerRef,
} from "./types";
import {
  ConnectionStatusIndicator,
  NetworkStatusIndicator,
  PoweredByBadge,
  VolumeToastComponent,
} from "./UIOverlays";
import WelcomeScreen from "./WelcomeScreen";
import YouTubePlayerIframe from "./YouTubePlayerIframe";

// Tối ưu interface bằng cách chỉ giữ các methods cần thiết
interface YouTubePlayerEvent {
  data: number;
  target: {
    setPlaybackQuality: (quality: string) => void;
    playVideo: () => void;
    seekTo: (time: number, allowSeekAhead: boolean) => void;
    mute: () => void;
    setVolume: (volume: number) => void;
    getVideoData: () => { video_id: string };
    getCurrentTime: () => number;
    getDuration: () => number;
    pauseVideo?: () => void;
    unMute?: () => void;
    isMuted?: () => boolean;
    getVolume?: () => number;
    getPlayerState?: () => number;
    getAvailableQualityLevels?: () => string[];
    setPlaybackQualityRange?: (min: string, max: string) => void;
  };
}

interface YouTubeQualityEvent {
  data: string;
  target: {
    setPlaybackQuality: (quality: string) => void;
  };
}

const VideoPlayer = () => {
  const playerRef = useRef<YouTubePlayerRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [params] = useSearchParams();
  const roomId = params.get("roomId") || "";

  // State for video management
  const [videoState, setVideoState] = useState<VideoState>({
    nowPlayingData: null,
    currentVideoId: "",
    isPaused: true,
    isBuffering: false,
  });

  // Debug info state
  const [debugInfo, setDebugInfo] = useState({
    quality: "",
    playerState: -1,
    isDevMode: import.meta.env.DEV || import.meta.env.MODE === "development",
    availableQualities: [] as string[],
    qualityChangeCount: 0,
    showControls: false,
  });

  // UI states
  const [isChangingSong, setIsChangingSong] = useState(false);
  const [lastTap, setLastTap] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [volume, setVolume] = useState(100);
  const [showTitle, setShowTitle] = useState(true);
  const [volumeToast, setVolumeToast] = useState<VolumeToast>({
    show: false,
    value: 100,
  });
  const [showPoweredBy, setShowPoweredBy] = useState(true);

  // Socket connection with handler functions
  const { socket, socketStatus, isVideoOff } = useSocketConnection({
    roomId,
    onConnect: () => {
      // Request current song info when connection established
      socket?.emit("request_current_song", { roomId });
    },
    onVideosOff: () => {
      // Cleanup if needed when videos are turned off
    },
    onVideosOn: () => {
      // Reinitialize when videos are turned back on
    },
  });

  // Thêm ref để theo dõi trạng thái video
  const currentVideoRef = useRef<string | null>(null);

  // Thêm flag để theo dõi khi event được trigger bởi server
  const isServerTriggeredRef = useRef(false);

  // Khi videoState.nowPlayingData thay đổi, lưu vào ref
  useEffect(() => {
    if (videoState.nowPlayingData?.video_id) {
      currentVideoRef.current = videoState.nowPlayingData.video_id;
      if (debugInfo.isDevMode) {
        console.log("Video data updated:", videoState.nowPlayingData.video_id);
      }
    }
  }, [videoState.nowPlayingData, debugInfo.isDevMode]);

  // Thêm effect để log khi videoState thay đổi đáng kể
  useEffect(() => {
    const currentVideo = currentVideoRef.current;

    if (debugInfo.isDevMode) {
      if (!videoState.nowPlayingData && currentVideo) {
        console.log(
          "ANOMALY DETECTED: Video data was lost but currentVideoRef still exists:",
          currentVideo
        );
      }

      if (videoState.nowPlayingData?.video_id) {
        console.log(
          "Video state updated with valid data:",
          videoState.nowPlayingData.video_id
        );
      } else if (!videoState.nowPlayingData) {
        console.log("Video state nowPlayingData is null");
      }
    }
  }, [videoState.nowPlayingData, debugInfo.isDevMode]);

  // Get current videoId safely from multiple sources
  const getCurrentVideoId = useCallback(() => {
    // Ưu tiên từ nowPlayingData
    if (videoState.nowPlayingData?.video_id) {
      return videoState.nowPlayingData.video_id;
    }

    // Thử từ currentVideoId
    if (videoState.currentVideoId) {
      return videoState.currentVideoId;
    }

    // Thử từ currentVideoRef
    if (currentVideoRef.current) {
      return currentVideoRef.current;
    }

    // Thử lấy từ player
    if (playerRef.current && playerRef.current.getVideoData) {
      try {
        const videoData = playerRef.current.getVideoData();
        if (videoData && videoData.video_id) {
          return videoData.video_id;
        }
      } catch (e) {
        console.error("Error getting videoId from player:", e);
      }
    }

    // Fallback
    return videoState.currentVideoId || "";
  }, [
    videoState.nowPlayingData?.video_id,
    videoState.currentVideoId,
    playerRef,
    currentVideoRef,
  ]);

  // Handle backup video when YouTube fails
  const handleBackupVideoEnd = useCallback(() => {
    if (!socket || !videoState.nowPlayingData) return;

    // Check if video is actually near the end
    if (backupVideoRef.current) {
      const currentTime = backupVideoRef.current.currentTime;
      const duration = backupVideoRef.current.duration;

      // Only emit song_ended when current time is close to the duration
      if (duration && currentTime >= duration - 1.5) {
        socket.emit("song_ended", {
          roomId,
          videoId: videoState.nowPlayingData.video_id,
        });
      }
    }
  }, [socket, videoState.nowPlayingData, roomId]);

  // Initialize backup video handler
  const {
    backupVideoRef,
    backupState,
    setBackupState,
    handleYouTubeError: fetchBackupVideo,
    handleVideoLoaded: onBackupVideoLoaded,
    handleVideoError,
    onVideoEnd,
  } = useBackupVideo({
    videoId: getCurrentVideoId(),
    roomId,
    volume,
    socket,
    onVideoReady: () => {
      // Tắt tiếng YouTube khi video dự phòng đã sẵn sàng
      if (playerRef.current) {
        try {
          playerRef.current.mute?.();
        } catch (e) {
          console.error("Error muting YouTube player:", e);
        }
      }

      setVideoState((prev) => ({ ...prev, isPaused: false }));

      // Emit play event after backup video is ready
      if (socket && backupVideoRef.current) {
        socket.emit("video_event", {
          roomId,
          event: "play",
          videoId: getCurrentVideoId(),
          currentTime: backupVideoRef.current.currentTime || 0,
        });
      }
    },
    onVideoEnd: handleBackupVideoEnd,
  });

  // Handle video events (play, pause, seek)
  const { handleVideoEnd } = useVideoEvents({
    socket,
    roomId,
    videoState,
    setVideoState,
    setIsChangingSong,
    playerRef,
    backupVideoRef,
    handleBackupVideoEnd,
    backupState,
    setBackupState,
    onSongEnded: () => {
      // Reset currentVideoRef khi bài hát thực sự kết thúc
      currentVideoRef.current = null;
      if (debugInfo.isDevMode) {
        console.log("Song ended, resetting currentVideoRef");
      }
    },
  });

  // Thêm ref để debounce state changes
  const lastEventTimeRef = useRef(0);

  // Handle YouTube player state changes
  const handleStateChange = useCallback(
    (event: YouTubePlayerEvent) => {
      if (!playerRef.current || !socket) return;

      const YT = (window as any).YT.PlayerState;

      // Chỉ log trong dev mode
      if (debugInfo.isDevMode) {
        console.log(
          "YouTube State Change:",
          event.data,
          "Server triggered:",
          isServerTriggeredRef.current
        );
      }

      // Update debug state chỉ trong dev mode
      if (debugInfo.isDevMode) {
        setDebugInfo((prev) => ({ ...prev, playerState: event.data }));
      }

      // Thêm debouncing để tránh spam events
      const now = Date.now();

      // Skip if same event happened too recently (within 100ms)
      if (now - lastEventTimeRef.current < 100) {
        if (debugInfo.isDevMode) {
          console.log("Skipping duplicate state change event");
        }
        return;
      }
      lastEventTimeRef.current = now;

      switch (event.data) {
        case YT.BUFFERING:
          // Chỉ set isBuffering = true khi đang xem video (có nowPlayingData)
          // và không phải đang chuyển bài
          if (videoState.nowPlayingData && !isChangingSong) {
            setVideoState((prev) => ({ ...prev, isBuffering: true }));
          }
          break;
        case YT.PLAYING: {
          if (debugInfo.isDevMode) {
            console.log("Video is now playing");
          }
          // Ẩn loading indicator ngay khi video bắt đầu phát
          setIsChangingSong(false);
          setVideoState((prev) => ({
            ...prev,
            isBuffering: false,
            isPaused: false,
          }));

          // Thêm mới: Kiểm tra và đảm bảo video không bị mute khi bắt đầu phát
          try {
            const isMuted = playerRef.current.isMuted?.() || false;
            if (isMuted) {
              if (debugInfo.isDevMode) {
                console.log("Player muted while playing, force unmuting");
              }
              playerRef.current.unMute?.();
              playerRef.current.setVolume?.(volume);
            }
          } catch (e) {
            if (debugInfo.isDevMode) {
              console.error("Error checking mute state during play:", e);
            }
          }

          // CHỈ emit video_event nếu KHÔNG phải do server command
          if (!isServerTriggeredRef.current) {
            const currentTime = playerRef.current.getCurrentTime();
            const videoId = playerRef.current.getVideoData().video_id;

            if (debugInfo.isDevMode) {
              console.log(
                `Emitting play event: videoId=${videoId}, time=${currentTime}`
              );
            }

            socket.emit("video_event", {
              roomId,
              event: "play",
              videoId,
              currentTime,
            });
          } else {
            if (debugInfo.isDevMode) {
              console.log("Skipping play event emit - server triggered");
            }
          }

          // Force quality whenever video is playing
          if (
            playerRef.current.setPlaybackQuality &&
            videoState.nowPlayingData
          ) {
            playerRef.current.setPlaybackQuality("hd1080");
          }
          break;
        }
        case YT.PAUSED: {
          if (debugInfo.isDevMode) {
            console.log("Video is now paused");
          }
          setVideoState((prev) => ({ ...prev, isPaused: true }));

          // CHỈ emit video_event nếu KHÔNG phải do server command
          if (!isServerTriggeredRef.current) {
            const pauseCurrentTime = playerRef.current.getCurrentTime();
            const pauseVideoId = playerRef.current.getVideoData().video_id;

            if (debugInfo.isDevMode) {
              console.log(
                `Emitting pause event: videoId=${pauseVideoId}, time=${pauseCurrentTime}`
              );
            }

            socket.emit("video_event", {
              roomId,
              event: "pause",
              videoId: pauseVideoId,
              currentTime: pauseCurrentTime,
            });
          } else {
            if (debugInfo.isDevMode) {
              console.log("Skipping pause event emit - server triggered");
            }
          }
          break;
        }
        case YT.ENDED:
          handleVideoEnd();
          break;
      }

      // Reset server triggered flag sau khi xử lý xong
      if (isServerTriggeredRef.current) {
        setTimeout(() => {
          isServerTriggeredRef.current = false;
        }, 100);
      }
    },
    [
      socket,
      roomId,
      handleVideoEnd,
      volume,
      debugInfo.isDevMode,
      videoState.nowPlayingData,
      isChangingSong,
    ]
  );

  // Rotate cute messages
  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % CUTE_MESSAGES.length);
    }, 5000); // Tăng từ 2.5s lên 5s để giảm số lần update state

    return () => clearInterval(intervalId);
  }, []);

  // Show/hide song title
  useEffect(() => {
    if (
      videoState.nowPlayingData &&
      videoState.nowPlayingData.video_id !== FALLBACK_VIDEO_ID
    ) {
      if (videoState.isPaused) {
        // Always show when paused
        setShowTitle(true);
      } else {
        // Show when playing, then hide after 8 seconds
        setShowTitle(true);
        const timer = setTimeout(() => {
          setShowTitle(false);
        }, 10000); // Tăng từ 8s lên 10s để giảm số lần cập nhật state
        return () => clearTimeout(timer);
      }
    }
  }, [videoState.nowPlayingData, videoState.isPaused]);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Reset changing song state after timeout - tối ưu hóa
  useEffect(() => {
    if (!isChangingSong) return;

    // Một timeout duy nhất để ẩn loading indicator
    const timeout = setTimeout(() => {
      if (debugInfo.isDevMode) {
        console.log("Timeout - force hiding loading indicator after 5 seconds");
      }
      setIsChangingSong(false);
    }, 5000);

    return () => clearTimeout(timeout);
  }, [isChangingSong, debugInfo.isDevMode]);

  // Kết hợp 2 effect liên quan đến loading indicator thành 1
  useEffect(() => {
    if (
      !videoState.isBuffering &&
      isChangingSong &&
      videoState.nowPlayingData &&
      videoState.nowPlayingData.video_id !== FALLBACK_VIDEO_ID
    ) {
      if (debugInfo.isDevMode) {
        console.log("Video no longer buffering - hiding loading indicator");
      }
      setIsChangingSong(false);
    }
  }, [
    videoState.isBuffering,
    isChangingSong,
    videoState.nowPlayingData,
    debugInfo.isDevMode,
  ]);

  // Handle volume changes from server - tối ưu hóa
  useEffect(() => {
    if (!socket) return;

    const handleVolumeChange = (newVolume: number) => {
      // Gộp các thay đổi state vào một callback duy nhất nếu có thể
      setVolume(newVolume);
      setVolumeToast({ show: true, value: newVolume });

      // Apply volume to YouTube player
      if (playerRef.current?.setVolume) {
        playerRef.current.setVolume(newVolume);
      }
      // Apply volume to backup video
      if (backupVideoRef.current) {
        backupVideoRef.current.volume = newVolume / 100;
      }

      // Sử dụng một timeout duy nhất
      const hideToastTimeout = setTimeout(() => {
        setVolumeToast((prev) => ({ ...prev, show: false }));
      }, 2000);

      // Cleanup function để tránh memory leaks
      return () => clearTimeout(hideToastTimeout);
    };

    socket.on("volumeChange", handleVolumeChange);

    return () => {
      socket.off("volumeChange", handleVolumeChange);
    };
  }, [socket]);

  // Update backup video volume when volume changes
  useEffect(() => {
    if (backupVideoRef.current) {
      backupVideoRef.current.volume = volume / 100;
    }
  }, [volume]);

  // Handle "Powered by Jozo" display
  useEffect(() => {
    if (
      videoState.nowPlayingData &&
      videoState.nowPlayingData.video_id !== FALLBACK_VIDEO_ID
    ) {
      // Show at start
      setShowPoweredBy(true);

      // Hide after 6 seconds
      const hideTimer = setTimeout(() => {
        setShowPoweredBy(false);
      }, 6000);

      // Show again midway through song
      const midwayTimer = setTimeout(() => {
        setShowPoweredBy(true);

        // Hide after 3 seconds
        setTimeout(() => {
          setShowPoweredBy(false);
        }, 3000);
      }, (playerRef.current?.getDuration?.() || 0) * 500); // Around midway (50%)

      return () => {
        clearTimeout(hideTimer);
        clearTimeout(midwayTimer);
      };
    }
  }, [videoState.nowPlayingData?.video_id]);

  // Handle double tap for fullscreen toggle - tối ưu hóa để tránh memory leaks
  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    // 300ms threshold for double tap
    if (now - lastTap < 300) {
      try {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else if (containerRef.current) {
          containerRef.current.requestFullscreen();
        }
      } catch (e) {
        // Tránh ghi log nếu không cần thiết
        if (debugInfo.isDevMode) {
          console.error("Fullscreen error:", e);
        }
      }
    }
    setLastTap(now);
  }, [lastTap, containerRef, debugInfo.isDevMode]);

  // Thêm một effect đặc biệt để theo dõi currentVideoId
  useEffect(() => {
    // Khi videoState.currentVideoId được cập nhật, cũng cập nhật currentVideoRef
    if (
      videoState.currentVideoId &&
      videoState.currentVideoId !== FALLBACK_VIDEO_ID
    ) {
      currentVideoRef.current = videoState.currentVideoId;
      if (debugInfo.isDevMode) {
        console.log(
          "Updated currentVideoRef from currentVideoId:",
          videoState.currentVideoId
        );
      }
    }
  }, [videoState.currentVideoId, debugInfo.isDevMode]);

  // Điều chỉnh cách xử lý YouTubePlayerReady để sử dụng currentVideoRef khi cần
  const handleYouTubePlayerReady = useCallback(
    (event: YouTubePlayerEvent) => {
      // Kiểm tra xem có đang phát video chính hay fallback video
      const isPlayingFallback = videoState.currentVideoId === FALLBACK_VIDEO_ID;

      // Force quality when player is ready - chỉ áp dụng chất lượng cao cho video thực
      if (debugInfo.isDevMode) {
        console.log(
          `=== FORCING ${
            isPlayingFallback ? "LOWEST" : "MAX"
          } QUALITY ON YOUTUBE PLAYER ===`
        );
      }

      try {
        if (isPlayingFallback) {
          // Đặt chất lượng thấp nhất cho fallback video
          event.target.setPlaybackQuality("small");
        } else {
          // Đặt chất lượng cao nhất có thể cho video thực
          event.target.setPlaybackQuality("hd1080");

          // Thử cả việc thiết lập quality range
          if (event.target.setPlaybackQualityRange) {
            event.target.setPlaybackQualityRange("hd1080", "hd1080");
          }
        }

        // Thay thế nhiều setTimeout bằng một cái duy nhất cho kiểm tra sau khi khởi động
        setTimeout(() => {
          try {
            // QUAN TRỌNG: Kiểm tra lại chất lượng
            if (event.target.setPlaybackQuality) {
              // Áp dụng chất lượng tương ứng
              event.target.setPlaybackQuality(
                isPlayingFallback ? "small" : "hd1080"
              );
            }

            // Kiểm tra xem player có bị mute không
            const isMuted = event.target.isMuted?.() || false;
            if (isMuted) {
              if (debugInfo.isDevMode) {
                console.log("Player still muted after setup, force unmuting");
              }
              event.target.unMute?.();
            }

            // Kiểm tra lại volume
            const currentVolume = event.target.getVolume?.() || 0;
            if (currentVolume !== volume) {
              if (debugInfo.isDevMode) {
                console.log(
                  `Volume incorrect: ${currentVolume}, setting to ${volume}`
                );
              }
              event.target.setVolume(volume);
            }
          } catch (e) {
            if (debugInfo.isDevMode) {
              console.error("Error during post-setup validation:", e);
            }
          }
        }, 1000); // Giảm từ 2 giây xuống 1 giây để sync nhanh hơn
      } catch (e) {
        if (debugInfo.isDevMode) {
          console.error("Error setting initial quality:", e);
        }
      }

      // Đảm bảo unmute và đặt volume trước khi bắt đầu phát
      try {
        // QUAN TRỌNG: Đảm bảo player không bị mute
        event.target.unMute?.();
        if (debugInfo.isDevMode) {
          console.log("Explicitly unmuting player during ready event");
        }

        // Thiết lập volume
        event.target.setVolume(volume);
        if (debugInfo.isDevMode) {
          console.log("Setting volume during ready event:", volume);
        }
      } catch (e) {
        if (debugInfo.isDevMode) {
          console.error("Error unmuting player:", e);
        }
      }

      try {
        // Cải thiện tính toán thời gian sync
        if (videoState.nowPlayingData) {
          // Tính toán thời gian hiện tại chính xác hơn
          const serverTimestamp = videoState.nowPlayingData.timestamp;
          const serverCurrentTime = videoState.nowPlayingData.currentTime;
          const now = Date.now();
          const elapsedSinceServer = (now - serverTimestamp) / 1000;
          const targetTime = Math.max(
            0,
            serverCurrentTime + elapsedSinceServer
          );

          if (debugInfo.isDevMode) {
            console.log(
              `Syncing to time: ${targetTime} (server: ${serverCurrentTime}, elapsed: ${elapsedSinceServer})`
            );
          }

          event.target.seekTo(targetTime, true);
        }

        event.target.playVideo();

        // Luôn ẩn loading indicator khi player đã sẵn sàng
        setIsChangingSong(false);
      } catch (e) {
        if (debugInfo.isDevMode) {
          console.error("Error playing video:", e);
        }

        try {
          event.target.playVideo();

          // Still try to seek time if there's an active video với tính toán cải thiện
          if (videoState.nowPlayingData) {
            const serverTimestamp = videoState.nowPlayingData.timestamp;
            const serverCurrentTime = videoState.nowPlayingData.currentTime;
            const now = Date.now();
            const elapsedSinceServer = (now - serverTimestamp) / 1000;
            const targetTime = Math.max(
              0,
              serverCurrentTime + elapsedSinceServer
            );

            event.target.seekTo(targetTime, true);
          }
        } catch (combinedError) {
          if (debugInfo.isDevMode) {
            console.error("Error during fallback operations:", combinedError);
          }
        }
      }

      socket?.emit("video_ready", {
        roomId: roomId,
        videoId: videoState.nowPlayingData?.video_id || currentVideoRef.current,
      });

      // Đảm bảo không ở trạng thái paused nếu đang phát video
      setVideoState((prev) => ({ ...prev, isPaused: false }));
      setIsChangingSong(false);
    },
    [
      volume,
      socket,
      roomId,
      videoState.nowPlayingData,
      debugInfo.isDevMode,
      currentVideoRef,
      videoState.currentVideoId,
    ]
  );

  // useEffect to monitor and log quality issues - optimized
  useEffect(() => {
    // Chỉ chạy trong chế độ development và khi có thay đổi chất lượng
    if (!debugInfo.isDevMode || !debugInfo.quality) return;

    // Kiểm tra xem có đang phát fallback video hay không
    const isPlayingFallback = videoState.currentVideoId === FALLBACK_VIDEO_ID;
    if (isPlayingFallback) return; // Không cố ép chất lượng cao cho fallback video

    // Ghi log chất lượng hiện tại chỉ khi thay đổi thực sự
    if (debugInfo.qualityChangeCount <= 5) {
      console.log(
        `Current quality: ${debugInfo.quality} (changes: ${debugInfo.qualityChangeCount})`
      );
    }

    // Chỉ cố gắng buộc chất lượng khi thấy chất lượng thấp và chưa thực hiện quá nhiều lần
    if (
      debugInfo.quality &&
      debugInfo.quality !== "hd1080" &&
      playerRef.current?.setPlaybackQuality &&
      debugInfo.qualityChangeCount < 5 // Giảm giới hạn từ 10 xuống 5
    ) {
      try {
        playerRef.current.setPlaybackQuality("hd1080");
      } catch {
        // Silent fail
      }
    }
  }, [
    debugInfo.quality,
    debugInfo.qualityChangeCount,
    debugInfo.isDevMode,
    videoState.currentVideoId,
  ]);

  // Handle YouTube playback quality change
  const handlePlaybackQualityChange = useCallback(
    (event: YouTubeQualityEvent) => {
      if (debugInfo.isDevMode) {
        console.log("Quality changed:", event.data);
      }

      // Update debug info with more detail
      setDebugInfo((prev) => ({
        ...prev,
        quality: event.data,
        qualityChangeCount: prev.qualityChangeCount + 1,
      }));

      // Kiểm tra xem có đang phát fallback video hay không
      const isPlayingFallback = videoState.currentVideoId === FALLBACK_VIDEO_ID;

      if (isPlayingFallback) {
        // Nếu là fallback video và chất lượng chưa phải là "small", thì set lại
        if (event.data !== "small" && event.target.setPlaybackQuality) {
          if (debugInfo.isDevMode) {
            console.log("FALLBACK VIDEO - FORCING LOW QUALITY!");
          }
          event.target.setPlaybackQuality("small");
        }
        return; // Không cần xử lý tiếp nếu là fallback video
      }

      // Force quality back to HD 1080 if different (chỉ áp dụng cho video thực)
      if (
        event.data !== "hd1080" &&
        videoState.nowPlayingData &&
        event.target.setPlaybackQuality &&
        !backupState.youtubeError &&
        !backupState.isLoadingBackup &&
        !backupState.backupUrl
      ) {
        if (debugInfo.isDevMode) {
          console.log("QUALITY CHANGED - FORCING BACK TO 1080p!");
        }

        // Set it immediately
        event.target.setPlaybackQuality("hd1080");

        // Use a single timeout instead of multiple
        setTimeout(() => {
          try {
            if (event.target && event.target.setPlaybackQuality) {
              if (debugInfo.isDevMode) {
                console.log("Delayed quality enforcement: HD 1080p");
              }
              event.target.setPlaybackQuality("hd1080");
            }
          } catch {
            // Ignore errors
          }
        }, 1000);

        // Only modify iframe src if quality keeps failing (after several attempts)
        if (debugInfo.qualityChangeCount > 3) {
          try {
            const iframe = document.querySelector(
              "#youtube-player iframe"
            ) as HTMLIFrameElement | null;
            if (iframe) {
              let src = iframe.src;
              if (!src.includes("vq=hd1080") && !src.includes("hd=1")) {
                src += (src.includes("?") ? "&" : "?") + "vq=hd1080&hd=1";
                iframe.src = src;
              }
            }
          } catch (error) {
            if (debugInfo.isDevMode) {
              console.error("Error updating iframe on quality change:", error);
            }
          }
        }
      }
    },
    [
      setDebugInfo,
      videoState.nowPlayingData,
      backupState.youtubeError,
      backupState.isLoadingBackup,
      backupState.backupUrl,
      debugInfo.isDevMode,
      debugInfo.qualityChangeCount,
      videoState.currentVideoId,
    ]
  );

  // Hàm này gọi trực tiếp API khi việc dùng hook không có kết quả - tối ưu để giảm RAM
  const directlyGetBackupUrl = useCallback(
    async (videoId: string, roomId: string) => {
      if (!videoId || !roomId) {
        if (debugInfo.isDevMode) {
          console.error("Missing videoId or roomId for direct API call");
        }
        return;
      }

      if (debugInfo.isDevMode) {
        console.log("===> EMERGENCY: Directly calling backup API <===");
      }

      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL;
        if (!baseUrl) {
          if (debugInfo.isDevMode) {
            console.error("VITE_API_BASE_URL is not defined");
          }
          return;
        }

        const backupApiUrl = `${baseUrl}/room-music/${roomId}/${videoId}`;
        if (debugInfo.isDevMode) {
          console.log("Direct API call to:", backupApiUrl);
        }

        // Thêm param ngăn cache
        const noCache = Date.now();

        // Tạo controller để abort nếu quá thời gian
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          if (debugInfo.isDevMode) {
            console.log("Direct API call timed out, aborting");
          }
          controller.abort();
        }, 20000);

        // Thử fetch 3 lần nếu cần
        let attempt = 0;
        const maxAttempts = 3;
        let lastError = null;

        while (attempt < maxAttempts) {
          attempt++;
          try {
            if (debugInfo.isDevMode) {
              console.log(`Direct API call attempt ${attempt}/${maxAttempts}`);
            }

            const response = await fetch(
              `${backupApiUrl}?_=${noCache}&direct=true&attempt=${attempt}`,
              {
                headers: {
                  "Cache-Control": "no-cache, no-store, must-revalidate",
                  Pragma: "no-cache",
                  Expires: "0",
                },
                signal: controller.signal,
              }
            );

            // Clear timeout on success
            clearTimeout(timeoutId);

            if (!response.ok) {
              throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();

            if (data?.result?.url) {
              if (debugInfo.isDevMode) {
                console.log("Got direct backup URL:", data.result.url);
              }

              // Cập nhật state với URL mới
              setBackupState((prev) => ({
                ...prev,
                backupUrl: data.result.url,
                isLoadingBackup: false,
                youtubeError: true,
              }));

              return data.result.url;
            } else {
              throw new Error("No URL in response");
            }
          } catch (err: any) {
            lastError = err;
            if (debugInfo.isDevMode) {
              console.error(
                `Error in direct API call attempt ${attempt}:`,
                err
              );
            }

            // Nếu là lỗi abort hoặc đây là lần cuối, không cần thử lại
            if (err.name === "AbortError" || attempt >= maxAttempts) {
              break;
            }

            // Chờ 1 giây trước khi thử lại
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }

        // Nếu đến đây nghĩa là tất cả các lần thử đều thất bại
        clearTimeout(timeoutId);
        throw lastError || new Error("All API attempts failed");
      } catch (err) {
        if (debugInfo.isDevMode) {
          console.error("Error in direct API call:", err);
        }
        return null;
      }
    },
    [setBackupState, debugInfo.isDevMode]
  );

  // Use direct call to fetchBackupVideo when needed
  const triggerBackupVideo = useCallback(() => {
    // Tránh gọi lại nếu đã đang trạng thái lỗi hoặc đang tải
    if (
      backupState.youtubeError ||
      backupState.isLoadingBackup ||
      backupState.backupUrl
    ) {
      console.log("[SKIP] Already in backup mode or loading, skipping trigger");
      return;
    }

    // Lấy videoId hiện tại từ nhiều nguồn khác nhau
    let currentVideoId =
      videoState.nowPlayingData?.video_id || videoState.currentVideoId;

    // Nếu không có từ state, thử lấy từ player
    if (
      !currentVideoId &&
      playerRef.current &&
      playerRef.current.getVideoData
    ) {
      try {
        const videoData = playerRef.current.getVideoData();
        if (videoData && videoData.video_id) {
          currentVideoId = videoData.video_id;
          console.log("Got videoId from player:", currentVideoId);

          // Cập nhật videoState.currentVideoId
          setVideoState((prev) => ({
            ...prev,
            currentVideoId: videoData.video_id,
          }));
        }
      } catch (e) {
        console.error("Couldn't get videoId from player:", e);
      }
    }

    // Nếu vẫn không có videoId, không tiếp tục
    if (!currentVideoId) {
      console.error("===> ERROR: No videoId available for backup <===");
      return;
    }

    // Nếu không có roomId, không tiếp tục
    if (!roomId) {
      console.error("===> ERROR: No roomId available for backup <===");
      return;
    }

    console.log("===> YOUTUBE ERROR DETECTED! TRIGGERING BACKUP VIDEO <===");
    console.log("VideoID:", currentVideoId);
    console.log("RoomID:", roomId);

    // Đánh dấu trạng thái YouTube lỗi
    setBackupState((prev: BackupState) => ({
      ...prev,
      youtubeError: true,
      isLoadingBackup: true,
    }));

    // Gọi trực tiếp API với videoId đã kiểm tra
    fetchBackupVideo()
      .then(() => {
        console.log("Backup video fetch initiated successfully");
      })
      .catch((err) => {
        console.error("Error fetching backup:", err);

        // Cuối cùng thử gọi trực tiếp API nếu khác phương pháp không hoạt động
        directlyGetBackupUrl(currentVideoId, roomId)
          .then((url) => {
            if (url) {
              console.log("Successfully obtained backup URL directly");
            }
          })
          .catch((e) =>
            console.error("All backup URL fetch methods failed", e)
          );
      });
  }, [
    videoState.nowPlayingData?.video_id,
    videoState.currentVideoId,
    roomId,
    fetchBackupVideo,
    setBackupState,
    playerRef,
    setVideoState,
    directlyGetBackupUrl,
    backupState.youtubeError,
    backupState.isLoadingBackup,
    backupState.backupUrl,
  ]);

  // Use effect to check for iframe error conditions - optimized to reduce checks
  useEffect(() => {
    // Skip if no video playing or already in backup mode
    if (
      !videoState.nowPlayingData?.video_id ||
      backupState.backupUrl ||
      backupState.isLoadingBackup ||
      backupState.youtubeError
    ) {
      return;
    }

    let isComponentMounted = true;

    // Chờ thời gian đủ dài để youtube load xong
    // Không kiểm tra liên tục, chỉ kiểm tra một lần sau 8 giây
    const checkTimeout = setTimeout(() => {
      if (
        !isComponentMounted ||
        backupState.backupUrl ||
        backupState.isLoadingBackup ||
        backupState.youtubeError
      ) {
        return;
      }

      // Kiểm tra nếu player hoạt động bình thường
      if (playerRef.current && playerRef.current.getPlayerState) {
        try {
          const playerState = (window as any).YT?.PlayerState;
          if (playerState) {
            const state = playerRef.current.getPlayerState();
            const currentTime = playerRef.current.getCurrentTime?.() || 0;

            // Chỉ báo lỗi nếu video chưa bắt đầu phát sau thời gian dài
            if (state === -1 && currentTime < 0.5) {
              console.log(
                "YouTube player stuck in unstarted state, confirmed as error"
              );
              triggerBackupVideo();
            }
          }
        } catch (error) {
          console.error("Error checking player state:", error);
        }
      }
    }, 8000);

    return () => {
      isComponentMounted = false;
      clearTimeout(checkTimeout);
    };
  }, [
    videoState.nowPlayingData?.video_id,
    backupState.youtubeError,
    backupState.backupUrl,
    backupState.isLoadingBackup,
    triggerBackupVideo,
  ]);

  // Handle YouTube player errors
  const handleYouTubeError = useCallback(
    (event: YouTubePlayerEvent) => {
      // Ẩn loading nếu có
      setIsChangingSong(false);

      // Nếu đã ở chế độ backup, không cần thiết gọi lại
      if (
        backupState.backupUrl ||
        backupState.isLoadingBackup ||
        backupState.youtubeError
      ) {
        console.log(
          "YouTube reported error but we're already in backup mode, ignoring"
        );
        return;
      }

      console.log("YouTube Error occurred:", event.data);

      // Gọi hàm chuyển sang video backup
      triggerBackupVideo();

      // Báo cáo lỗi cho server
      socket?.emit("video_error", {
        roomId,
        videoId:
          videoState.nowPlayingData?.video_id || videoState.currentVideoId,
        errorCode: event.data,
        message: "YouTube error, switching to backup source",
      });
    },
    [
      roomId,
      videoState.nowPlayingData?.video_id,
      videoState.currentVideoId,
      socket,
      triggerBackupVideo,
      setIsChangingSong,
      backupState.backupUrl,
      backupState.isLoadingBackup,
      backupState.youtubeError,
    ]
  );

  // Thêm useEffect để xử lý xung đột giữa YouTube và backup video
  useEffect(() => {
    // Nếu đang hiển thị video dự phòng
    if (backupState.backupUrl && backupState.backupVideoReady) {
      // Ẩn và tắt tiếng YouTube
      if (playerRef.current) {
        try {
          console.log(
            "Muting and pausing YouTube player while backup is active"
          );
          // Tắt tiếng
          playerRef.current.mute?.();
          // Tạm dừng nếu có thể
          playerRef.current.pauseVideo?.();

          // Thay đổi thể hiện để ẩn iframe hoàn toàn
          const iframe = document.querySelector(
            "#youtube-player iframe"
          ) as HTMLIFrameElement;
          if (iframe) {
            iframe.style.opacity = "0";
            iframe.style.pointerEvents = "none";
            iframe.style.zIndex = "-1";
          }
        } catch (e) {
          console.error("Error handling YouTube player during backup:", e);
        }
      }
    }
  }, [backupState.backupUrl, backupState.backupVideoReady, playerRef]);

  // CSS to handle YouTube iframe visibility - optimized to reduce style element creation/removal
  useEffect(() => {
    // Chỉ tạo style element khi cần thiết
    if (!(backupState.backupUrl && backupState.backupVideoReady)) {
      return;
    }

    // Tạo element style để thêm vào head
    const styleElement = document.createElement("style");

    // Thêm CSS để vô hiệu hóa hoàn toàn iframe
    styleElement.innerHTML = `
      #youtube-player iframe {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
        height: 0 !important;
        width: 0 !important;
        position: absolute !important;
        top: -9999px !important;
        left: -9999px !important;
      }
    `;

    // Thêm vào head
    document.head.appendChild(styleElement);

    return () => {
      // Xóa style element khi unmount hoặc trạng thái thay đổi
      if (document.head.contains(styleElement)) {
        document.head.removeChild(styleElement);
      }
    };
  }, [backupState.backupUrl, backupState.backupVideoReady]);

  // Thêm cơ chế đặc biệt để xử lý các videos không cho HD 1080p
  useEffect(() => {
    // Tránh vòng lặp vô hạn: chỉ xử lý khi có thay đổi thực sự về chất lượng
    if (
      !debugInfo.quality ||
      debugInfo.quality === "hd1080" ||
      !videoState.nowPlayingData ||
      debugInfo.quality === "unknown" ||
      !playerRef.current
    ) {
      return;
    }

    // Không thực hiện quá nhiều lần
    if (debugInfo.qualityChangeCount > 10) {
      console.log("Đã thử quá nhiều lần, ngừng cố gắng đổi chất lượng");
      return;
    }

    // Nếu phát hiện chất lượng không phải HD 1080p, thử một số cách khắc phục
    console.log(
      `Phát hiện video chỉ có chất lượng ${debugInfo.quality}, thử khắc phục...`
    );

    // 1. Tìm iframe và sửa đổi trực tiếp
    const iframe = document.querySelector(
      "#youtube-player iframe"
    ) as HTMLIFrameElement | null;
    if (iframe) {
      // Xây dựng lại URL với tham số ép buộc
      const videoId = videoState.nowPlayingData.video_id;
      const timestamp = Math.floor(playerRef.current?.getCurrentTime?.() || 0);

      // Xây dựng URL mới với tất cả tham số có thể để ép chất lượng
      const forcedHDUrl = `https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&origin=${window.location.origin}&autoplay=1&rel=0&modestbranding=1&vq=hd1080&hd=1&highres=1&quality=highres&iv_load_policy=3&playsinline=1&start=${timestamp}`;

      console.log("Reloading iframe with special HD URL:", forcedHDUrl);
      iframe.src = forcedHDUrl;
    }
  }, [debugInfo.quality, debugInfo.qualityChangeCount]);

  // Thêm phương pháp mở trực tiếp video trong tab khác khi phát hiện không có 1080p
  useEffect(() => {
    // Tránh vòng lặp vô hạn, chỉ chạy khi thực sự cần thiết
    if (
      !debugInfo.isDevMode ||
      !debugInfo.quality ||
      !videoState.nowPlayingData?.video_id
    )
      return;

    // Nếu phát hiện video không thể phát ở chất lượng HD 1080p sau nhiều lần thử
    if (debugInfo.quality !== "hd1080" && debugInfo.qualityChangeCount > 3) {
      const videoId = videoState.nowPlayingData?.video_id;

      // Nếu đã thử 3 lần mà vẫn không có HD, hiển thị thông báo
      console.warn(`
        ==== KHÔNG THỂ PHÁT HD 1080P CHO VIDEO ${videoId} ====
        Chất lượng hiện tại: ${debugInfo.quality}
        Số lần thử: ${debugInfo.qualityChangeCount}
        
        YouTube có thể giới hạn chất lượng video nhúng trong iframe.
        Chất lượng có sẵn: ${JSON.stringify(debugInfo.availableQualities || [])}
      `);
    }
  }, [
    debugInfo.quality,
    debugInfo.qualityChangeCount,
    debugInfo.isDevMode,
    debugInfo.availableQualities,
    videoState.nowPlayingData?.video_id,
  ]);

  // Force hide loading indicator after 3 seconds
  useEffect(() => {
    if (isChangingSong && videoState.nowPlayingData) {
      const forceHideTimer = setTimeout(() => {
        console.log("Force hiding loading indicator after 3 seconds");
        setIsChangingSong(false);
      }, 3000);

      return () => clearTimeout(forceHideTimer);
    }
  }, [isChangingSong, videoState.nowPlayingData]);

  // Khai báo hasShownEndingRef
  const hasShownEndingRef = useRef(false);

  // Kết hợp các interval riêng lẻ thành một interval đa nhiệm
  useEffect(() => {
    // Chỉ chạy khi có video đang phát và không phải là fallback video
    if (
      !videoState.nowPlayingData?.video_id ||
      videoState.nowPlayingData.video_id === FALLBACK_VIDEO_ID
    )
      return;

    // Chỉ log trong development mode
    if (debugInfo.isDevMode) {
      console.log(
        "Setting up combined interval checks for video:",
        videoState.nowPlayingData.video_id
      );
    }

    // Tạo một interval đa chức năng thực hiện nhiều kiểm tra
    const combinedInterval = setInterval(() => {
      if (!playerRef.current) return;

      // 1. Kiểm tra và ép chất lượng HD - giảm tần suất kiểm tra
      if (Math.random() < 0.2) {
        // Giảm từ 30% xuống 20% thời gian
        try {
          playerRef.current.setPlaybackQuality?.("hd1080");

          // Kiểm tra và log các chất lượng có sẵn (giới hạn tần suất cập nhật)
          if (
            playerRef.current.getAvailableQualityLevels &&
            Math.random() < 0.2 &&
            debugInfo.isDevMode
          ) {
            // Giảm từ 30% xuống 20% lần kiểm tra
            const qualities = playerRef.current.getAvailableQualityLevels();
            if (
              JSON.stringify(qualities) !==
              JSON.stringify(debugInfo.availableQualities)
            ) {
              console.log("Available quality levels:", qualities);
              setDebugInfo((prev) => ({
                ...prev,
                availableQualities: qualities,
              }));
            }
          }
        } catch {
          // Ignore quality errors
        }
      }

      // 2. Kiểm tra âm thanh và sửa nếu cần - giảm tần suất kiểm tra
      if (Math.random() < 0.3) {
        // Giảm từ 50% xuống 30% thời gian
        try {
          // Kiểm tra mute
          const isMuted = playerRef.current.isMuted?.() || false;
          if (isMuted) {
            if (debugInfo.isDevMode) {
              console.log("Combined check: Player is muted, unmuting");
            }
            playerRef.current.unMute?.();
          }

          // Kiểm tra volume
          const currentVolume = playerRef.current.getVolume?.() || 0;
          if (Math.abs(currentVolume - volume) > 5) {
            if (debugInfo.isDevMode) {
              console.log(
                `Combined check: Volume incorrect ${currentVolume}, setting to ${volume}`
              );
            }
            playerRef.current.setVolume?.(volume);
          }
        } catch {
          // Ignore audio errors
        }
      }

      // 3. Kiểm tra video kết thúc hiển thị powered by (thay thế interval cũ)
      try {
        if (
          playerRef.current.getCurrentTime &&
          playerRef.current.getDuration &&
          !hasShownEndingRef.current
        ) {
          const currentTime = playerRef.current.getCurrentTime();
          const duration = playerRef.current.getDuration();

          // Kiểm tra các giá trị để tránh tính toán sai
          if (!isNaN(currentTime) && !isNaN(duration) && duration > 0) {
            // Chỉ hiển thị trong 10 giây cuối và chỉ khi chưa hiển thị
            if (
              duration - currentTime <= 10 &&
              !showPoweredBy &&
              !hasShownEndingRef.current
            ) {
              if (debugInfo.isDevMode) {
                console.log(
                  "Combined check: Showing powered by at end of song"
                );
              }
              hasShownEndingRef.current = true; // Đánh dấu đã hiển thị
              setShowPoweredBy(true);
            }
          }
        }
      } catch {
        // Ignore errors
      }
    }, 8000); // Tăng từ 5 giây lên 8 giây để giảm số lần thực thi

    return () => {
      if (debugInfo.isDevMode) {
        console.log(
          "Clearing combined interval for video:",
          videoState.nowPlayingData?.video_id
        );
      }
      clearInterval(combinedInterval);
    };
  }, [
    videoState.nowPlayingData?.video_id,
    volume,
    showPoweredBy,
    debugInfo.isDevMode,
  ]);

  // Sửa lại logic để hiển thị backup screen khi video data bị mất
  // nhưng vẫn đang trong quá trình phát
  const BackupVideoMissingDataScreen = () => (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-40">
      <div className="text-white text-center">
        <div className="rounded-full h-16 w-16 border-t-4 border-white mx-auto mb-4">
          <img src={logo} alt="logo" className="w-full h-full" />
        </div>
        <p className="text-xl">Đang tải video...</p>
      </div>
    </div>
  );

  // Thêm một effect để khôi phục trạng thái video khi bị mất
  useEffect(() => {
    // Nếu video data bị mất nhưng ref vẫn còn, yêu cầu server gửi lại thông tin bài hát
    if (!videoState.nowPlayingData && currentVideoRef.current && socket) {
      if (debugInfo.isDevMode) {
        console.log("Requesting current song info due to data loss");
      }

      // Hiển thị loading
      setIsChangingSong(true);

      // Yêu cầu server gửi lại thông tin bài hát hiện tại
      socket.emit("request_current_song", { roomId });

      // Tự động giải quyết sau 5 giây nếu server không phản hồi
      const recoveryTimeout = setTimeout(() => {
        // Vẫn chưa có dữ liệu sau 5 giây
        if (!videoState.nowPlayingData && currentVideoRef.current) {
          if (debugInfo.isDevMode) {
            console.log("Recovery timeout reached, clearing reference");
          }
          // Nếu server không phản hồi, xóa reference để hiển thị welcome screen
          currentVideoRef.current = null;
          setIsChangingSong(false);
        }
      }, 5000);

      return () => clearTimeout(recoveryTimeout);
    }
  }, [videoState.nowPlayingData, socket, roomId, debugInfo.isDevMode]);

  // Handle play song and video events
  useEffect(() => {
    if (!socket) return;

    // Xử lý khi nhận bài hát mới từ server
    const handlePlaySong = (data: any) => {
      if (debugInfo.isDevMode) {
        console.log("Received play_song event:", data);
      }

      // Cập nhật currentVideoRef khi có bài hát mới
      if (data?.video_id) {
        currentVideoRef.current = data.video_id;
      }
    };

    // Lắng nghe sự kiện play_song
    socket.on("play_song", handlePlaySong);

    return () => {
      socket.off("play_song", handlePlaySong);
    };
  }, [socket, debugInfo.isDevMode]);

  // Thêm xử lý cho current_song
  useEffect(() => {
    if (!socket) return;

    // Xử lý khi nhận thông tin bài hát hiện tại
    const handleCurrentSong = (data: any) => {
      if (debugInfo.isDevMode) {
        console.log("Received current_song event:", data);
      }

      // Cập nhật currentVideoRef khi có thông tin bài hát hiện tại
      if (data?.video_id) {
        currentVideoRef.current = data.video_id;
      }
    };

    // Lắng nghe sự kiện current_song
    socket.on("current_song", handleCurrentSong);

    return () => {
      socket.off("current_song", handleCurrentSong);
    };
  }, [socket, debugInfo.isDevMode]);
  // Xử lý khi danh sách phát bị xóa
  useEffect(() => {
    if (!socket) return;

    const handleNowPlayingCleared = () => {
      if (debugInfo.isDevMode) {
        console.log("Received now_playing_cleared event");
      }

      // Reset currentVideoRef khi danh sách phát bị xóa
      currentVideoRef.current = null;
    };

    socket.on("now_playing_cleared", handleNowPlayingCleared);

    return () => {
      socket.off("now_playing_cleared", handleNowPlayingCleared);
    };
  }, [socket, debugInfo.isDevMode]);

  // Thêm effect để tự động reset trạng thái lỗi YouTube sau một khoảng thời gian
  // nếu không thể tải backup video
  useEffect(() => {
    // Chỉ áp dụng khi có lỗi YouTube nhưng không có URL backup và không còn đang tải
    if (
      backupState.youtubeError &&
      !backupState.backupUrl &&
      !backupState.isLoadingBackup
    ) {
      // Tạo timeout để tự động thử lại sau 30 giây
      const resetTimeout = setTimeout(() => {
        if (debugInfo.isDevMode) {
          console.log("Auto resetting YouTube error state after timeout");
        }

        // Reset trạng thái lỗi để cho phép YouTube thử lại
        setBackupState((prev) => ({
          ...prev,
          youtubeError: false,
          backupError: false,
        }));

        // Thử tải lại trang nếu vẫn ở trong trang
        if (
          videoState.nowPlayingData?.video_id &&
          roomId &&
          socket?.connected
        ) {
          socket.emit("request_current_song", { roomId });
        }
      }, 30000); // 30 giây

      return () => clearTimeout(resetTimeout);
    }
  }, [
    backupState.youtubeError,
    backupState.backupUrl,
    backupState.isLoadingBackup,
    debugInfo.isDevMode,
    videoState.nowPlayingData?.video_id,
    roomId,
    socket,
    setBackupState,
  ]);

  // If videos are turned off, show RecordingStudio component
  if (isVideoOff) {
    return <RecordingStudio />;
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-screen h-screen ${
        videoState.currentVideoId === FALLBACK_VIDEO_ID ||
        videoState.nowPlayingData?.video_id === FALLBACK_VIDEO_ID ||
        (!videoState.nowPlayingData?.video_id && !currentVideoRef.current)
          ? "fallback-audio-only"
          : ""
      }`}
      onClick={handleDoubleTap}
    >
      {/* CSS to hide YouTube controls and improve transitions */}
      <style>
        {`
          /* Hide all YouTube controls and information */
          .ytp-chrome-top,
          .ytp-chrome-bottom,
          .ytp-gradient-top,
          .ytp-gradient-bottom,
          .ytp-pause-overlay,
          .ytp-share-button,
          .ytp-watch-later-button,
          .ytp-watermark,
          .ytp-youtube-button,
          .ytp-progress-bar-container,
          .ytp-time-display,
          .ytp-volume-panel,
          .ytp-menuitem,
          .ytp-spinner,
          .ytp-contextmenu,
          .ytp-ce-element,
          .ytp-ce-covering-overlay,
          .ytp-ce-element-shadow,
          .ytp-ce-covering-image,
          .ytp-ce-expanding-image,
          .ytp-ce-rendered-image,
          .ytp-endscreen-content,
          .ytp-suggested-video-overlay,
          .ytp-pause-overlay-container,
          /* New classes to hide suggested videos */
          .ytp-endscreen-previous,
          .ytp-endscreen-next,
          .ytp-player-content,
          .html5-endscreen,
          .ytp-player-content videowall-endscreen,
          .ytp-show-tiles .ytp-videowall-still,
          .ytp-endscreen-content {
            display: none !important;
            opacity: 0 !important;
            visibility: hidden !important;
            pointer-events: none !important;
          }

          /* Hide YouTube error screen completely */
          .ytp-error,
          .ytp-error-content-wrap,
          .ytp-error-content-wrap-reason,
          .ytp-error-content {
            display: none !important;
            opacity: 0 !important;
            visibility: hidden !important;
          }

          /* Hide iframe when there's an error */
          #youtube-player iframe {
            opacity: 0 !important;
            pointer-events: none !important;
            z-index: -1 !important;
          }
          
          /* Force hide YouTube error overlay */
          .html5-video-player.ytp-error-content-visible .html5-video-container {
            display: none !important;
          }

          /* Hide fallback video visually but keep audio */
          .fallback-audio-only #youtube-player,
          .fallback-audio-only #youtube-player iframe,
          .fallback-audio-only #youtube-player div {
            width: 1px !important;
            height: 1px !important;
            opacity: 0 !important;
            position: absolute !important;
            top: -9999px !important;
            left: -9999px !important;
            overflow: hidden !important;
            visibility: hidden !important;
            pointer-events: none !important;
          }

          /* Smooth transitions */
          .video-transition {
            transition: opacity 0.8s ease-in-out !important;
          }
        `}
      </style>

      {/* Status indicators */}
      <NetworkStatusIndicator isOnline={isOnline} />
      <ConnectionStatusIndicator
        connected={socketStatus.connected}
        connectionAttempts={socketStatus.connectionAttempts}
      />

      {/* Debug panel temporarily removed to fix white screen issue */}

      {/* Simple debug panel - safe version */}
      {debugInfo.isDevMode && (
        <div className="absolute top-4 right-4 z-50 bg-black/90 text-white p-3 rounded-lg text-xs font-mono max-w-xs">
          <div className="flex justify-between items-center mb-2">
            <span className="font-bold">Debug</span>
            <button
              className="px-2 py-1 text-[10px] rounded bg-gray-600 hover:bg-gray-500"
              onClick={() => {
                setDebugInfo((prev) => ({
                  ...prev,
                  showControls: !prev.showControls,
                }));
              }}
            >
              {debugInfo.showControls ? "Hide" : "Show"}
            </button>
          </div>

          {debugInfo.showControls && (
            <div className="space-y-1">
              <div>State: {videoState.isPaused ? "PAUSED" : "PLAYING"}</div>
              <div>
                Video:{" "}
                {videoState.nowPlayingData?.video_id?.slice(-8) || "none"}
              </div>
              <div>Backup: {backupState.backupUrl ? "ACTIVE" : "OFF"}</div>
              <div>Quality: {debugInfo.quality || "unknown"}</div>
              <div>Buffer: {videoState.isBuffering ? "YES" : "NO"}</div>
              <div>Socket: {socketStatus.connected ? "ON" : "OFF"}</div>
            </div>
          )}
        </div>
      )}

      {/* Unified Loading indicator */}
      {(backupState.isLoadingBackup || isChangingSong) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-50 fade-in">
          <div className="rounded-full h-16 w-16 border-t-4 border-white mx-auto mb-4">
            <img src={logo} alt="logo" className="w-full h-full" />
          </div>
          <p className="text-white">Đang tải video...</p>
        </div>
      )}

      {/* Backup video */}
      <div
        className={`absolute inset-0 w-full h-full z-10 video-transition ${
          backupState.backupUrl && backupState.backupVideoReady
            ? "opacity-100"
            : "opacity-0"
        }`}
      >
        {backupState.backupUrl && (
          <video
            ref={backupVideoRef}
            key={backupState.backupUrl}
            className="absolute inset-0 w-full h-full object-contain"
            autoPlay={true}
            playsInline
            controls={false}
            disablePictureInPicture
            controlsList="nodownload noplaybackrate nofullscreen"
            onLoadedData={onBackupVideoLoaded}
            onEnded={onVideoEnd}
            onError={handleVideoError}
            preload="auto"
            muted={volume === 0}
            style={{
              objectFit: "contain",
              width: "100%",
              height: "100%",
              backgroundColor: "#000",
            }}
          >
            <source src={backupState.backupUrl} type="video/mp4" />
            <source src={backupState.backupUrl} type="video/webm" />
            <source src={backupState.backupUrl} type="video/ogg" />
          </video>
        )}
      </div>

      {/* YouTube iframe - CHỈ hiển thị khi không có backup video */}
      <div
        className={`absolute top-0 left-0 w-full h-full video-transition z-5 ${
          backupState.backupUrl && backupState.backupVideoReady
            ? "opacity-0 pointer-events-none hidden"
            : backupState.youtubeError
            ? "opacity-0 pointer-events-none hidden"
            : "opacity-100"
        }`}
      >
        <YouTubePlayerIframe
          playerRef={playerRef}
          videoId={
            videoState.nowPlayingData?.video_id ||
            currentVideoRef.current ||
            FALLBACK_VIDEO_ID
          }
          onReady={handleYouTubePlayerReady}
          onStateChange={handleStateChange}
          onError={handleYouTubeError}
          onPlaybackQualityChange={handlePlaybackQualityChange}
          isFallback={
            !videoState.nowPlayingData?.video_id && !currentVideoRef.current
          }
          fallbackVideoId={FALLBACK_VIDEO_ID}
          showControls={debugInfo.isDevMode && debugInfo.showControls}
        />
      </div>

      {/* Youtube overlay to prevent user from seeing any error screen */}
      {backupState.youtubeError && !backupState.backupVideoReady && (
        <div className="absolute inset-0 bg-black z-40"></div>
      )}

      {/* CSS cho animation fade-in */}
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          .fade-in {
            animation: fadeIn 0.3s ease-in;
          }
        `}
      </style>

      {/* Jozo Logo */}
      <div className="absolute z-30 top-[15px] right-[15px] w-[140px] h-[50px] bg-black">
        <img src={logo} alt="logo" className="w-full h-full" />
      </div>

      {/* Pause backdrop blur */}
      {videoState.isPaused &&
        videoState.nowPlayingData &&
        videoState.nowPlayingData.video_id !== FALLBACK_VIDEO_ID && (
          <div className="absolute inset-0 backdrop-blur-sm z-[25]"></div>
        )}

      {/* Pause background gradient */}
      {videoState.isPaused &&
        videoState.nowPlayingData &&
        videoState.nowPlayingData.video_id !== FALLBACK_VIDEO_ID && (
          <div className="absolute bottom-0 left-0 right-0 h-[250px] bg-gradient-to-t from-black via-black/80 to-transparent z-[20]"></div>
        )}

      {/* Pause overlay */}
      {videoState.isPaused &&
        videoState.nowPlayingData &&
        videoState.nowPlayingData.video_id !== FALLBACK_VIDEO_ID && (
          <PauseOverlay nowPlayingData={videoState.nowPlayingData} />
        )}

      {/* Welcome screen when no song is playing */}
      {(!videoState.nowPlayingData?.video_id && !currentVideoRef.current) ||
      videoState.currentVideoId === FALLBACK_VIDEO_ID ||
      videoState.nowPlayingData?.video_id === FALLBACK_VIDEO_ID ? (
        <WelcomeScreen currentMessageIndex={currentMessageIndex} />
      ) : !videoState.nowPlayingData?.video_id && currentVideoRef.current ? (
        <BackupVideoMissingDataScreen />
      ) : null}

      {/* Song title display */}
      {videoState.nowPlayingData &&
        showTitle &&
        videoState.nowPlayingData.video_id !== FALLBACK_VIDEO_ID && (
          <div className="absolute top-4 left-4 z-50 bg-black p-4 rounded-lg text-white">
            <p className="font-bold">{videoState.nowPlayingData.title}</p>
            <p className="text-sm">Jozo</p>
          </div>
        )}

      {/* Volume toast */}
      <VolumeToastComponent volumeToast={volumeToast} />

      {/* Powered by Jozo */}
      <PoweredByBadge
        show={
          showPoweredBy ||
          !videoState.nowPlayingData ||
          videoState.nowPlayingData?.video_id === FALLBACK_VIDEO_ID
        }
      />

      {/* Thông báo lỗi/khôi phục khi cả backup và youtube đều lỗi */}
      {backupState.youtubeError &&
        !backupState.backupVideoReady &&
        !backupState.isLoadingBackup &&
        backupState.backupError &&
        !debugInfo.isDevMode && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-50">
            <div className="rounded-full h-16 w-16 border-t-4 border-white">
              <img src={logo} alt="logo" className="w-full h-full" />
            </div>
            <p className="text-white mt-5 text-center max-w-md">
              Video không khả dụng! Vui lòng thử lại sau.
            </p>
          </div>
        )}

      {/* Loading indicator khi đang tải backup video */}
      {backupState.youtubeError &&
        !backupState.backupVideoReady &&
        backupState.isLoadingBackup &&
        !debugInfo.isDevMode && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-50">
            <div className="rounded-full h-16 w-16 border-t-4 border-white">
              <img src={logo} alt="logo" className="w-full h-full" />
            </div>
            <p className="text-white mt-5 text-center max-w-md">
              Đang tải video...
            </p>
          </div>
        )}
    </div>
  );
};

// Export a memoized version of the component to prevent unnecessary re-renders
export default memo(VideoPlayer);
