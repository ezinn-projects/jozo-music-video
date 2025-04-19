/* eslint-disable react-hooks/exhaustive-deps */
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

  // Danh sách các fallback video ID
  const FALLBACK_VIDEO_IDS = [
    "IcrbM1l_BoI", // Avicii - Wake Me Up
    "kJQP7kiw5Fk", // Luis Fonsi - Despacito
    "60ItHLz5WEA", // Alan Walker - Faded
    "JGwWNGJdvx8", // Ed Sheeran - Shape of You
    "CevxZvSJLk8", // Katy Perry - Roar
    "pXASS-75Dkg", // Sơn Tùng M-TP - Chúng Ta Của Hiện Tại
    "Llw9Q6akRo4", // HIEUTHUHAI, NEGAV - Không Thể Say
    "Wvt7Mklz-Nk", // Phí Phương Anh - Cắt Đôi Nỗi Sầu
    "gdZLi9oWNZg", // BTS - Dynamite
    "H5v3kku4y6Q", // BLACKPINK - How You Like That
    "GUhF8lxPLf8", // AMEE - Đen Đá Không Đường
    "j_v5l5VxKEw", // Phương Ly - Thằng Điên
  ];

  // Chọn ngẫu nhiên một video ID từ danh sách
  const [FALLBACK_VIDEO_ID, setFallbackVideoID] = useState(
    FALLBACK_VIDEO_IDS[Math.floor(Math.random() * FALLBACK_VIDEO_IDS.length)]
  );

  // Thêm option audio-only
  const AUDIO_ONLY_MODE = true;

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

  // Thêm state để lưu trữ âm lượng
  const [volume, setVolume] = useState(100);

  const [showTitle, setShowTitle] = useState(true);

  // Thêm state để hiển thị indicator
  const [volumeToast, setVolumeToast] = useState<{
    show: boolean;
    value: number;
  }>({ show: false, value: 100 });

  // Thêm danh sách nhạc trending
  const trendingSongs = [
    // Rap/Hip-hop
    {
      title: "Nước Mắt Cá Sấu",
      artist: "HIEUTHUHAI",
      views: "15.2M",
      genre: "Rap",
    },
    {
      title: "Trời Hôm Nay Nhiều Mây Cực",
      artist: "HIEUTHUHAI",
      views: "12.8M",
      genre: "Rap",
    },
    {
      title: "Khi Cơn Mơ Dần Phai",
      artist: "Tlinh ft. 2pillz",
      views: "10.5M",
      genre: "Rap",
    },
    {
      title: "Không Thể Say",
      artist: "HIEUTHUHAI",
      views: "9.8M",
      genre: "Rap",
    },
    // V-Pop
    {
      title: "Ngày Mai Rồi Sẽ Khác",
      artist: "Sơn Tùng M-TP",
      views: "18.5M",
      genre: "V-Pop",
    },
    {
      title: "Đừng Lo Em À",
      artist: "Hoàng Thùy Linh",
      views: "11.2M",
      genre: "V-Pop",
    },
    {
      title: "Yêu Anh Đi",
      artist: "Hòa Minzy",
      views: "8.9M",
      genre: "V-Pop",
    },
    // R&B
    {
      title: "Anh Là Ngoại Lệ Của Em",
      artist: "Phương Ly",
      views: "7.8M",
      genre: "R&B",
    },
    {
      title: "Những Ngày Mưa",
      artist: "Vũ.",
      views: "9.1M",
      genre: "R&B",
    },
    // Underground
    {
      title: "id 072019 2.0",
      artist: "W/N",
      views: "6.5M",
      genre: "Underground",
    },
    {
      title: "Chìm Sâu",
      artist: "MCK, Trung Trần",
      views: "8.2M",
      genre: "Underground",
    },
    // Ballad
    {
      title: "Có Một Nơi",
      artist: "Hà Anh Tuấn",
      views: "5.9M",
      genre: "Ballad",
    },
  ];

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % cuteMessages.length);
    }, 2500); // Đổi message nhanh hơn, mỗi 2.5 giây

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (videoState.nowPlayingData) {
      if (videoState.isPaused) {
        // Nếu đang pause, luôn hiển thị
        setShowTitle(true);
      } else {
        // Nếu đang chạy, hiển thị tên bài rồi ẩn sau 8 giây
        setShowTitle(true);
        const timer = setTimeout(() => {
          setShowTitle(false);
        }, 8000);
        return () => clearTimeout(timer);
      }
    }
  }, [videoState.nowPlayingData, videoState.isPaused]);

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
        youtubeError: true, // Đánh dấu là YouTube đang có lỗi
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
          youtubeError: true, // Vẫn giữ trạng thái lỗi YouTube để ẩn iframe
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
        youtubeError: true, // Vẫn đánh dấu YouTube lỗi
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
    // Preload YouTube API và các tài nguyên cần thiết
    const preloadResources = async () => {
      // Preload logo
      const logoImg = new Image();
      logoImg.src = logo;

      // Chọn ngẫu nhiên một fallback video ID
      const randomID =
        FALLBACK_VIDEO_IDS[
          Math.floor(Math.random() * FALLBACK_VIDEO_IDS.length)
        ];
      console.log("Chọn fallback video ID:", randomID);
      setFallbackVideoID(randomID);

      // Preload YouTube API
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    };

    preloadResources();

    (window as any).onYouTubeIframeAPIReady = () => {
      console.log("YouTube iframe API ready, initializing player with:", {
        videoId: videoState.nowPlayingData?.video_id || FALLBACK_VIDEO_ID,
        fallbackMode: !videoState.nowPlayingData,
        audioOnly: AUDIO_ONLY_MODE,
      });

      playerRef.current = new (window as any).YT.Player("youtube-player", {
        // Chỉ sử dụng FALLBACK_VIDEO_ID khi không có nowPlayingData
        videoId: videoState.nowPlayingData?.video_id || FALLBACK_VIDEO_ID,
        width: "100%",
        height: "100%",
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
          vq: !videoState.nowPlayingData ? "tiny" : "auto",
          showinfo: 0,
          // Chỉ loop khi không có nowPlayingData
          loop: !videoState.nowPlayingData ? 1 : 0,
          playlist: !videoState.nowPlayingData ? FALLBACK_VIDEO_ID : undefined,
        },
        events: {
          onReady: (event: any) => {
            console.log("YouTube player ready, playing video...");
            // Đặt chất lượng video: thấp nhất cho fallback, tự động cho video thường
            event.target.setPlaybackQuality(
              !videoState.nowPlayingData ? "tiny" : "auto"
            );

            // Nếu đang ở chế độ audio-only và không có bài đang phát, ẩn video
            if (!videoState.nowPlayingData && AUDIO_ONLY_MODE) {
              // Ẩn video và chỉ phát audio
              const iframe = document.querySelector(
                "#youtube-player iframe"
              ) as HTMLIFrameElement;
              if (iframe) {
                iframe.style.opacity = "0";
                iframe.style.pointerEvents = "none";
              }
            }

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

            // Đặt âm lượng ban đầu cho YouTube player
            event.target.setVolume(volume);
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

            // Đánh dấu YouTube có lỗi trước khi gọi handleYouTubeError
            setBackupState((prev) => ({
              ...prev,
              youtubeError: true,
            }));

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
    volume,
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
    handleTimeUpdate,
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

  useEffect(() => {
    if (!socket) return;

    const handleVolumeChange = (newVolume: number) => {
      setVolume(newVolume);

      // Hiển thị toast
      setVolumeToast({ show: true, value: newVolume });

      // Áp dụng âm lượng cho YouTube player
      if (playerRef.current?.setVolume) {
        playerRef.current.setVolume(newVolume);
      }
      // Áp dụng âm lượng cho video backup
      if (backupVideoRef.current) {
        backupVideoRef.current.volume = newVolume / 100;
      }

      // Tự động ẩn toast sau 2 giây
      setTimeout(() => {
        setVolumeToast((prev) => ({ ...prev, show: false }));
      }, 2000);
    };

    socket.on("volumeChange", handleVolumeChange);

    return () => {
      socket.off("volumeChange", handleVolumeChange);
    };
  }, [socket]);

  // Cập nhật xử lý cho video backup
  useEffect(() => {
    if (backupVideoRef.current) {
      backupVideoRef.current.volume = volume / 100;
    }
  }, [volume, backupState.backupUrl]);

  return (
    <div
      ref={containerRef}
      className="relative w-screen h-screen"
      onClick={handleDoubleTap}
    >
      {/* Thêm backdrop blur chỉ khi video bị pause */}
      {videoState.isPaused && videoState.nowPlayingData && (
        <div className="absolute inset-0 backdrop-blur-sm z-[25]"></div>
      )}

      {/* Thêm background đen phía dưới video khi pause */}
      {videoState.isPaused && videoState.nowPlayingData && (
        <div className="absolute bottom-0 left-0 right-0 h-[250px] bg-gradient-to-t from-black via-black/80 to-transparent z-[20]"></div>
      )}

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

          /* Ẩn iframe khi có lỗi - chỉ ẩn opacity nhưng vẫn giữ z-index để iframe có thể hoạt động */
          #youtube-player iframe.error-mode {
            opacity: 0 !important;
            pointer-events: none !important;
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
            className="absolute inset-0 w-full h-full object-contain z-10"
            autoPlay
            playsInline
            controls={false}
            disablePictureInPicture
            controlsList="nodownload noplaybackrate nofullscreen"
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
            style={{
              objectFit: "contain",
              width: "100%",
              height: "100%",
              backgroundColor: "#000",
            }}
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
            : backupState.youtubeError
            ? "opacity-50 pointer-events-none"
            : "visible"
        }`}
      ></div>

      {/* Hiển thị màn hình lỗi YouTube khi không có backup */}
      {backupState.youtubeError && !backupState.backupUrl && (
        <div className="absolute inset-0 bg-black flex flex-col items-center justify-center z-[25]">
          <div className="text-center p-4 rounded-md bg-black/40 max-w-[90%] w-auto">
            <img
              src={logo}
              alt="logo"
              className="w-20 h-20 mx-auto mb-4 animate-pulse"
            />
            <p className="text-white text-xl font-bold mb-2">
              Video không khả dụng
            </p>
            <p className="text-white/70 text-base mb-3">
              Đang thử tải nguồn dự phòng...
            </p>
            {backupState.isLoadingBackup && (
              <div className="w-8 h-8 border-t-3 border-pink-500 rounded-full animate-spin mx-auto mt-2"></div>
            )}
            {backupState.backupError && (
              <p className="text-red-400 mt-2 text-sm">
                Không thể tải nguồn dự phòng. Vui lòng thử lại sau.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {backupState.isLoadingBackup && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-50">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-white">
            <img src={logo} alt="logo" className="w-full h-full" />
          </div>
        </div>
      )}

      {/* Logo */}
      <div className="absolute z-30 top-[15px] right-[15px] w-[140px] h-[50px] bg-black">
        <img src={logo} alt="logo" className="w-full h-full" />
      </div>

      {/* Pause Overlay - Hiển thị khi video bị pause và có dữ liệu video */}
      {videoState.isPaused && videoState.nowPlayingData && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-[30]">
          <div className="animate-[breath_3s_ease-in-out_infinite] flex flex-col items-center p-8 rounded-lg bg-black/30 backdrop-blur-md shadow-2xl">
            <img
              src={logo}
              alt="logo"
              className="w-40 h-40 object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.7)]"
            />
            <p className="text-white mt-6 text-2xl font-bold tracking-wider text-shadow">
              {videoState.nowPlayingData.title}
            </p>
            <p className="text-white/70 mt-2 text-lg">Đang tạm dừng</p>
          </div>
        </div>
      )}

      {/* Fallback overlay - hiển thị khi không có bài hát nào đang phát */}
      {!videoState.nowPlayingData?.video_id && (
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/90 via-black/95 to-pink-900/90 z-[30] flex flex-col items-center justify-start pt-8">
          <div className="relative mb-4">
            <img
              src={logo}
              alt="logo"
              className="w-24 h-24 object-contain animate-[pulse_3s_ease-in-out_infinite] drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]"
            />
          </div>

          <div className="px-8 py-3 rounded-xl bg-black/30 backdrop-blur-sm border border-white/10 shadow-[0_0_15px_rgba(0,0,0,0.3)] mb-5 max-w-[90%]">
            <p className="text-white text-lg font-bold text-center">
              {cuteMessages[currentMessageIndex]}
            </p>
          </div>

          {/* Hiển thị thông tin về nhạc nền đang phát */}
          <div className="px-6 py-2 bg-black/20 backdrop-blur-sm rounded-full mb-5 flex items-center">
            <div className="w-3 h-3 rounded-full bg-pink-500 mr-3 animate-pulse"></div>
            <p className="text-white text-sm">
              Đang phát:{" "}
              <span className="font-semibold">
                {FALLBACK_VIDEO_ID === "IcrbM1l_BoI" && "Avicii - Wake Me Up"}
                {FALLBACK_VIDEO_ID === "kJQP7kiw5Fk" &&
                  "Luis Fonsi - Despacito"}
                {FALLBACK_VIDEO_ID === "60ItHLz5WEA" && "Alan Walker - Faded"}
                {FALLBACK_VIDEO_ID === "JGwWNGJdvx8" &&
                  "Ed Sheeran - Shape of You"}
                {FALLBACK_VIDEO_ID === "CevxZvSJLk8" && "Katy Perry - Roar"}
                {FALLBACK_VIDEO_ID === "pXASS-75Dkg" &&
                  "Sơn Tùng M-TP - Chúng Ta Của Hiện Tại"}
                {FALLBACK_VIDEO_ID === "Llw9Q6akRo4" &&
                  "HIEUTHUHAI, NEGAV - Không Thể Say"}
                {FALLBACK_VIDEO_ID === "Wvt7Mklz-Nk" &&
                  "Phí Phương Anh - Cắt Đôi Nỗi Sầu"}
                {FALLBACK_VIDEO_ID === "gdZLi9oWNZg" && "BTS - Dynamite"}
                {FALLBACK_VIDEO_ID === "H5v3kku4y6Q" &&
                  "BLACKPINK - How You Like That"}
                {FALLBACK_VIDEO_ID === "GUhF8lxPLf8" &&
                  "AMEE - Đen Đá Không Đường"}
                {FALLBACK_VIDEO_ID === "j_v5l5VxKEw" &&
                  "Phương Ly - Thằng Điên"}
              </span>
            </p>
          </div>

          {/* Danh sách nhạc trending */}
          <div
            className="w-full max-w-4xl px-6 overflow-y-auto"
            style={{ maxHeight: "calc(100vh - 240px)" }}
          >
            <div className="bg-black/40 backdrop-blur-sm rounded-2xl p-5 border border-white/10">
              <h3 className="text-white text-lg font-bold mb-4 flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2 text-pink-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                </svg>
                Đang Thịnh Hành
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {trendingSongs.map((song, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors group border border-white/5"
                  >
                    <div className="flex items-center flex-1 min-w-0">
                      <span className="text-xl font-bold text-white/50 w-6 shrink-0">
                        {index + 1}
                      </span>
                      <div className="ml-3 truncate">
                        <p className="text-white font-semibold group-hover:text-pink-500 transition-colors truncate">
                          {song.title}
                        </p>
                        <div className="flex items-center gap-2">
                          <p className="text-white/60 text-xs truncate">
                            {song.artist}
                          </p>
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10 text-white/80">
                            {song.genre}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center text-white/60 text-xs ml-3 shrink-0">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3 w-3 mr-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                      {song.views}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {videoState.nowPlayingData && showTitle && (
        <div className="absolute top-4 left-4 z-50 bg-black p-4 rounded-lg text-white">
          <p className="font-bold">{videoState.nowPlayingData.title}</p>
          <p className="text-sm">Jozo</p>
        </div>
      )}

      {/* Volume Toast */}
      <div
        className={`fixed top-4 right-4 z-50 flex items-center gap-2 bg-black/80 px-4 py-2 rounded-lg transition-all duration-300 ${
          volumeToast.show
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-[-20px]"
        }`}
      >
        {volumeToast.value === 0 ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
            />
          </svg>
        ) : volumeToast.value < 50 ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM15 9.354a4 4 0 010 5.292"
            />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
            />
          </svg>
        )}
        <span className="text-white font-medium">
          Âm lượng: {volumeToast.value}%
        </span>
      </div>
    </div>
  );
};

export default YouTubePlayer;
