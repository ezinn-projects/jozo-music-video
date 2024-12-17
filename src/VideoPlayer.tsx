/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef, useState } from "react";
import io, { Socket } from "socket.io-client";

interface YouTubePlayerProps {
  videoId: string;
  logoSrc?: string;
}

const YouTubePlayer: React.FC<YouTubePlayerProps> = ({ videoId, logoSrc }) => {
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // const overlayRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<number>(630);
  const [socket, setSocket] = useState<typeof Socket | null>(null);

  useEffect(() => {
    // Kết nối WebSocket
    const socketInstance = io(process.env.VITE_SOCKET_URL || "");
    setSocket(socketInstance);

    // Lắng nghe sự kiện từ server
    socketInstance.on("video_event", (data) => {
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
      socketInstance.disconnect();
    };
  }, []);

  useEffect(() => {
    // Thêm script YouTube API
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName("script")[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    (window as any).onYouTubeIframeAPIReady = () => {
      playerRef.current = new (window as any).YT.Player("youtube-player", {
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
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
            hideYouTubeButtons();
          },
          onStateChange: (event: any) => handleStateChange(event),
        },
      });
    };

    const timer = setInterval(() => {
      setTimeRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [videoId]);

  const handleStateChange = (event: any) => {
    const YT = (window as any).YT.PlayerState;
    if (!playerRef.current || !socket) return;

    if (event.data === YT.PLAYING) {
      setIsPaused(false);
      socket.emit("video_event", {
        event: "play",
        video_id: videoId,
        current_time: playerRef.current.getCurrentTime(),
        timestamp: Date.now(),
      });
    } else if (event.data === YT.PAUSED) {
      setIsPaused(true);
      socket.emit("video_event", {
        event: "pause",
        video_id: videoId,
        current_time: playerRef.current.getCurrentTime(),
        timestamp: Date.now(),
      });
    } else if (event.data === YT.SEEKED) {
      socket.emit("video_event", {
        event: "seek",
        video_id: videoId,
        current_time: playerRef.current.getCurrentTime(),
        timestamp: Date.now(),
      });
    }
  };

  const hideYouTubeButtons = () => {
    const interval = setInterval(() => {
      const iframe = document.querySelector("iframe");
      if (iframe) {
        const iframeDocument =
          iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDocument) {
          const buttons = iframeDocument.querySelectorAll(
            ".ytp-watch-later-button, .ytp-share-button"
          );
          buttons.forEach((button) => {
            (button as HTMLElement).style.display = "none";
          });
          clearInterval(interval);
        }
      }
    }, 500);
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

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
      {logoSrc && (
        <div
          style={{
            position: "absolute",
            top: "10px",
            left: "10px",
            zIndex: 20,
          }}
        >
          <img src={logoSrc} alt="Logo" style={{ width: "100px" }} />
        </div>
      )}
    </div>
  );
};

export default YouTubePlayer;
