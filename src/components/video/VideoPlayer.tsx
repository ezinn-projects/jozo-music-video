/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from "react";
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
    setPlaybackQualityRange?: (min: string, max: string) => void;
    unMute?: () => void;
    isMuted?: () => boolean;
    getVolume?: () => number;
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
    isBuffering: true,
  });

  // Debug info state
  const [debugInfo, setDebugInfo] = useState({
    quality: "",
    playerState: -1,
    isDevMode: import.meta.env.DEV || import.meta.env.MODE === "development",
    availableQualities: [] as string[],
    qualityChangeCount: 0,
    showControls: true,
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
  });

  // Handle YouTube player state changes
  const handleStateChange = useCallback(
    (event: YouTubePlayerEvent) => {
      if (!playerRef.current || !socket) return;

      const YT = (window as any).YT.PlayerState;
      console.log("YouTube State Change:", event.data);

      // Update debug state
      setDebugInfo((prev) => ({ ...prev, playerState: event.data }));

      switch (event.data) {
        case YT.BUFFERING:
          setVideoState((prev) => ({ ...prev, isBuffering: true }));
          break;
        case YT.PLAYING:
          console.log("Video is now playing");
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
              console.log("Player muted while playing, force unmuting");
              playerRef.current.unMute?.();
              playerRef.current.setVolume?.(volume);
            }
          } catch (e) {
            console.error("Error checking mute state during play:", e);
          }

          socket.emit("video_event", {
            roomId,
            event: "play",
            videoId: playerRef.current.getVideoData().video_id,
            currentTime: playerRef.current.getCurrentTime(),
          });

          // Force quality whenever video is playing
          if (
            playerRef.current.setPlaybackQuality &&
            videoState.nowPlayingData
          ) {
            playerRef.current.setPlaybackQuality("hd1080");
          }
          break;
        case YT.PAUSED:
          console.log("Video is now paused");
          setVideoState((prev) => ({ ...prev, isPaused: true }));
          socket.emit("video_event", {
            roomId,
            event: "pause",
            videoId: playerRef.current.getVideoData().video_id,
            currentTime: playerRef.current.getCurrentTime(),
          });
          break;
        case YT.ENDED:
          handleVideoEnd();
          break;
      }
    },
    [socket, roomId, videoState.nowPlayingData, handleVideoEnd, volume]
  );

  // Rotate cute messages
  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % CUTE_MESSAGES.length);
    }, 2500); // Change message every 2.5 seconds

    return () => clearInterval(intervalId);
  }, []);

  // Show/hide song title
  useEffect(() => {
    if (videoState.nowPlayingData) {
      if (videoState.isPaused) {
        // Always show when paused
        setShowTitle(true);
      } else {
        // Show when playing, then hide after 8 seconds
        setShowTitle(true);
        const timer = setTimeout(() => {
          setShowTitle(false);
        }, 8000);
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

  // Reset changing song state after timeout
  useEffect(() => {
    if (isChangingSong) {
      const timeout = setTimeout(() => {
        console.log("Timeout - force hiding loading indicator after 5 seconds");
        setIsChangingSong(false);
      }, 5000); // Giảm thời gian xuống còn 5 giây thay vì 10 giây

      return () => clearTimeout(timeout);
    }
  }, [isChangingSong]);

  // Thêm effect mới để đảm bảo khi video không đang buffer, loading bị tắt
  useEffect(() => {
    if (
      !videoState.isBuffering &&
      isChangingSong &&
      videoState.nowPlayingData
    ) {
      console.log("Video no longer buffering - hiding loading indicator");
      setIsChangingSong(false);
    }
  }, [videoState.isBuffering, isChangingSong, videoState.nowPlayingData]);

  // Handle volume changes from server
  useEffect(() => {
    if (!socket) return;

    const handleVolumeChange = (newVolume: number) => {
      setVolume(newVolume);

      // Show toast
      setVolumeToast({ show: true, value: newVolume });

      // Apply volume to YouTube player
      if (playerRef.current?.setVolume) {
        playerRef.current.setVolume(newVolume);
      }
      // Apply volume to backup video
      if (backupVideoRef.current) {
        backupVideoRef.current.volume = newVolume / 100;
      }

      // Auto-hide toast after 2 seconds
      setTimeout(() => {
        setVolumeToast((prev) => ({ ...prev, show: false }));
      }, 2000);
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
    if (videoState.nowPlayingData) {
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

  // Ref để theo dõi xem đã hiển thị powered by ở cuối video chưa
  const hasShownEndingRef = useRef(false);

  // Show "Powered by Jozo" at end of song
  useEffect(() => {
    if (!videoState.nowPlayingData || !playerRef.current) return;

    // Reset flag khi video thay đổi
    hasShownEndingRef.current = false;

    const checkEndingInterval = setInterval(() => {
      try {
        if (
          !playerRef.current ||
          !playerRef.current.getCurrentTime ||
          !playerRef.current.getDuration
        ) {
          return;
        }

        const currentTime = playerRef.current.getCurrentTime();
        const duration = playerRef.current.getDuration();

        // Kiểm tra các giá trị để tránh tính toán sai
        if (isNaN(currentTime) || isNaN(duration) || duration <= 0) {
          return;
        }

        // Chỉ hiển thị trong 10 giây cuối và chỉ khi chưa hiển thị
        if (
          duration - currentTime <= 10 &&
          !showPoweredBy &&
          !hasShownEndingRef.current
        ) {
          console.log("Showing powered by at end of song");
          hasShownEndingRef.current = true; // Đánh dấu đã hiển thị
          setShowPoweredBy(true);
        }
      } catch (error) {
        console.error("Error checking song ending time:", error);
      }
    }, 1000);

    return () => {
      clearInterval(checkEndingInterval);
    };
  }, [videoState.nowPlayingData, showPoweredBy, playerRef]);

  // Handle double tap for fullscreen toggle
  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap < 300) {
      // 300ms threshold for double tap
      if (document.fullscreenElement) {
        document
          .exitFullscreen()
          .catch((e) => console.error("Error exiting fullscreen:", e));
      } else {
        containerRef.current
          ?.requestFullscreen()
          .catch((e) => console.error("Error entering fullscreen:", e));
      }
    }
    setLastTap(now);
  }, [lastTap, containerRef]);

  // Handle YouTube player ready event
  const handleYouTubePlayerReady = useCallback(
    (event: YouTubePlayerEvent) => {
      // Force quality when player is ready
      console.log("=== FORCING MAX QUALITY ON YOUTUBE PLAYER ===");
      try {
        // Đặt chất lượng cao nhất có thể
        event.target.setPlaybackQuality("hd1080");

        // Thử cả việc thiết lập quality range
        if (event.target.setPlaybackQualityRange) {
          event.target.setPlaybackQualityRange("hd1080", "hd1080");
        }

        // Thêm một interval để liên tục kiểm tra chất lượng ngay khi player khởi động
        const startupQualityInterval = setInterval(() => {
          try {
            if (event.target.setPlaybackQuality) {
              event.target.setPlaybackQuality("hd1080");
              console.log("Startup interval: setting quality to hd1080");
            }
          } catch {
            // Ignore errors
          }
        }, 1000);

        // Chỉ kiểm tra trong 10 giây đầu
        setTimeout(() => {
          clearInterval(startupQualityInterval);
        }, 10000);

        // Đặt chất lượng ngay khi player bắt đầu phát
        setTimeout(() => {
          try {
            if (event.target.setPlaybackQuality) {
              event.target.setPlaybackQuality("hd1080");
              console.log("Delayed quality setting: hd1080");
            }
          } catch {
            // Ignore errors
          }
        }, 2000);
      } catch (e) {
        console.error("Error setting initial HD quality:", e);
      }

      // Đảm bảo unmute và đặt volume trước khi bắt đầu phát
      try {
        // QUAN TRỌNG: Đảm bảo player không bị mute
        event.target.unMute?.();
        console.log("Explicitly unmuting player during ready event");

        // Thiết lập volume
        event.target.setVolume(volume);
        console.log("Setting volume during ready event:", volume);

        // Thêm kiểm tra bổ sung sau một chút thời gian
        setTimeout(() => {
          try {
            // Kiểm tra xem player có bị mute không
            const isMuted = event.target.isMuted?.() || false;
            if (isMuted) {
              console.log("Player still muted after setup, force unmuting");
              event.target.unMute?.();
            }

            // Kiểm tra lại volume
            const currentVolume = event.target.getVolume?.() || 0;
            if (currentVolume !== volume) {
              console.log(
                `Volume incorrect: ${currentVolume}, setting to ${volume}`
              );
              event.target.setVolume(volume);
            }
          } catch (e) {
            console.error("Error during unmute validation:", e);
          }
        }, 1000);
      } catch (e) {
        console.error("Error unmuting player:", e);
      }

      try {
        event.target.playVideo();

        // Luôn ẩn loading indicator khi player đã sẵn sàng
        setIsChangingSong(false);

        // Only seek time when there's an active video
        if (videoState.nowPlayingData) {
          const currentServerTime =
            videoState.nowPlayingData.timestamp +
            (Date.now() - videoState.nowPlayingData.timestamp) / 1000;
          const targetTime =
            videoState.nowPlayingData.currentTime +
            (currentServerTime - videoState.nowPlayingData.timestamp);
          event.target.seekTo(targetTime, true);
        }
      } catch (e) {
        console.error("Error playing video:", e);

        // THAY ĐỔI: Không còn tự động mute nếu có lỗi phát video
        // Thay vào đó, cố gắng phát video nhưng giữ unmute
        try {
          event.target.playVideo();
        } catch (playError) {
          console.error("Error during fallback play:", playError);
        }

        // Still try to seek time if there's an active video
        if (videoState.nowPlayingData) {
          try {
            const currentServerTime =
              videoState.nowPlayingData.timestamp +
              (Date.now() - videoState.nowPlayingData.timestamp) / 1000;
            const targetTime =
              videoState.nowPlayingData.currentTime +
              (currentServerTime - videoState.nowPlayingData.timestamp);
            event.target.seekTo(targetTime, true);
          } catch (seekError) {
            console.error("Error seeking video:", seekError);
          }
        }
      }

      // Đảm bảo thiết lập volume và unmute
      event.target.unMute?.();
      event.target.setVolume(volume);

      socket?.emit("video_ready", {
        roomId: roomId,
        videoId: videoState.nowPlayingData?.video_id,
      });
      setVideoState((prev) => ({ ...prev, isPaused: false }));
      setIsChangingSong(false);
    },
    [videoState.nowPlayingData, volume, socket, roomId, setBackupState]
  );

  // Add a useEffect to continously ensure HD quality
  useEffect(() => {
    if (!playerRef.current || !videoState.nowPlayingData) return;

    const forceHDQuality = () => {
      try {
        if (playerRef.current && playerRef.current.setPlaybackQuality) {
          console.log("Enforcing HD quality check");
          playerRef.current.setPlaybackQuality("hd1080");
        }
      } catch (error) {
        console.error("Error enforcing HD quality:", error);
      }
    };

    // Force HD quality immediately
    forceHDQuality();

    // Then check and enforce every 2 seconds
    const intervalId = setInterval(forceHDQuality, 2000);

    return () => clearInterval(intervalId);
  }, [videoState.nowPlayingData]);

  // Add effect to monitor and log quality issues
  useEffect(() => {
    // Chỉ chạy trong chế độ development và khi có thay đổi chất lượng
    if (!debugInfo.isDevMode || !debugInfo.quality) return;

    // Ghi log chất lượng hiện tại
    console.log(
      `Current quality: ${debugInfo.quality} (changes: ${debugInfo.qualityChangeCount})`
    );

    // Chỉ cố gắng buộc chất lượng khi thấy chất lượng thấp và chưa thực hiện quá nhiều lần
    if (
      debugInfo.quality &&
      debugInfo.quality !== "hd1080" &&
      playerRef.current?.setPlaybackQuality &&
      debugInfo.qualityChangeCount < 10 // Giới hạn số lần thử
    ) {
      console.log(
        "Debug monitor: Detected non-HD quality, forcing to HD 1080p"
      );
      try {
        playerRef.current.setPlaybackQuality("hd1080");
      } catch {
        console.error("Failed to enforce quality from debug monitor");
      }
    }
  }, [debugInfo.quality, debugInfo.qualityChangeCount, debugInfo.isDevMode]);

  // Aggressively enforce HD quality - called frequently
  const enforceHDQuality = useCallback(() => {
    if (!playerRef.current?.setPlaybackQuality) return;

    try {
      // Try more aggressive quality setting methods
      playerRef.current.setPlaybackQuality("hd1080");

      // Try to get available qualities if we haven't done so
      if (
        playerRef.current.getAvailableQualityLevels &&
        (!debugInfo.availableQualities.length || debugInfo.quality !== "hd1080")
      ) {
        const qualities = playerRef.current.getAvailableQualityLevels();
        // Cẩn thận: Chỉ cập nhật state khi thực sự có sự thay đổi
        if (
          JSON.stringify(qualities) !==
          JSON.stringify(debugInfo.availableQualities)
        ) {
          console.log("Available quality levels:", qualities);
          setDebugInfo((prev) => ({ ...prev, availableQualities: qualities }));
        }
      }
    } catch {
      // Silent error - we expect some calls to fail
    }
  }, [playerRef, debugInfo.availableQualities, debugInfo.quality]);

  // Add more frequent quality enforcement
  useEffect(() => {
    // Đảm bảo chỉ chạy khi có video
    if (!videoState.nowPlayingData?.video_id || !playerRef.current) return;

    // Enforce quality immediately
    enforceHDQuality();

    // Giảm tần suất gọi để tránh useEffect quá nhiều lần
    const mainInterval = setInterval(enforceHDQuality, 2000); // 2 giây một lần

    // Thay vì nhiều timeout, chỉ sử dụng một vài thời điểm quan trọng
    const timeoutIds: NodeJS.Timeout[] = [];
    [2, 5, 10].forEach((seconds) => {
      const id = setTimeout(enforceHDQuality, seconds * 1000);
      timeoutIds.push(id);
    });

    return () => {
      clearInterval(mainInterval);
      timeoutIds.forEach((id) => clearTimeout(id));
    };
  }, [
    videoState.nowPlayingData?.video_id,
    enforceHDQuality,
    playerRef.current,
  ]);

  // Handle YouTube playback quality change
  const handlePlaybackQualityChange = useCallback(
    (event: YouTubeQualityEvent) => {
      console.log("Quality changed:", event.data);

      // Update debug info with more detail
      setDebugInfo((prev) => ({
        ...prev,
        quality: event.data,
        qualityChangeCount: prev.qualityChangeCount + 1,
      }));

      // Force quality back to HD 1080 if different
      if (
        event.data !== "hd1080" &&
        videoState.nowPlayingData &&
        event.target.setPlaybackQuality &&
        !backupState.youtubeError &&
        !backupState.isLoadingBackup &&
        !backupState.backupUrl
      ) {
        console.log("QUALITY CHANGED - FORCING BACK TO 1080p!");

        // Set it immediately
        event.target.setPlaybackQuality("hd1080");

        // And also after a short delay to make sure it sticks
        setTimeout(() => {
          try {
            if (event.target && event.target.setPlaybackQuality) {
              event.target.setPlaybackQuality("hd1080");
            }
          } catch {
            // Ignore errors
          }
        }, 200);

        // Multiple attempts with increasing delays
        [500, 1000, 2000].forEach((delay) => {
          setTimeout(() => {
            try {
              if (event.target && event.target.setPlaybackQuality) {
                console.log(
                  `Attempting to enforce HD quality after ${delay}ms`
                );
                event.target.setPlaybackQuality("hd1080");
              }
            } catch {
              // Ignore errors
            }
          }, delay);
        });

        // Also try to modify the iframe src
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
          console.error("Error updating iframe on quality change:", error);
        }
      }
    },
    [
      videoState.nowPlayingData,
      backupState.youtubeError,
      backupState.isLoadingBackup,
      backupState.backupUrl,
    ]
  );

  // Hàm này gọi trực tiếp API khi việc dùng hook không có kết quả
  const directlyGetBackupUrl = useCallback(
    async (videoId: string, roomId: string) => {
      if (!videoId || !roomId) {
        console.error("Missing videoId or roomId for direct API call");
        return;
      }

      console.log("===> EMERGENCY: Directly calling backup API <===");

      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL;
        if (!baseUrl) {
          console.error("VITE_API_BASE_URL is not defined");
          return;
        }

        const backupApiUrl = `${baseUrl}/room-music/${roomId}/${videoId}`;
        console.log("Direct API call to:", backupApiUrl);

        // Thêm param ngăn cache
        const noCache = Date.now();
        const response = await fetch(
          `${backupApiUrl}?_=${noCache}&direct=true`,
          {
            headers: {
              "Cache-Control": "no-cache",
              Pragma: "no-cache",
            },
          }
        );

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();

        if (data?.result?.url) {
          console.log("Got direct backup URL:", data.result.url);

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
      } catch (err) {
        console.error("Error in direct API call:", err);
        return null;
      }
    },
    [setBackupState]
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

  // Use effect to check for iframe error conditions
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
            } else {
              // Nếu đang phát bình thường, không làm gì cả
              console.log(
                "YouTube player is playing normally, no backup needed"
              );
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

  // Chỉ kiểm tra lỗi khi video thay đổi - KHÔNG kiểm tra liên tục
  useEffect(() => {
    // Bỏ qua nếu không có video hoặc đã ở chế độ backup
    if (
      !videoState.nowPlayingData?.video_id ||
      backupState.backupUrl ||
      backupState.isLoadingBackup ||
      backupState.youtubeError
    )
      return;

    return () => {
      // Cleanup function - không cần làm gì
    };
  }, [
    videoState.nowPlayingData?.video_id,
    backupState.youtubeError,
    backupState.backupUrl,
    backupState.isLoadingBackup,
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

  // CSS to handle YouTube iframe visibility
  useEffect(() => {
    // Tạo element style để thêm vào head
    const styleElement = document.createElement("style");

    if (backupState.backupUrl && backupState.backupVideoReady) {
      // Nếu đang hiển thị video dự phòng, thêm CSS để vô hiệu hóa hoàn toàn iframe
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

      console.log("Added CSS to completely disable YouTube iframe");
    }

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

  // Thêm đoạn code để kiểm tra âm thanh định kỳ
  useEffect(() => {
    // Chỉ kiểm tra khi có video đang phát
    if (!videoState.nowPlayingData || !playerRef.current) return;

    // Kiểm tra định kỳ trạng thái mute và volume
    const audioCheckInterval = setInterval(() => {
      try {
        if (!playerRef.current) return;

        // Kiểm tra xem player có bị mute không
        const isMuted = playerRef.current.isMuted?.() || false;
        if (isMuted) {
          console.log("Periodic check: Player is muted, unmuting");
          playerRef.current.unMute?.();
        }

        // Kiểm tra volume
        const currentVolume = playerRef.current.getVolume?.() || 0;
        if (Math.abs(currentVolume - volume) > 5) {
          console.log(
            `Periodic check: Volume incorrect ${currentVolume}, setting to ${volume}`
          );
          playerRef.current.setVolume?.(volume);
        }
      } catch {
        // Ignore errors
      }
    }, 3000); // Kiểm tra mỗi 3 giây

    return () => clearInterval(audioCheckInterval);
  }, [videoState.nowPlayingData, volume]);

  // If videos are turned off, show RecordingStudio component
  if (isVideoOff) {
    return <RecordingStudio />;
  }

  return (
    <div
      ref={containerRef}
      className="relative w-screen h-screen"
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

      {/* Debug information in development mode */}
      {debugInfo.isDevMode && (
        <div className="absolute top-20 right-4 z-50 bg-black/70 text-white p-2 rounded-md text-xs font-mono">
          <div>
            Quality:{" "}
            <span
              className={
                debugInfo.quality === "hd1080"
                  ? "text-green-400"
                  : "text-red-400"
              }
            >
              {debugInfo.quality || "unknown"}
            </span>
          </div>
          <div>Changes: {debugInfo.qualityChangeCount}</div>
          <div>State: {debugInfo.playerState}</div>
          <div>Playing: {videoState.nowPlayingData?.video_id || "none"}</div>
          <div>Backup: {backupState.backupUrl ? "yes" : "no"}</div>
          <div>Error: {backupState.youtubeError ? "yes" : "no"}</div>

          {/* Quality levels section */}
          <div>
            Available: {debugInfo?.availableQualities?.length || 0} options
          </div>
          {debugInfo?.availableQualities?.includes("hd1080") && (
            <div className="text-green-400">HD 1080p available!</div>
          )}

          {/* Debug controls */}
          <div className="mt-2 border-t border-gray-700 pt-1">
            <button
              className={`px-2 py-1 mr-1 text-[9px] rounded ${
                debugInfo.showControls ? "bg-green-700" : "bg-gray-700"
              }`}
              onClick={() =>
                setDebugInfo((prev) => ({
                  ...prev,
                  showControls: !prev.showControls,
                }))
              }
            >
              {debugInfo.showControls ? "Hide Controls" : "Show Controls"}
            </button>

            <button
              className="px-2 py-1 text-[9px] rounded bg-blue-700"
              onClick={() => {
                // Tải lại iframe với URL mới
                const iframe = document.querySelector(
                  "#youtube-player iframe"
                ) as HTMLIFrameElement;
                if (iframe) {
                  const videoId = videoState.nowPlayingData?.video_id;
                  if (videoId) {
                    // Lưu vị trí hiện tại
                    const currentTime =
                      playerRef.current?.getCurrentTime?.() || 0;

                    // Tạo URL mới với tất cả tham số buộc chất lượng cao
                    const newSrc = `https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&origin=${
                      window.location.origin
                    }&autoplay=1&rel=0&modestbranding=1&vq=hd1080&hd=1&highres=1&quality=highres&iv_load_policy=3&playsinline=1&controls=${
                      debugInfo.showControls ? 1 : 0
                    }&fs=1&showinfo=0&hl=vi&cc_load_policy=0&color=white&start=${Math.floor(
                      currentTime
                    )}`;

                    console.log("Manual reload with URL:", newSrc);
                    iframe.src = newSrc;
                  }
                }
              }}
            >
              Reload iframe
            </button>
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {isChangingSong && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-40">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-white">
            <img src={logo} alt="logo" className="w-full h-full" />
          </div>
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
            autoPlay={false}
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
          videoId={videoState.nowPlayingData?.video_id}
          onReady={handleYouTubePlayerReady}
          onStateChange={handleStateChange}
          onError={handleYouTubeError}
          onPlaybackQualityChange={handlePlaybackQualityChange}
          isFallback={!videoState.nowPlayingData?.video_id}
          fallbackVideoId={FALLBACK_VIDEO_ID}
          showControls={debugInfo.isDevMode && debugInfo.showControls}
        />
      </div>

      {/* Loading indicator khi đang tải video từ server */}
      {(backupState.isLoadingBackup ||
        (isChangingSong && videoState.isBuffering)) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-50 fade-in">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-white">
            <img src={logo} alt="logo" className="w-full h-full" />
          </div>
        </div>
      )}

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
      {videoState.isPaused && videoState.nowPlayingData && (
        <div className="absolute inset-0 backdrop-blur-sm z-[25]"></div>
      )}

      {/* Pause background gradient */}
      {videoState.isPaused && videoState.nowPlayingData && (
        <div className="absolute bottom-0 left-0 right-0 h-[250px] bg-gradient-to-t from-black via-black/80 to-transparent z-[20]"></div>
      )}

      {/* Pause overlay */}
      {videoState.isPaused && videoState.nowPlayingData && (
        <PauseOverlay nowPlayingData={videoState.nowPlayingData} />
      )}

      {/* Welcome screen when no song is playing */}
      {!videoState.nowPlayingData?.video_id && (
        <WelcomeScreen currentMessageIndex={currentMessageIndex} />
      )}

      {/* Song title display */}
      {videoState.nowPlayingData && showTitle && (
        <div className="absolute top-4 left-4 z-50 bg-black p-4 rounded-lg text-white">
          <p className="font-bold">{videoState.nowPlayingData.title}</p>
          <p className="text-sm">Jozo</p>
        </div>
      )}

      {/* Volume toast */}
      <VolumeToastComponent volumeToast={volumeToast} />

      {/* Powered by Jozo */}
      <PoweredByBadge show={showPoweredBy || !videoState.nowPlayingData} />
    </div>
  );
};

export default VideoPlayer;
