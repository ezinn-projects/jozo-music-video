/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import io, { Socket } from "socket.io-client";
import { logo } from "./assets";
import { PlaybackState } from "./constants/enum";
import axios from "axios";

interface NowPlayingData {
  video_id: string;
  title: string;
  thumbnail: string;
  author: string;
  duration: number;
  timestamp: number;
  currentTime: number;
}

const YouTubePlayer = () => {
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // const overlayRef = useRef<HTMLDivElement>(null);
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

  console.log("nowPlayingData", videoState.nowPlayingData);
  console.log("currentVideoId", videoState.currentVideoId);

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

    const handleNowPlaying = (data: NowPlayingData) => {
      if (!data?.video_id) return;

      // Cập nhật tất cả state liên quan trong một lần
      setVideoState((prev) => ({
        ...prev,
        nowPlayingData: data,
        currentVideoId: data.video_id,
        isBuffering: true,
      }));

      // Reset toàn bộ backupState về trạng thái mặc định
      setBackupState({
        backupUrl: "",
        isLoadingBackup: false,
        backupError: false,
        backupVideoReady: false,
        youtubeError: false,
      });

      if (playerRef.current?.getVideoData) {
        playerRef.current.loadVideoById({
          videoId: data.video_id,
          startSeconds: data.currentTime,
        });
      }
    };

    socket.emit("get_now_playing", { roomId });
    socket.on("now_playing", handleNowPlaying);

    // Lắng nghe sự kiện video_event từ ControlBar
    socket.on("video_event", (data: any) => {
      if (playerRef.current) {
        switch (data.event) {
          case PlaybackState.PLAY:
            playerRef.current.seekTo(data.currentTime, true);
            playerRef.current.playVideo();
            setVideoState((prev) => ({ ...prev, isPaused: false }));
            break;
          case PlaybackState.PAUSE:
            playerRef.current.pauseVideo();
            setVideoState((prev) => ({ ...prev, isPaused: true }));
            break;
          case PlaybackState.SEEK:
            playerRef.current.seekTo(data.currentTime, true);
            break;
        }
      }
    });

    // Lắng nghe sự kiện next_song
    socket.on("next_song", () => {
      socket.emit("get_now_playing", { roomId });
    });

    // Thêm xử lý lỗi cho socket
    socket.on("connect_error", (error: any) => {
      console.error("Socket connection error:", error);
    });

    socket.on("error", (error: any) => {
      console.error("Socket error:", error);
    });

    return () => {
      socket.off("now_playing", handleNowPlaying);
      socket.off("video_event");
      socket.off("next_song");
    };
  }, [socket, roomId]);

  const handleStateChange = useCallback(
    (event: any) => {
      if (!playerRef.current || !socket) return;

      const YT = (window as any).YT.PlayerState;

      switch (event.data) {
        case YT.BUFFERING:
          setVideoState((prev) => ({ ...prev, isBuffering: true }));
          break;
        case YT.PLAYING:
          setVideoState((prev) => ({
            ...prev,
            isBuffering: false,
            isPaused: false,
          }));
          if (playerRef.current.getVideoData?.()) {
            socket.emit("sync_time", {
              roomId,
              videoId: playerRef.current.getVideoData().video_id,
              currentTime: playerRef.current.getCurrentTime(),
              timestamp: Date.now(),
            });
          }
          break;
        case YT.PAUSED:
          setVideoState((prev) => ({ ...prev, isPaused: true }));
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

    console.log("videoId", videoId);

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
          },
          onStateChange: (event: any) => {
            const YT = (window as any).YT.PlayerState;
            handleStateChange(event);

            // Chỉ tự động phát lại fallback video khi không có nowPlayingData
            if (!videoState.nowPlayingData && event.data === YT.ENDED) {
              event.target.playVideo();
            }
          },
          onPlaybackQualityChange: (event: any) => {
            console.log("Quality changed:", event.data);
          },
          onError: async (event: any) => {
            console.log("YouTube Error occurred:", event.data);

            // Gọi handleYouTubeError ngay lập tức khi có bất kỳ lỗi nào
            await handleYouTubeError();

            // Thông báo lỗi cho server
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
  ]);

  console.log("backupUrl", backupState.backupUrl);

  useEffect(() => {
    if (
      !socket ||
      !playerRef.current ||
      videoState.isBuffering ||
      videoState.isPaused ||
      !playerRef.current.getVideoData
    )
      return;

    const syncInterval = setInterval(() => {
      const videoData = playerRef.current.getVideoData();
      if (!videoData) return;

      socket.emit("sync_time", {
        roomId,
        videoId: videoData.video_id,
        currentTime: playerRef.current.getCurrentTime(),
        timestamp: Date.now(),
      });
    }, 5000);

    return () => clearInterval(syncInterval);
  }, [socket, roomId, videoState.isBuffering, videoState.isPaused]);

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

  return (
    <div ref={containerRef} className="relative w-screen h-screen">
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

      {/* Sửa lại phần video backup */}
      <div className="absolute inset-0 w-full h-full">
        {backupState.backupUrl && !backupState.backupError && (
          <video
            key={backupState.backupUrl}
            className="absolute inset-0 w-full h-full z-10"
            autoPlay
            playsInline
            controls={false}
            ref={(videoElement) => {
              if (videoElement) {
                // Dọn dẹp video cũ
                const oldVideo = document.querySelector("video");
                if (oldVideo && oldVideo !== videoElement) {
                  oldVideo.pause();
                  oldVideo.remove();
                }

                videoElement.addEventListener("loadeddata", () => {
                  console.log("Video backup đã sẵn sàng");
                  setBackupState((prev) => ({
                    ...prev,
                    backupVideoReady: true,
                  }));
                  // Đồng bộ trạng thái play/pause với state hiện tại
                  if (videoState.isPaused) {
                    videoElement.pause();
                  } else {
                    videoElement.play();
                  }
                });

                // Xử lý sự kiện video_event từ socket
                if (socket) {
                  // Cleanup socket listeners trước khi thêm mới
                  socket.off("video_event");

                  socket.on("video_event", (data: any) => {
                    switch (data.event) {
                      case PlaybackState.PLAY:
                        videoElement.currentTime = data.currentTime;
                        videoElement.play();
                        setVideoState((prev) => ({ ...prev, isPaused: false }));
                        break;
                      case PlaybackState.PAUSE:
                        videoElement.pause();
                        setVideoState((prev) => ({ ...prev, isPaused: true }));
                        break;
                      case PlaybackState.SEEK:
                        videoElement.currentTime = data.currentTime;
                        break;
                    }
                  });
                }
              }
            }}
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
    </div>
  );
};

export default YouTubePlayer;
