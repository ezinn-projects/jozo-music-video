/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import io, { Socket } from "socket.io-client";
import { logo } from "./assets";
import { PlaybackState } from "./constants/enum";

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
  const [isPaused, setIsPaused] = useState(true);
  // const [timeRemaining, setTimeRemaining] = useState<number>(630);
  const [socket, setSocket] = useState<typeof Socket | null>(null);
  const [params] = useSearchParams();
  const roomId = params.get("roomId") || "";
  const [nowPlayingData, setNowPlayingData] = useState<NowPlayingData | null>(
    null
  );
  const [isBuffering, setIsBuffering] = useState(true);

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

    socket.emit("get_now_playing", { roomId });

    socket.on("now_playing", (data: NowPlayingData) => {
      if (data) {
        console.log("data", data);
        setNowPlayingData(data);
        if (playerRef.current) {
          if (data.video_id !== playerRef.current.getVideoData().video_id) {
            playerRef.current.loadVideoById({
              videoId: data.video_id,
              startSeconds: data.currentTime,
            });
            socket.emit("video_ready", {
              roomId: roomId,
              videoId: data.video_id,
            });
          } else {
            const currentServerTime =
              data.timestamp + (Date.now() - data.timestamp) / 1000;
            const targetTime =
              data.currentTime + (currentServerTime - data.timestamp);
            playerRef.current.seekTo(targetTime, true);
            playerRef.current.playVideo();
          }
        }
      }
    });

    // Lắng nghe sự kiện video_event từ ControlBar
    socket.on("video_event", (data: any) => {
      if (playerRef.current) {
        switch (data.event) {
          case PlaybackState.PLAY:
            playerRef.current.seekTo(data.currentTime, true);
            playerRef.current.playVideo();
            setIsPaused(false);
            break;
          case PlaybackState.PAUSE:
            playerRef.current.pauseVideo();
            setIsPaused(true);
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

    return () => {
      socket.off("now_playing");
      socket.off("video_event");
      socket.off("next_song");
    };
  }, [socket, roomId]);

  useEffect(() => {
    // Thêm script YouTube API
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName("script")[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    (window as any).onYouTubeIframeAPIReady = () => {
      playerRef.current = new (window as any).YT.Player("youtube-player", {
        videoId: nowPlayingData?.video_id,
        playerVars: {
          autoplay: 1,
          controls: 1,
          modestbranding: 1,
          rel: 0,
          fs: 1,
          iv_load_policy: 3,
          enablejsapi: 1,
          origin: window.location.origin,
          disablekb: 1, // Thêm vào để vô hiệu hóa điều khiển bàn phím
          showinfo: 0, // Thêm vào để ẩn thông tin video
          vq: "hd1080",
        },
        events: {
          onReady: (event: any) => {
            event.target.setPlaybackQuality("hd1080");
            event.target.playVideo();
            if (nowPlayingData) {
              const currentServerTime =
                nowPlayingData.timestamp +
                (Date.now() - nowPlayingData.timestamp) / 1000;
              const targetTime =
                nowPlayingData.currentTime +
                (currentServerTime - nowPlayingData.timestamp);
              event.target.seekTo(targetTime, true);
            }
            socket?.emit("video_ready", {
              roomId: roomId,
              videoId: nowPlayingData?.video_id,
            });
            setIsPaused(false);
          },
          onStateChange: (event: any) => handleStateChange(event),
          onPlaybackQualityChange: (event: any) => {
            console.log("Quality changed:", event.data);
          },
        },
      });
    };

    // const timer = setInterval(() => {
    //   setTimeRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    // }, 1000);

    // return () => clearInterval(timer);
  }, [nowPlayingData?.video_id, roomId]);

  const handleStateChange = (event: any) => {
    if (!playerRef.current || !socket) return;

    const YT = (window as any).YT.PlayerState;
    let currentTime;

    switch (event.data) {
      case YT.BUFFERING:
        setIsBuffering(true);
        break;
      case YT.PLAYING:
        setIsBuffering(false);
        setIsPaused(false);
        currentTime = playerRef.current.getCurrentTime();
        socket.emit("sync_time", {
          roomId,
          videoId: playerRef.current.getVideoData().video_id,
          currentTime,
          timestamp: Date.now(),
        });
        break;
      case YT.PAUSED:
        setIsPaused(true);
        break;
    }
  };

  useEffect(() => {
    if (!socket || !playerRef.current || isBuffering || isPaused) return;

    const syncInterval = setInterval(() => {
      const currentTime = playerRef.current.getCurrentTime();
      socket.emit("sync_time", {
        roomId,
        videoId: playerRef.current.getVideoData().video_id,
        currentTime,
        timestamp: Date.now(),
      });
    }, 1000);

    return () => clearInterval(syncInterval);
  }, [socket, isBuffering, isPaused]);

  // const formatTime = (seconds: number): string => {
  //   const hours = Math.floor(seconds / 3600);
  //   const minutes = Math.floor((seconds % 3600) / 60);
  //   const remainingSeconds = seconds % 60;

  //   return `${hours.toString().padStart(2, "0")}:${minutes
  //     .toString()
  //     .padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
  // };

  console.log("isPaused", isPaused);

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "100vw", height: "100vh" }}
    >
      {/* IFrame YouTube */}
      <div id="youtube-player" style={{ width: "100%", height: "100%" }}></div>

      <div className="absolute bottom-[15px] right-[15px] w-[110px] h-[42px] bg-black">
        <img src={logo} alt="logo" className="w-full h-full" />
      </div>
    </div>
  );
};

export default YouTubePlayer;
