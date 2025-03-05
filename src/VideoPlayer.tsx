/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import io, { Socket } from "socket.io-client";
import { logo } from "./assets";

interface NowPlayingData {
  video_id: string;
  title: string;
  thumbnail: string;
  author: string;
  duration: number;
  timestamp: number;
  currentTime: number;
}

// Cập nhật interface cho events
interface VideoEvent {
  event: "play" | "pause" | "seek";
  videoId: string;
  currentTime: number;
}

interface PlaySongEvent {
  video_id: string;
  title: string;
  thumbnail: string;
  author: string;
  duration: number;
  currentTime: number;
  timestamp: number;
}

const YouTubePlayer = () => {
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const backupVideoRef = useRef<HTMLVideoElement>(null);
  const [socket, setSocket] = useState<typeof Socket | null>(null);
  const [params] = useSearchParams();
  const roomId = params.get("roomId") || "";

  // Gộp các state liên quan đến video hiện tại vào một object
  const [videoState, setVideoState] = useState({
    nowPlayingData: null as NowPlayingData | null,
    currentVideoId: "",
    isPaused: true,
    isBuffering: true,
  });

  // Gộp các state liên quan đến backup vào một object
  const [backupState, setBackupState] = useState({
    backupUrl: "",
    isLoadingBackup: false,
    backupError: false,
    backupVideoReady: false,
    youtubeError: false,
  });

  console.log("videoState", videoState);
  console.log("backupState", backupState);

  // Thêm state mới
  const [isChangingSong, setIsChangingSong] = useState(false);

  const [lastTap, setLastTap] = useState(0);

  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Thêm constant cho fallback video ID
  const FALLBACK_VIDEO_ID = "gwI_TfRS9iU";

  const cuteMessages = [
    "Jozo có xịn không nào? Chọn bài đi bạn ơi! 🎵",
    "Jozo cute phô mai que, chọn bài đi nè! 🧀",
    "Ê ơi, Jozo đang chờ bạn chọn bài nè! 👀",
    "Jozo nhảy cho coi nè, mau chọn bài đi! 💃",
    "Jozo xinh chưa? Chọn bài hay hay đi nào! ✨",
    "Jozo đáng yêu không? Chọn bài quẩy thôi! 🎶",
    "Jozo đang buồn vì bạn chưa chọn bài huhu 🥺",
    "Jozo muốn nghe nhạc quá à, chọn bài đi! 🎧",
    "Cùng Jozo quẩy nhạc nào các bạn ơi! 🎉",
    "Jozo thích nhạc hay lắm nha, chọn liền đi! 🌟",
    "Jozo đang chờ bạn chọn bài hay nè! 🎸",
    "Jozo muốn quẩy cùng bạn, chọn bài thôi! 🎪",
    "Ơi ơi, Jozo đợi bạn chọn bài nãy giờ! 💫",
    "Jozo thích bạn chọn bài cực kỳ! 💝",
  ];

  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % cuteMessages.length);
    }, 2500); // Đổi message nhanh hơn, mỗi 2.5 giây

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const socketInstance = io(import.meta.env.VITE_SOCKET_URL || "", {
      query: { roomId },
    });
    setSocket(socketInstance);
    return () => {
      socketInstance.disconnect();
    };
  }, [roomId]);

  useEffect(() => {
    if (!socket) return;

    // Xử lý play_song event
    const handlePlaySong = (data: PlaySongEvent) => {
      console.log("Received play song:", data);
      setIsChangingSong(true);

      setVideoState((prev) => ({
        ...prev,
        nowPlayingData: {
          ...data,
          currentTime: 0, // Reset currentTime khi nhận bài mới
        },
        currentVideoId: data.video_id,
        isBuffering: true,
        isPaused: false,
      }));

      // Reset backup states
      setBackupState({
        backupUrl: "",
        isLoadingBackup: false,
        backupError: false,
        backupVideoReady: false,
        youtubeError: false,
      });

      if (playerRef.current?.loadVideoById) {
        playerRef.current.loadVideoById({
          videoId: data.video_id,
          startSeconds: 0, // Bắt đầu từ đầu
        });
      }
    };

    // Xử lý playback_event
    const handlePlaybackEvent = (data: VideoEvent) => {
      console.log("Received playback event:", data);

      // Xử lý cho backup video
      if (backupState.backupUrl && backupVideoRef.current) {
        switch (data.event) {
          case "play":
            console.log("Playing backup video");
            backupVideoRef.current.currentTime = data.currentTime;
            backupVideoRef.current.play().then(() => {
              setVideoState((prev) => ({ ...prev, isPaused: false }));
            });
            break;
          case "pause":
            console.log("Pausing backup video");
            backupVideoRef.current.pause();
            setVideoState((prev) => ({ ...prev, isPaused: true }));
            break;
          case "seek":
            backupVideoRef.current.currentTime = data.currentTime;
            break;
        }
        return;
      }

      // Xử lý cho YouTube player
      if (playerRef.current) {
        switch (data.event) {
          case "play":
            console.log("Playing YouTube video");
            playerRef.current.seekTo(data.currentTime, true);
            playerRef.current.playVideo();
            setVideoState((prev) => ({ ...prev, isPaused: false }));
            break;
          case "pause":
            console.log("Pausing YouTube video");
            playerRef.current.pauseVideo();
            setVideoState((prev) => ({ ...prev, isPaused: true }));
            break;
          case "seek":
            playerRef.current.seekTo(data.currentTime, true);
            break;
        }
      }
    };

    // Đăng ký các event listeners
    socket.on("play_song", handlePlaySong);
    socket.on("video_event", handlePlaybackEvent);

    // Thêm handler cho now_playing_cleared
    const handleNowPlayingCleared = () => {
      setVideoState((prev) => ({
        ...prev,
        nowPlayingData: null,
        currentVideoId: "",
      }));

      // Load video đợi
      if (playerRef.current?.loadVideoById) {
        playerRef.current.loadVideoById({
          videoId: FALLBACK_VIDEO_ID,
          startSeconds: 0,
        });
      }
    };

    socket.on("now_playing_cleared", handleNowPlayingCleared);

    return () => {
      socket.off("play_song", handlePlaySong);
      socket.off("video_event", handlePlaybackEvent);
      socket.off("now_playing_cleared", handleNowPlayingCleared);
    };
  }, [socket, backupState.backupUrl]);

  // Thêm xử lý khi video kết thúc
  const handleVideoEnd = useCallback(() => {
    if (!socket || !videoState.nowPlayingData) return;

    socket.emit("song_ended", {
      roomId,
      videoId: videoState.nowPlayingData.video_id,
    });
  }, [socket, videoState.nowPlayingData, roomId]);

  // Thêm handler riêng cho video backup
  const handleBackupVideoEnd = useCallback(() => {
    if (!socket || !videoState.nowPlayingData) return;

    // Kiểm tra xem video có thực sự gần kết thúc không
    if (backupVideoRef.current) {
      const currentTime = backupVideoRef.current.currentTime;
      const duration = backupVideoRef.current.duration;

      // Chỉ emit song_ended khi thời gian hiện tại gần với duration gốc
      if (duration && currentTime >= duration - 1.5) {
        socket.emit("song_ended", {
          roomId,
          videoId: videoState.nowPlayingData.video_id,
        });
      }
    }
  }, [socket, videoState.nowPlayingData, roomId]);

  const handleStateChange = useCallback(
    (event: any) => {
      if (!playerRef.current || !socket) return;

      const YT = (window as any).YT.PlayerState;
      console.log("YouTube State Change:", event.data);

      switch (event.data) {
        case YT.BUFFERING:
          setVideoState((prev) => ({ ...prev, isBuffering: true }));
          break;
        case YT.PLAYING:
          console.log("Video is now playing");
          setVideoState((prev) => ({
            ...prev,
            isBuffering: false,
            isPaused: false,
          }));
          socket.emit("video_event", {
            roomId,
            event: "play",
            videoId: playerRef.current.getVideoData().video_id,
            currentTime: playerRef.current.getCurrentTime(),
          });
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
      }
    },
    [socket, roomId]
  );

  // Sửa lại handleYouTubeError
  const handleYouTubeError = useCallback(async () => {
    // Lấy video ID từ player hoặc state
    const currentVideoData = playerRef.current?.getVideoData?.();
    console.log("currentVideoData", currentVideoData);
    const videoId =
      currentVideoData?.video_id ||
      videoState.nowPlayingData?.video_id ||
      videoState.currentVideoId;

    // Log để debug
    console.log("Current video data:", {
      fromPlayer: currentVideoData?.video_id,
      fromNowPlaying: videoState.nowPlayingData?.video_id,
      fromState: videoState.currentVideoId,
      finalVideoId: videoId,
    });

    // Kiểm tra các điều kiện
    if (backupState.isLoadingBackup || backupState.backupUrl) {
      console.log("Đang loading hoặc đã có backup URL");
      return;
    }

    if (!videoId || videoId.trim() === "") {
      console.log("Không có video ID hợp lệ");
      return;
    }

    try {
      setBackupState((prev) => ({
        ...prev,
        isLoadingBackup: true,
        backupError: false,
      }));

      const backupApiUrl = `${
        import.meta.env.VITE_API_BASE_URL
      }/room-music/${roomId}/${videoId}`;
      console.log("Calling backup API:", backupApiUrl);

      const response = await axios.get(backupApiUrl);

      if (response.data?.result?.url) {
        setBackupState((prev) => ({
          ...prev,
          backupUrl: response.data.result.url,
          isLoadingBackup: false,
          youtubeError: false,
        }));
      } else {
        throw new Error("Không có URL backup trong response");
      }
    } catch (error) {
      console.error("Lỗi khi lấy backup:", error);
      setBackupState((prev) => ({
        ...prev,
        backupError: true,
        isLoadingBackup: false,
      }));
    }
  }, [
    videoState.nowPlayingData?.video_id,
    videoState.currentVideoId,
    roomId,
    backupState.isLoadingBackup,
    backupState.backupUrl,
  ]);

  // Sửa lại phần xử lý lỗi YouTube trong useEffect
  useEffect(() => {
    if (!socket) return;

    const handleYouTubeErrorEvent = (event: any) => {
      console.log("YouTube Error occurred:", event.data);

      // Đợi một chút trước khi xử lý lỗi để đảm bảo video ID đã được cập nhật
      setTimeout(() => {
        if (!backupState.backupUrl && !backupState.isLoadingBackup) {
          handleYouTubeError();
        }
      }, 1000);

      socket.emit("video_error", {
        roomId,
        videoId:
          videoState.nowPlayingData?.video_id || videoState.currentVideoId,
        errorCode: event.data,
      });
    };

    socket.on("error", handleYouTubeErrorEvent);

    return () => {
      socket.off("error", handleYouTubeErrorEvent);
    };
  }, [
    socket,
    handleYouTubeError,
    backupState.backupUrl,
    backupState.isLoadingBackup,
    roomId,
    videoState.nowPlayingData?.video_id,
    videoState.currentVideoId,
  ]);

  useEffect(() => {
    // Thêm script YouTube API
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName("script")[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    (window as any).onYouTubeIframeAPIReady = () => {
      playerRef.current = new (window as any).YT.Player("youtube-player", {
        // Chỉ sử dụng FALLBACK_VIDEO_ID khi không có nowPlayingData
        videoId:
          videoState.nowPlayingData?.video_id ||
          (!videoState.nowPlayingData ? FALLBACK_VIDEO_ID : undefined),
        playerVars: {
          autoplay: 1,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          fs: 1,
          iv_load_policy: 3,
          enablejsapi: 1,
          origin: window.location.origin,
          disablekb: 1,
          vq: "hd1080",
          showinfo: 0,
          // Chỉ loop khi không có nowPlayingData
          loop: !videoState.nowPlayingData ? 1 : 0,
          playlist: !videoState.nowPlayingData ? FALLBACK_VIDEO_ID : undefined,
        },
        events: {
          onReady: (event: any) => {
            event.target.setPlaybackQuality("hd1080");
            event.target.playVideo();
            // Chỉ seek time khi có video chính
            if (videoState.nowPlayingData) {
              const currentServerTime =
                videoState.nowPlayingData.timestamp +
                (Date.now() - videoState.nowPlayingData.timestamp) / 1000;
              const targetTime =
                videoState.nowPlayingData.currentTime +
                (currentServerTime - videoState.nowPlayingData.timestamp);
              event.target.seekTo(targetTime, true);
            }
            socket?.emit("video_ready", {
              roomId: roomId,
              videoId: videoState.nowPlayingData?.video_id,
            });
            setVideoState((prev) => ({ ...prev, isPaused: false }));
            setIsChangingSong(false);
          },
          onStateChange: (event: any) => {
            const YT = (window as any).YT.PlayerState;
            handleStateChange(event);

            // Thêm xử lý khi video kết thúc
            if (event.data === YT.ENDED) {
              handleVideoEnd();
            }

            if (event.data === YT.PLAYING) {
              setIsChangingSong(false);
            }

            if (!videoState.nowPlayingData && event.data === YT.ENDED) {
              event.target.playVideo();
            }
          },
          onPlaybackQualityChange: (event: any) => {
            console.log("Quality changed:", event.data);
          },
          onError: async (event: any) => {
            console.log("YouTube Error occurred:", event.data);
            setIsChangingSong(false);
            await handleYouTubeError();

            socket?.emit("video_error", {
              roomId,
              videoId:
                videoState.nowPlayingData?.video_id ||
                videoState.currentVideoId,
              errorCode: event.data,
            });
          },
        },
      });
    };
  }, [
    videoState.currentVideoId,
    handleStateChange,
    handleYouTubeError,
    videoState.nowPlayingData,
    videoState.nowPlayingData?.video_id,
    roomId,
    socket,
    handleVideoEnd,
  ]);

  const handleTimeUpdate = () => {
    if (isChangingSong || !videoState.nowPlayingData) return; // Skip if no active song

    // Xử lý cho video backup
    if (backupState.backupUrl && backupVideoRef.current) {
      const currentTime = backupVideoRef.current.currentTime;
      const rawDuration = backupVideoRef.current.duration;
      const duration = rawDuration ? Math.max(0, rawDuration - 1.5) : 0;
      const isPlaying = !backupVideoRef.current.paused;

      if (currentTime >= duration) {
        socket?.emit("song_ended", {
          roomId,
          videoId: videoState.currentVideoId,
        });
      }

      if (
        currentTime !== undefined &&
        duration &&
        !isNaN(currentTime) &&
        !isNaN(duration)
      ) {
        socket?.emit("time_update", {
          roomId,
          videoId: videoState.currentVideoId,
          currentTime,
          duration,
          isPlaying,
        });
      }
      return;
    }

    // Xử lý cho YouTube player
    if (!playerRef.current) return;

    const videoData = playerRef.current.getVideoData?.();
    if (!videoData) return;

    const currentTime = playerRef.current.getCurrentTime();
    const duration = playerRef.current.getDuration();

    if (currentTime >= duration) {
      socket?.emit("song_ended", {
        roomId,
        videoId: videoData.video_id,
      });
    }

    if (currentTime && duration && !isNaN(currentTime) && !isNaN(duration)) {
      socket?.emit("time_update", {
        roomId,
        videoId: videoData.video_id,
        currentTime,
        duration,
        isPlaying: !videoState.isPaused,
      });
    }
  };

  useEffect(() => {
    if (!socket) return;

    // Xử lý cho video backup và YouTube player events
    // ... rest of the event handling code ...

    let intervalId: number;
    if (!videoState.isPaused) {
      intervalId = window.setInterval(handleTimeUpdate, 1000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [
    socket,
    roomId,
    videoState.isPaused,
    backupState.backupUrl,
    videoState.currentVideoId,
    isChangingSong,
  ]);

  useEffect(() => {
    if (!backupState.youtubeError || !videoState.nowPlayingData?.video_id)
      return;

    handleYouTubeError();
    setBackupState((prev) => ({ ...prev, youtubeError: false }));
  }, [
    backupState.youtubeError,
    videoState.nowPlayingData?.video_id,
    handleYouTubeError,
  ]);

  const checkIframeError = useCallback(() => {
    const iframe = document.querySelector(
      "#youtube-player iframe"
    ) as HTMLIFrameElement;
    if (!iframe) return;

    try {
      const iframeDoc =
        iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc || iframeDoc.documentElement.innerHTML.includes("error")) {
        setBackupState((prev) => ({ ...prev, youtubeError: true }));
      }
    } catch (error: any) {
      setBackupState((prev) => ({ ...prev, youtubeError: true }));
    }
  }, []);

  useEffect(() => {
    const intervalId = setInterval(checkIframeError, 10000);
    return () => clearInterval(intervalId);
  }, []);

  // Thêm useEffect để theo dõi sự thay đổi của video_id
  useEffect(() => {
    console.log("=== VIDEO ID CHANGED ===");
    console.log("currentVideoId:", videoState.currentVideoId);
    console.log(
      "nowPlayingData video_id:",
      videoState.nowPlayingData?.video_id
    );
    console.log("======================");
  }, [videoState.currentVideoId, videoState.nowPlayingData?.video_id]);

  useEffect(() => {
    if (backupState.backupVideoReady && containerRef.current) {
      try {
        containerRef.current.requestFullscreen();
      } catch (error) {
        console.error("Lỗi khi vào chế độ toàn màn hình:", error);
      }
    }
  }, [backupState.backupVideoReady]);

  // Thêm useEffect để xử lý khi video YouTube sẵn sàng
  useEffect(() => {
    if (!videoState.isBuffering && containerRef.current) {
      try {
        containerRef.current.requestFullscreen();
      } catch (error) {
        console.error("Lỗi khi vào chế độ toàn màn hình:", error);
      }
    }
  }, [videoState.isBuffering]);

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap < 300) {
      // 300ms threshold for double tap
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        containerRef.current?.requestFullscreen();
      }
    }
    setLastTap(now);
  };

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

  useEffect(() => {
    if (isChangingSong) {
      const timeout = setTimeout(() => {
        setIsChangingSong(false);
      }, 10000); // Reset sau 10 giây nếu vẫn đang loading

      return () => clearTimeout(timeout);
    }
  }, [isChangingSong]);

  return (
    <div
      ref={containerRef}
      className="relative w-screen h-screen"
      onClick={handleDoubleTap}
    >
      <style>
        {`
          /* Ẩn tất cả các điều khiển và thông tin của YouTube */
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
          /* Thêm các class mới để ẩn video đề xuất */
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

          /* Ẩn màn hình lỗi YouTube */
          .ytp-error,
          .ytp-error-content-wrap,
          .ytp-error-content-wrap-reason {
            display: none !important;
          }

          /* Ẩn iframe khi có lỗi */
          #youtube-player iframe {
            opacity: 0 !important;
            pointer-events: none !important;
            z-index: -1 !important;
          }
        `}
      </style>

      {!isOnline && (
        <div className="absolute bottom-4 left-4 z-50 bg-yellow-500 px-4 py-2 rounded-full">
          <p className="text-white">Mất kết nối mạng!</p>
        </div>
      )}

      {isChangingSong && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-40">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-white">
            <img src={logo} alt="logo" className="w-full h-full" />
          </div>
        </div>
      )}

      {/* Sửa lại phần video backup */}
      <div className="absolute inset-0 w-full h-full">
        {backupState.backupUrl && !backupState.backupError && (
          <video
            ref={backupVideoRef}
            key={backupState.backupUrl}
            className="absolute inset-0 w-full h-full z-10"
            autoPlay
            playsInline
            controls={false}
            onLoadedData={() => {
              console.log("Video backup đã sẵn sàng");
              setBackupState((prev) => ({
                ...prev,
                backupVideoReady: true,
              }));

              socket?.emit("video_ready", {
                roomId,
                videoId: videoState.currentVideoId,
              });

              // Tự động phát video
              backupVideoRef.current
                ?.play()
                .then(() => {
                  // Sau khi bắt đầu phát thành công, emit event play ngay lập tức
                  socket?.emit("video_event", {
                    roomId,
                    event: "play",
                    videoId: videoState.currentVideoId,
                    currentTime: backupVideoRef.current?.currentTime || 0,
                  });

                  setVideoState((prev) => ({ ...prev, isPaused: false }));
                })
                .catch((error) => {
                  console.error("Lỗi khi tự động phát video backup:", error);
                });
            }}
            onEnded={handleBackupVideoEnd}
            onError={(e) => {
              console.error("Lỗi khi phát video backup:", e);
              setBackupState((prev) => ({
                ...prev,
                backupError: true,
                backupUrl: "",
                backupVideoReady: false,
              }));
            }}
            preload="auto"
          >
            <source src={backupState.backupUrl} type="video/mp4" />
            Trình duyệt của bạn không hỗ trợ thẻ video.
          </video>
        )}
      </div>

      {/* YouTube iframe */}
      <div
        id="youtube-player"
        className={`absolute top-0 left-0 w-full h-full ${
          backupState.backupUrl &&
          !backupState.backupError &&
          backupState.backupVideoReady
            ? "hidden"
            : "visible"
        }`}
      ></div>

      {/* Loading indicator */}
      {backupState.isLoadingBackup && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-50">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-white">
            <img src={logo} alt="logo" className="w-full h-full" />
          </div>
        </div>
      )}

      {/* Logo */}
      <div className="absolute z-30 bottom-[15px] right-[15px] w-[110px] h-[42px] bg-black">
        <img src={logo} alt="logo" className="w-full h-full" />
      </div>

      {/* Chỉ hiển thị message khi không có video_id */}
      {!videoState.nowPlayingData?.video_id && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 px-6 py-3 rounded-full shadow-lg">
            <p className="text-white text-xl font-bold animate-bounce">
              {cuteMessages[currentMessageIndex]}
            </p>
          </div>
        </div>
      )}

      {videoState.nowPlayingData && (
        <div className="absolute top-4 left-4 z-50 bg-black p-4 rounded-lg text-white">
          <p className="font-bold">{videoState.nowPlayingData.title}</p>
          <p className="text-sm">Jozo</p>
        </div>
      )}
    </div>
  );
};

export default YouTubePlayer;
