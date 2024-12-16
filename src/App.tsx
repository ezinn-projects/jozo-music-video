import { useEffect, useRef, useState } from "react";
import io, { Socket } from "socket.io-client";
import YouTubePlayer from "./VideoPlayer";
import axios from "axios";

const App = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // const audioRef = useRef<HTMLAudioElement | null>(null);
  const socketRef = useRef<typeof Socket | null>(null);
  // const [videoSrc, setVideoSrc] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const params = new URLSearchParams(window.location.search);
      const paramsObject: { [key: string]: string } = {};
      params.forEach((value, key) => {
        paramsObject[key] = value;
      });
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_API_URL}/room-music/${
            paramsObject.roomId
          }/now-playing`
        );
        console.log("response", response);
      } catch (error) {
        console.error("Lỗi khi lấy thông tin bài hát:", error);
      }

      socketRef.current = io(import.meta.env.VITE_SOCKET_URL, {
        query: { roomId: paramsObject.roomId },
      });

      socketRef.current.on(
        "play_song",
        (payload: { url: string; timestamp: number }) => {
          // setVideoSrc(payload.url);
          setIsPlaying(true);

          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              videoRef.current!.currentTime = payload.timestamp;
              videoRef.current!.play().catch((error) => {
                console.log("Audio playback failed:", error);
              });
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
            console.log("Audio playback failed:", error);
          });
          setIsPlaying(true);
        }
      });

      return () => {
        socketRef.current?.disconnect();
      };
    };

    fetchData();
  }, []);

  // Lắng nghe sự kiện click trên document
  useEffect(() => {
    const handleClick = () => {
      if (videoRef.current && isPlaying) {
        videoRef.current?.play();
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

  return <YouTubePlayer videoId="LoKtEI9RONw" />;
};

export default App;
