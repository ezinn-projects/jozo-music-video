/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import io, { Socket } from "socket.io-client";
import { logo } from "./assets";
import { RecordingStudio } from "./RecordingStudio";
// import { RecordingStudio } from "./RecordingStudio";

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

// Định nghĩa kiểu dữ liệu cho sự kiện videos_turned_off
interface VideoTurnedOffData {
  status: string;
}

// Interface cho backup state
interface BackupState {
  backupUrl: string;
  isLoadingBackup: boolean;
  backupError: boolean;
  backupVideoReady: boolean;
  youtubeError: boolean;
}

// Custom hook để xử lý video backup
function useBackupVideo(
  videoId: string | undefined,
  roomId: string,
  volume: number,
  socket: typeof Socket | null,
  onVideoReady: () => void,
  onVideoEnd: () => void
) {
  const backupVideoRef = useRef<HTMLVideoElement>(null);
  const [backupState, setBackupState] = useState<BackupState>({
    backupUrl: "",
    isLoadingBackup: false,
    backupError: false,
    backupVideoReady: false,
    youtubeError: false,
  });

  // Xử lý khi có lỗi YouTube
  const handleYouTubeError = useCallback(async () => {
    if (!videoId || !roomId) return;

    // Kiểm tra các điều kiện
    if (backupState.isLoadingBackup || backupState.backupUrl) {
      console.log("Đang loading hoặc đã có backup URL");
      return;
    }

    try {
      setBackupState((prev) => ({
        ...prev,
        isLoadingBackup: true,
        backupError: false,
        youtubeError: true,
      }));

      // Sử dụng timeout để tránh request treo quá lâu
      const timeout = 10000;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const backupApiUrl = `${
        import.meta.env.VITE_API_BASE_URL
      }/room-music/${roomId}/${videoId}`;
      console.log("Calling backup API:", backupApiUrl);

      const response = await axios.get(backupApiUrl, {
        signal: controller.signal,
        timeout: timeout,
      });

      clearTimeout(timeoutId);

      if (response.data?.result?.url) {
        setBackupState((prev) => ({
          ...prev,
          backupUrl: response.data.result.url,
          isLoadingBackup: false,
          youtubeError: true,
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
        youtubeError: true,
      }));
    }
  }, [videoId, roomId, backupState.isLoadingBackup, backupState.backupUrl]);

  // Cập nhật volume cho video backup
  useEffect(() => {
    if (backupVideoRef.current) {
      backupVideoRef.current.volume = volume / 100;
    }
  }, [volume]);

  // Reset state khi videoId thay đổi
  useEffect(() => {
    if (videoId) {
      setBackupState({
        backupUrl: "",
        isLoadingBackup: false,
        backupError: false,
        backupVideoReady: false,
        youtubeError: false,
      });
    }
  }, [videoId]);

  // Xử lý các event của video backup
  const handlePlaybackEvent = useCallback(
    (event: VideoEvent) => {
      if (!backupVideoRef.current || !backupState.backupUrl) return;

      switch (event.event) {
        case "play":
          backupVideoRef.current.currentTime = event.currentTime;
          backupVideoRef.current
            .play()
            .catch((e) => console.error("Error playing backup video:", e));
          break;
        case "pause":
          backupVideoRef.current.pause();
          break;
        case "seek":
          backupVideoRef.current.currentTime = event.currentTime;
          break;
      }
    },
    [backupState.backupUrl]
  );

  return {
    backupVideoRef,
    backupState,
    setBackupState,
    handleYouTubeError,
    handlePlaybackEvent,
    renderBackupVideo: () =>
      backupState.backupUrl &&
      !backupState.backupError && (
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
              videoId,
            });

            onVideoReady();

            // Tự động phát video
            backupVideoRef.current?.play().catch((error) => {
              console.error("Lỗi khi tự động phát video backup:", error);
            });
          }}
          onEnded={onVideoEnd}
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
      ),
  };
}

