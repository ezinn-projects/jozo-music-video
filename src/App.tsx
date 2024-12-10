import { useEffect, useRef, useState } from "react";
import io, { Socket } from "socket.io-client";

const App = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const socketRef = useRef<typeof Socket | null>(null);
  const [videoSrc, setVideoSrc] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!videoRef.current) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const paramsObject: { [key: string]: string } = {};
    params.forEach((value, key) => {
      paramsObject[key] = value;
    });

    socketRef.current = io(import.meta.env.VITE_SOCKET_URL, {
      query: { roomId: paramsObject.roomId },
    });

    socketRef.current.on(
      "play_song",
      (payload: { url: string; timestamp: number }) => {
        setVideoSrc(payload.url);
        setIsPlaying(true);
        videoRef.current?.play();

        if (videoRef.current) {
          videoRef.current.onloadedmetadata = () => {
            videoRef.current!.currentTime = payload.timestamp;
          };
        }
      }
    );

    socketRef.current.on("pause_song", () => {
      if (videoRef.current) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    });

    socketRef.current.on("resume_song", () => {
      if (videoRef.current) {
        videoRef.current.play().catch((error) => {
          console.log("Playback failed:", error);
        });
        setIsPlaying(true);
      }
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  // Lắng nghe sự kiện click trên document
  useEffect(() => {
    const handleClick = () => {
      if (videoRef.current && isPlaying) {
        videoRef.current.play().catch((error) => {
          console.log("Playback failed:", error);
        });
      }
    };

    document.addEventListener("click", handleClick);

    return () => {
      document.removeEventListener("click", handleClick);
    };
  }, [isPlaying]);

  return (
    <div className="flex flex-col items-center">
      <video
        ref={videoRef}
        controls={false}
        className="w-full h-auto"
        src={videoSrc}
      >
        Your browser does not support the video tag.
      </video>
    </div>
  );
};

export default App;
