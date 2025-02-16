/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import io, { Socket } from "socket.io-client";

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
  const [timeRemaining, setTimeRemaining] = useState<number>(630);
  const [socket, setSocket] = useState<typeof Socket | null>(null);
  const [params] = useSearchParams();
  const roomId = params.get("roomId") || "";
  const [nowPlayingData, setNowPlayingData] = useState<NowPlayingData | null>(
    null
  );

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

    socket.on("video_event", (data: any) => {
      if (playerRef.current) {
        switch (data.event) {
          case "play":
            playerRef.current.seekTo(data.current_time, true);
            playerRef.current.playVideo();
            break;
          case "pause":
            playerRef.current.pauseVideo();
            break;
          case "seek":
            playerRef.current.seekTo(data.current_time, true);
            break;
        }
      }
    });

    return () => {
      socket.off("now_playing");
      socket.off("video_event");
    };
  }, [socket, roomId, nowPlayingData?.video_id]);

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
        },
        events: {
          onReady: (event: any) => {
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
        },
      });
    };

    const timer = setInterval(() => {
      setTimeRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [nowPlayingData?.video_id, roomId]);

  const handleStateChange = (event: any) => {
    // const YT = (window as any).YT.PlayerState;
    if (!playerRef.current || !socket) return;

    console.log("event", event);

    // if (event.data === YT.PLAYING) {
    //   setIsPaused(false);
    // } else if (event.data === YT.PAUSED) {
    //   setIsPaused(true);
    // } else if (event.data === YT.SEEKED) {
    // }
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  console.log("nowPlayingData", nowPlayingData);

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "100vw", height: "100vh" }}
    >
      {/* IFrame YouTube */}
      <div id="youtube-player" style={{ width: "100%", height: "100%" }}></div>

      {/* Hiển thị thời gian */}
      <div
        className="absolute top-[14px] right-[15px]"
        style={{
          width: "135px",
          height: "45px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 1,
            color: "black",
            fontSize: "16px",
            fontWeight: "bold",
          }}
        >
          {formatTime(timeRemaining)}
        </div>
      </div>

      {/* Overlay khi video pause */}
      {isPaused && (
        <div
          className="absolute top-[50%] left-[50%] rounded-md translate-x-[-50%] translate-y-[-50%] bg-white"
          style={{
            width: "68px",
            height: "50px",
          }}
        />
      )}

      {/* Logo */}
      {isPaused && (
        <div
          style={{
            width: "100px",
            height: "100px",
            position: "absolute",
            top: "10px",
            left: "10px",
            zIndex: 20,
          }}
        />
      )}
    </div>
  );
};

export default YouTubePlayer;