const YouTubePlayer = () => {
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // const backupVideoRef = useRef<HTMLVideoElement>(null);
  const [socket, setSocket] = useState<typeof Socket | null>(null);
  const [params] = useSearchParams();
  const roomId = params.get("roomId") || "";

  // State để kiểm tra xem video có đang bị tắt hay không
  const [isVideoOff, setIsVideoOff] = useState(false);

  // Gộp các state liên quan đến video hiện tại vào một object
  const [videoState, setVideoState] = useState({
    nowPlayingData: null as NowPlayingData | null,
    currentVideoId: "",
    isPaused: true,
    isBuffering: true,
  });

  // Thêm state mới
  const [isChangingSong, setIsChangingSong] = useState(false);
  const [lastTap, setLastTap] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Thêm constant cho fallback video ID
  // đổi thành id của video bài hát Xin chào Việt Nam
  const FALLBACK_VIDEO_ID = "j9VLOXdx9VQ";

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

  // Thêm state cho Powered by Jozo
  const [showPoweredBy, setShowPoweredBy] = useState(true);

  // Thêm state theo dõi trạng thái kết nối socket
  const [socketStatus, setSocketStatus] = useState({
    connected: false,
    connectionAttempts: 0,
  });

  // Thêm state để bật/tắt chế độ dev testing
  const [devTestingMode, setDevTestingMode] = useState(false);

  // Thêm state để lưu ID video test
  const [testVideoId, setTestVideoId] = useState("");

  // Thêm state để hiển thị test iframe
  const [showTestIframe, setShowTestIframe] = useState(false);

  // Thêm xử lý khi video kết thúc
  const handleVideoEnd = useCallback(() => {
    if (!socket || !videoState.nowPlayingData) return;

    socket.emit("song_ended", {
      roomId,
      videoId: videoState.nowPlayingData.video_id,
    });
  }, [socket, videoState.nowPlayingData, roomId]);

  // Sử dụng custom hook
  const {
    backupVideoRef,
    backupState,
    setBackupState,
    handleYouTubeError,
    handlePlaybackEvent,
    renderBackupVideo,
  } = useBackupVideo(
    videoState.nowPlayingData?.video_id || videoState.currentVideoId,
    roomId,
    volume,
    socket,
    // onVideoReady callback - không tham chiếu trực tiếp đến backupVideoRef
    () => {
      setVideoState((prev) => ({ ...prev, isPaused: false }));

      // Emit play event sau khi backup video sẵn sàng
      if (socket) {
        socket.emit("video_event", {
          roomId,
          event: "play",
          videoId: videoState.currentVideoId,
          currentTime: 0, // Giá trị mặc định khi không truy cập được backupVideoRef
        });
      }
    },
    // onVideoEnd callback - truyền trực tiếp thay vì sử dụng handleBackupVideoEnd
    () => {
      if (!socket || !videoState.nowPlayingData) return;

      socket.emit("song_ended", {
        roomId,
        videoId: videoState.nowPlayingData.video_id,
      });
    }
  );

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
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      transports: ["websocket"], // ← chỉ websocket, không polling
      path: "/socket.io", // (mặc định)
    });
    setSocket(socketInstance);

    // Theo dõi trạng thái kết nối socket
    socketInstance.on("connect", () => {
      console.log("Socket connected successfully");
      setSocketStatus((prev) => ({
        ...prev,
        connected: true,
        connectionAttempts: 0,
      }));

      // Khi kết nối thành công, yêu cầu thông tin về bài hát hiện tại nếu có
      socketInstance.emit("request_current_song", { roomId });
    });

    socketInstance.on("disconnect", () => {
      console.log("Socket disconnected");
      setSocketStatus((prev) => ({
        ...prev,
        connected: false,
      }));
    });

    socketInstance.on("reconnect_attempt", (attemptNumber: number) => {
      console.log(`Socket reconnection attempt #${attemptNumber}`);
      setSocketStatus((prev) => ({
        ...prev,
        connectionAttempts: attemptNumber,
      }));
    });

    socketInstance.on("reconnect", () => {
      console.log("Socket reconnected");
      setSocketStatus((prev) => ({
        ...prev,
        connected: true,
      }));

      // Khi tái kết nối thành công, yêu cầu thông tin về bài hát hiện tại nếu có
      socketInstance.emit("request_current_song", { roomId });
    });

    socketInstance.on("reconnect_error", (error: Error) => {
      console.error("Socket reconnection error:", error);
    });

    socketInstance.on("reconnect_failed", () => {
      console.error("Socket reconnection failed after all attempts");

      // Tự động kết nối lại sau 10 giây nếu tất cả các lần thử đều thất bại
      setTimeout(() => {
        if (!socketInstance.connected) {
          socketInstance.connect();
        }
      }, 10000);
    });

    // Lắng nghe sự kiện tắt video từ BE
    socketInstance.on("videos_turned_off", (data: VideoTurnedOffData) => {
      console.log("Videos have been turned off by backend", data);
      setIsVideoOff(true);
    });

    // Lắng nghe sự kiện bật video từ BE
    socketInstance.on("videos_turned_on", () => {
      console.log("Videos have been turned on by backend");
      setIsVideoOff(false);
    });

    // Thiết lập heartbeat để kiểm tra kết nối
    const heartbeatInterval = setInterval(() => {
      if (socketInstance.connected) {
        socketInstance.emit("heartbeat", { roomId });
      }
    }, 30000); // 30 giây gửi một lần heartbeat

    return () => {
      clearInterval(heartbeatInterval);
      socketInstance.disconnect();
    };
  }, [roomId]);

  // Thêm response cho current_song nếu kết nối bị gián đoạn
  useEffect(() => {
    if (!socket) return;

    // Xử lý nhận thông tin bài hát hiện tại sau khi yêu cầu
    const handleCurrentSong = (data: PlaySongEvent) => {
      console.log("Received current song after reconnect:", data);

      if (!data || !data.video_id) return;

      // Nếu chưa có bài hát đang phát hoặc khác bài hát hiện tại
      if (
        !videoState.nowPlayingData?.video_id ||
        videoState.nowPlayingData.video_id !== data.video_id
      ) {
        setIsChangingSong(true);

        setVideoState((prev) => ({
          ...prev,
          nowPlayingData: {
            ...data,
            currentTime: data.currentTime || 0,
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
          // Tính toán thời điểm hiện tại dựa trên timestamp
          const elapsedTime = (Date.now() - data.timestamp) / 1000;
          const startTime = data.currentTime + elapsedTime;

          playerRef.current.loadVideoById({
            videoId: data.video_id,
            startSeconds: startTime, // Bắt đầu từ thời điểm hiện tại của bài hát
          });
        }
      }
    };

    socket.on("current_song", handleCurrentSong);

    return () => {
      socket.off("current_song", handleCurrentSong);
    };
  }, [socket, videoState.nowPlayingData?.video_id]);

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

    // Đăng ký các event listeners
    socket.on("play_song", handlePlaySong);
    socket.on("video_event", handlePlaybackEvent);
    socket.on("now_playing_cleared", handleNowPlayingCleared);

    return () => {
      socket.off("play_song", handlePlaySong);
      socket.off("video_event", handlePlaybackEvent);
      socket.off("now_playing_cleared", handleNowPlayingCleared);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    socket,
    FALLBACK_VIDEO_ID,
    // backupState.backupUrl, backupVideoRef và setBackupState được sử dụng trong useEffect
    // nhưng không thể thêm vào dependency array do gây ra circular dependency
  ]);

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

          // Ép chất lượng mỗi khi video đang phát
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
      }
    },
    [socket, roomId, videoState.nowPlayingData]
  );

  useEffect(() => {
    // Thêm script YouTube API chỉ khi chưa tồn tại
    if (
      !(window as any).YT &&
      !document.querySelector(
        'script[src="https://www.youtube.com/iframe_api"]'
      )
    ) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    const PROD_ORIGIN = "https://video.jozo.com.vn"; // domain production của bạn
    const ORIGIN = import.meta.env.PROD ? PROD_ORIGIN : window.location.origin;

    // Đảm bảo chỉ khởi tạo player khi YT API đã sẵn sàng
    const initializePlayer = () => {
      if (playerRef.current) return; // Tránh khởi tạo lại nếu đã tồn tại

      playerRef.current = new (window as any).YT.Player("youtube-player", {
        // Chỉ sử dụng FALLBACK_VIDEO_ID khi không có nowPlayingData
        videoId:
          videoState.nowPlayingData?.video_id ||
          (!videoState.nowPlayingData ? FALLBACK_VIDEO_ID : undefined),
        host: "https://www.youtube.com",
        playerVars: {
          autoplay: 1,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          fs: 1,
          iv_load_policy: 3,
          enablejsapi: 1,
          playsinline: 1,
          mute: 0,
          disablekb: 1,
          vq: !videoState.nowPlayingData ? "tiny" : "hd1080",
          loop: !videoState.nowPlayingData ? 1 : 0,
          playlist: !videoState.nowPlayingData ? FALLBACK_VIDEO_ID : undefined,
          quality: "hd1080",
          hl: "vi",
          cc_load_policy: 0,
          color: "white",
          origin: ORIGIN,
        },
        events: {
          onReady: (event: any) => {
            // Ép chất lượng ngay khi player sẵn sàng
            event.target.setPlaybackQuality(
              !videoState.nowPlayingData ? "tiny" : "hd1080"
            );

            try {
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
            } catch (e) {
              console.error("Lỗi khi phát video:", e);
              event.target.mute();
              event.target.playVideo();

              // Vẫn cố gắng seek time nếu có video chính
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
                  console.error("Lỗi khi seek video:", seekError);
                }
              }
            }

            event.target.setVolume(volume);
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

            // Ép chất lượng mỗi khi video đang chạy để đảm bảo không bị YouTube override
            if (event.data === YT.PLAYING && videoState.nowPlayingData) {
              event.target.setPlaybackQuality("hd1080");
            }

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
            // Ép chất lượng về HD 1080 nếu khác
            if (
              event.data !== "hd1080" &&
              videoState.nowPlayingData &&
              event.target.setPlaybackQuality
            ) {
              event.target.setPlaybackQuality("hd1080");
            }
          },
          onError: async (event: any) => {
            console.log("YouTube Error occurred:", event.data);
            setIsChangingSong(false);

            // Xử lý cụ thể cho từng mã lỗi YouTube
            // 150: Embedding disabled by request (video không cho phép embed)
            if (event.data === 150) {
              console.log(
                "Lỗi 150: Video không cho phép nhúng, chuyển sang chế độ backup"
              );

              // Đánh dấu YouTube có lỗi
              setBackupState((prev) => ({
                ...prev,
                youtubeError: true,
              }));

              // Kiểm tra xem nếu đây là video chưa được phát (trong quá trình chuyển bài)
              // thì mới gọi API lấy backup, tránh gọi nhiều lần không cần thiết
              if (!backupState.backupUrl && !backupState.isLoadingBackup) {
                await handleYouTubeError();

                // Thông báo lỗi cho server
                socket?.emit("video_error", {
                  roomId,
                  videoId:
                    videoState.nowPlayingData?.video_id ||
                    videoState.currentVideoId,
                  errorCode: event.data,
                  message: "Video không cho phép nhúng",
                });
              }
              return;
            }

            // Các lỗi YouTube khác
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

    // Xử lý cho trường hợp API đã load xong trước khi component mount
    if ((window as any).YT && (window as any).YT.Player) {
      initializePlayer();
    } else {
      // Nếu API chưa sẵn sàng, đăng ký callback
      (window as any).onYouTubeIframeAPIReady = initializePlayer;
    }

    // Cleanup function
    return () => {
      // Destroy player nếu tồn tại khi unmount
      if (playerRef.current && playerRef.current.destroy) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          console.error("Lỗi khi destroy player:", e);
        }
        playerRef.current = null;
      }
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
    backupState.backupUrl,
    backupState.isLoadingBackup,
    FALLBACK_VIDEO_ID,
  ]);

  const handleTimeUpdate = useCallback(() => {
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
  }, [
    isChangingSong,
    videoState.nowPlayingData,
    backupState.backupUrl,
    socket,
    roomId,
    videoState.currentVideoId,
    videoState.isPaused,
    backupVideoRef,
  ]);

  useEffect(() => {
    if (!socket || videoState.isPaused) return;

    console.log("Setting up time update interval");
    const intervalId = window.setInterval(handleTimeUpdate, 1000);

    return () => {
      console.log("Clearing time update interval");
      clearInterval(intervalId);
    };
  }, [socket, videoState.isPaused, handleTimeUpdate]);

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

  // Fix for backupState.backupVideoReady fullscreen
  useEffect(() => {
    if (backupState.backupVideoReady && containerRef.current) {
      try {
        containerRef.current.requestFullscreen().catch((error) => {
          console.error("Lỗi khi vào chế độ toàn màn hình (backup):", error);
        });
      } catch (error) {
        console.error("Lỗi khi vào chế độ toàn màn hình (backup):", error);
      }
    }
  }, [backupState.backupVideoReady]);

  // Fix for YouTube video buffer
  useEffect(() => {
    if (
      !videoState.isBuffering &&
      containerRef.current &&
      !document.fullscreenElement
    ) {
      try {
        containerRef.current.requestFullscreen().catch((error) => {
          console.error("Lỗi khi vào chế độ toàn màn hình (buffer):", error);
        });
      } catch (error) {
        console.error("Lỗi khi vào chế độ toàn màn hình (buffer):", error);
      }
    }
  }, [videoState.isBuffering]);

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
  }, [volume]);

  useEffect(() => {
    // Xử lý hiển thị Powered by Jozo khi bắt đầu video
    if (videoState.nowPlayingData) {
      // Hiển thị khi bắt đầu
      setShowPoweredBy(true);

      // Ẩn sau 6 giây
      const hideTimer = setTimeout(() => {
        setShowPoweredBy(false);
      }, 6000);

      // Hiển thị lại giữa bài
      const midwayTimer = setTimeout(() => {
        setShowPoweredBy(true);

        // Ẩn sau 3 giây
        setTimeout(() => {
          setShowPoweredBy(false);
        }, 3000);
      }, playerRef.current?.getDuration() * 500); // Khoảng giữa bài (50%)

      return () => {
        clearTimeout(hideTimer);
        clearTimeout(midwayTimer);
      };
    }
  }, [videoState.nowPlayingData?.video_id]);

  // Theo dõi thời gian phát để hiển thị Powered by Jozo khi kết thúc
  useEffect(() => {
    if (!videoState.nowPlayingData || !playerRef.current) return;

    const checkEndingInterval = setInterval(() => {
      if (playerRef.current?.getCurrentTime && playerRef.current?.getDuration) {
        const currentTime = playerRef.current.getCurrentTime();
        const duration = playerRef.current.getDuration();

        // Hiển thị trong 10 giây cuối
        if (duration - currentTime <= 10 && !showPoweredBy) {
          setShowPoweredBy(true);
        }
      }
    }, 1000);

    return () => clearInterval(checkEndingInterval);
  }, [videoState.nowPlayingData, showPoweredBy]);

  // Hiển thị trạng thái kết nối socket
  const connectionStatusIndicator = () => {
    if (!socketStatus.connected && socketStatus.connectionAttempts > 0) {
      return (
        <div className="absolute top-4 left-4 z-50 bg-red-500 px-4 py-2 rounded-full animate-pulse">
          <p className="text-white text-sm">
            Đang kết nối lại... {socketStatus.connectionAttempts}
          </p>
        </div>
      );
    }
    return null;
  };

  // Thêm function để giả lập lỗi YouTube
  const simulateYouTubeError = (errorCode: number) => {
    console.log(`Giả lập lỗi YouTube: ${errorCode}`);

    // Đánh dấu YouTube có lỗi
    setBackupState((prev) => ({
      ...prev,
      youtubeError: true,
    }));

    // Gọi hàm xử lý lỗi
    handleYouTubeError();

    // Gửi thông báo lỗi đến server
    socket?.emit("video_error", {
      roomId,
      videoId: videoState.nowPlayingData?.video_id || videoState.currentVideoId,
      errorCode: errorCode,
      message: "Lỗi giả lập để test",
    });
  };

  // Hàm để test video với ID cụ thể
  const testVideoWithId = (videoId: string) => {
    if (!videoId.trim()) return;

    // Hiển thị iframe test
    setTestVideoId(videoId);
    setShowTestIframe(true);
  };

  // Hàm để phát video test trong player chính
  const playTestVideo = (videoId: string) => {
    if (!videoId.trim()) return;

    if (playerRef.current?.loadVideoById) {
      playerRef.current.loadVideoById({
        videoId: videoId,
        startSeconds: 0,
      });

      // Cập nhật state
      setVideoState((prev) => ({
        ...prev,
        currentVideoId: videoId,
        isPaused: false,
        isBuffering: true,
      }));
    }
  };

  // Nếu video bị tắt, hiển thị component RecordingStudio
  if (isVideoOff) {
    return <RecordingStudio />;
  }

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

      {/* Hiển thị trạng thái kết nối socket */}
      {connectionStatusIndicator()}

      {/* Thêm nút test cho môi trường dev */}
      {import.meta.env.DEV && !isVideoOff && (
        <div className="absolute top-16 left-4 z-50 flex flex-col gap-2">
          <button
            onClick={() => setDevTestingMode((prev) => !prev)}
            className="bg-blue-500 text-white px-3 py-1 rounded-md text-sm"
          >
            {devTestingMode ? "Tắt Dev Mode" : "Bật Dev Mode"}
          </button>

          {devTestingMode && (
            <>
              <button
                onClick={() => simulateYouTubeError(150)}
                className="bg-red-500 text-white px-3 py-1 rounded-md text-sm"
              >
                Test Lỗi 150
              </button>
              <button
                onClick={() => simulateYouTubeError(101)}
                className="bg-orange-500 text-white px-3 py-1 rounded-md text-sm"
              >
                Test Lỗi 101
              </button>

              {/* Thêm form test video ID */}
              <div className="bg-gray-800 p-2 rounded-md mt-2">
                <input
                  type="text"
                  placeholder="Nhập YouTube Video ID"
                  value={testVideoId}
                  onChange={(e) => setTestVideoId(e.target.value)}
                  className="w-full px-2 py-1 text-sm rounded mb-2 text-black"
                />
                <div className="flex gap-1">
                  <button
                    onClick={() => testVideoWithId(testVideoId)}
                    className="bg-purple-500 text-white px-2 py-1 rounded text-xs flex-1"
                  >
                    Test iframe
                  </button>
                  <button
                    onClick={() => playTestVideo(testVideoId)}
                    className="bg-green-500 text-white px-2 py-1 rounded text-xs flex-1"
                  >
                    Phát video
                  </button>
                </div>
              </div>

              {/* Hiển thị các YouTube ID thường bị lỗi 150 */}
              <div className="bg-gray-800 p-2 rounded-md mt-2 text-white text-xs">
                <p className="font-bold mb-1">Videos thường bị lỗi 150:</p>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    onClick={() => setTestVideoId("R4em3tIxwPU")}
                    className="bg-gray-700 px-1 py-0.5 rounded text-left overflow-hidden overflow-ellipsis whitespace-nowrap"
                    title="R4em3tIxwPU - Universal Music"
                  >
                    R4em3tIxwPU
                  </button>
                  <button
                    onClick={() => setTestVideoId("2xWkATdMQms")}
                    className="bg-gray-700 px-1 py-0.5 rounded text-left overflow-hidden overflow-ellipsis whitespace-nowrap"
                    title="2xWkATdMQms - Sony Music"
                  >
                    2xWkATdMQms
                  </button>
                  <button
                    onClick={() => setTestVideoId("eUtEEwp4Ig4")}
                    className="bg-gray-700 px-1 py-0.5 rounded text-left overflow-hidden overflow-ellipsis whitespace-nowrap"
                    title="eUtEEwp4Ig4 - VEVO"
                  >
                    eUtEEwp4Ig4
                  </button>
                  <button
                    onClick={() => setTestVideoId("cNjeiKrwL5E")}
                    className="bg-gray-700 px-1 py-0.5 rounded text-left overflow-hidden overflow-ellipsis whitespace-nowrap"
                    title="cNjeiKrwL5E - UMG"
                  >
                    cNjeiKrwL5E
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Test iframe popup */}
      {showTestIframe && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100]">
          <div className="bg-gray-800 p-4 rounded-lg w-full max-w-3xl">
            <div className="flex justify-between mb-4">
              <h3 className="text-white font-bold">Test YouTube Embed</h3>
              <button
                onClick={() => setShowTestIframe(false)}
                className="text-white bg-red-500 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold"
              >
                X
              </button>
            </div>

            <div className="aspect-video bg-black relative overflow-hidden rounded">
              <iframe
                src={`https://www.youtube.com/embed/${testVideoId}?enablejsapi=1&origin=${window.location.origin}&autoplay=1`}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 w-full h-full"
              ></iframe>
            </div>
          </div>
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
        {renderBackupVideo()}
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
            ? "opacity-0 pointer-events-none"
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
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/90 via-black/95 to-pink-900/90 z-[30] flex flex-col items-center justify-center">
          <div className="relative mb-8">
            <img
              src={logo}
              alt="logo"
              className="w-32 h-32 object-contain animate-[bounce_6s_ease-in-out_infinite] drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/5 to-transparent animate-[pulse_2s_ease-in-out_infinite]"></div>
          </div>

          <div className="px-8 py-4 rounded-2xl bg-black/30 backdrop-blur-sm border border-white/10 shadow-[0_0_15px_rgba(0,0,0,0.3)] mb-8">
            <p className="text-white text-xl font-bold text-center animate-bounce">
              {cuteMessages[currentMessageIndex]}
            </p>
          </div>

          {/* Danh sách nhạc trending */}
          <div className="w-full max-w-3xl px-6">
            <div className="bg-black/40 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <h3 className="text-white text-xl font-bold mb-6 flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 mr-2 text-pink-500"
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {trendingSongs.map((song, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors group border border-white/5"
                  >
                    <div className="flex items-center flex-1 min-w-0">
                      <span className="text-2xl font-bold text-white/50 w-8 shrink-0">
                        {index + 1}
                      </span>
                      <div className="ml-4 truncate">
                        <p className="text-white font-semibold group-hover:text-pink-500 transition-colors truncate">
                          {song.title}
                        </p>
                        <div className="flex items-center gap-2">
                          <p className="text-white/60 text-sm truncate">
                            {song.artist}
                          </p>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/80">
                            {song.genre}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center text-white/60 text-sm ml-4 shrink-0">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 mr-1"
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

      {/* Powered by Jozo - xuất hiện trong 4 giây đầu tiên, giữa bài và khi kết thúc */}
      {(showPoweredBy || !videoState.nowPlayingData) && (
        <div className="absolute bottom-3 right-3 z-50">
          <div className="bg-black/75 px-3 py-1.5 rounded-lg shadow-lg border border-pink-500/30 flex items-center animate-[pulse_3s_ease-in-out_infinite]">
            <span className="text-white text-sm font-medium mr-1">
              Powered by
            </span>
            <span className="text-gradient bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-purple-500 font-bold text-sm">
              Jozo
            </span>
            <div className="h-2 w-2 rounded-full bg-pink-500 ml-1.5 animate-[ping_1.5s_ease-in-out_infinite]"></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default YouTubePlayer;
