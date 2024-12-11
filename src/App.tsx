import { useEffect, useRef, useState } from "react";
import io, { Socket } from "socket.io-client";

const App = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const socketRef = useRef<typeof Socket | null>(null);
  const [videoSrc, setVideoSrc] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
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

  const handleAudioClick = () => {
    if (videoRef.current && isPlaying) {
      videoRef.current.play().catch((error) => {
        console.log("Audio playback failed:", error);
      });
    }
  };

  return (
    <div className="flex flex-col items-center" onClick={handleAudioClick}>
      {videoSrc ? (
        <>
          <video
            ref={videoRef}
            controls={false}
            className="w-full h-auto"
            src={videoSrc}
          >
            Your browser does not support the video tag.
          </video>

          <video controls autoPlay className="hidden" ref={videoRef}>
            <source
              src="https://rr2---sn-8pxuuxa-nbo6s.googlevideo.com/videoplayback?expire=1733904057&ei=WfJYZ-3pC8iossUP0K_LyQ0&ip=115.73.219.185&id=o-AIwYeZaWF4hyepnqnUnQ5m1ROuZ9PG-RB2I_gC_xEZT7&itag=140&source=youtube&requiressl=yes&xpc=EgVo2aDSNQ%3D%3D&met=1733882457%2C&mh=AD&mm=31%2C26&mn=sn-8pxuuxa-nbo6s%2Csn-30a7yney&ms=au%2Conr&mv=m&mvi=2&pl=21&rms=au%2Cau&initcwndbps=2053750&bui=AQn3pFTDGTlrs1OJuL5AVt0YxdSegsr-daZ1tQjSJ_5xOiQGYouWaeNNHiJMC2XVgPOKsSGsLD8BqeuZ&spc=qtApATDWM83Sv9yeaMNAH0jvQoIuASYO6bJo7ch_qhYEXYw&vprv=1&svpuc=1&mime=audio%2Fmp4&rqh=1&gir=yes&clen=5088622&dur=314.374&lmt=1733722581243779&mt=1733882216&fvip=4&keepalive=yes&fexp=51326932%2C51335594%2C51347747&c=IOS&txp=6218224&sparams=expire%2Cei%2Cip%2Cid%2Citag%2Csource%2Crequiressl%2Cxpc%2Cbui%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Crqh%2Cgir%2Cclen%2Cdur%2Clmt&sig=AJfQdSswRAIgCeOG6aCa0ZM8K1x352OO_lSdErOwfEobyZHfzgHSAR0CIEqq55xfidNBizSBNVHeu5K9z0UpX-xbS08d_XwzlX6l&lsparams=met%2Cmh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Crms%2Cinitcwndbps&lsig=AGluJ3MwRQIhAM3OdaROiXw-wVHxPO02qx5Vk8dGnu6CARe6qcA0DjI2AiATJw7QxeSF2RplD0otnt6QRukcUmXKC_fkdcpxlacacQ%3D%3D"
              type="audio/mp4"
            />
          </video>
        </>
      ) : (
        <div>Chọn bài hát</div>
      )}
    </div>
  );
};

export default App;
