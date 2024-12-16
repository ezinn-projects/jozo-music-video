/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef, useState } from "react";

interface YouTubePlayerProps {
  videoId: string;
  logoSrc?: string; // Đường dẫn logo tùy chọn
}

const YouTubePlayer: React.FC<YouTubePlayerProps> = ({ videoId, logoSrc }) => {
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<number>(630); // 10 phút 30 giây = 630 giây

  useEffect(() => {
    // Thêm script YouTube API
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName("script")[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    // Khi API sẵn sàng, khởi tạo player
    (window as any).onYouTubeIframeAPIReady = () => {
      playerRef.current = new (window as any).YT.Player("youtube-player", {
        videoId: videoId,
        playerVars: {
          autoplay: 1, // Tự động phát
          controls: 0, // Ẩn điều khiển
          modestbranding: 1, // Ẩn logo nhỏ
          rel: 0, // Không hiển thị video liên quan
          fs: 1, // Bật toàn màn hình
          iv_load_policy: 3, // Ẩn chú thích
          enablejsapi: 1, // API JS cho phép điều khiển
          origin: window.location.origin, // Nguồn hợp lệ
        },
        events: {
          onReady: (event: any) => {
            event.target.playVideo();
            enterFullscreen();
            showOverlay(3); // Che logo trong 3 giây đầu
            hideYouTubeButtons(); // Ẩn nút "Xem sau" và "Chia sẻ"
            // Thử unmute sau 0.5 giây
            setTimeout(() => {
              try {
                event.target.unMute(); // Bật âm thanh
                console.log("Unmute video sau 0.5 giây");
              } catch (error) {
                console.error("Unmute bị chặn bởi trình duyệt:", error);
              }
            }, 500);
          },
          onStateChange: (event: any) => {
            const YT = (window as any).YT.PlayerState;
            if (event.data === YT.PAUSED) {
              setIsPaused(true);
              showOverlay();
            } else if (event.data === YT.PLAYING) {
              setIsPaused(false);
              hideOverlay();
            }
          },
        },
      });
    };

    // Cleanup khi component unmount
    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  }, [videoId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
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
          clearInterval(interval); // Dừng interval sau khi ẩn xong
        }
      }
    }, 500);
  };

  const showOverlay = (timeout = 0) => {
    const overlay = overlayRef.current;
    if (overlay) {
      overlay.style.display = "flex";
      if (timeout > 0) {
        setTimeout(() => {
          overlay.style.display = "none";
        }, timeout * 1000);
      }
    }
  };

  const hideOverlay = () => {
    const overlay = overlayRef.current;
    if (overlay) {
      overlay.style.display = "none";
    }
  };

  const enterFullscreen = () => {
    const container = containerRef.current;
    if (container) {
      if (container.requestFullscreen) {
        container.requestFullscreen();
      } else if ((container as any).mozRequestFullScreen) {
        (container as any).mozRequestFullScreen();
      } else if ((container as any).webkitRequestFullscreen) {
        (container as any).webkitRequestFullscreen();
      } else if ((container as any).msRequestFullscreen) {
        (container as any).msRequestFullscreen();
      }
    }
  };

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "100vw", height: "100vh" }}
    >
      {/* IFrame YouTube */}
      <div id="youtube-player" style={{ width: "100%", height: "100%" }}></div>

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
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "white",
          }}
        />
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

      {/* Lớp phủ che logo và tên video */}
      <div
        ref={overlayRef}
        style={{
          display: "none", // Mặc định ẩn lớp phủ
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          backgroundColor: "rgba(0, 0, 0, 0.5)", // Che nền mờ
          zIndex: 10,
          pointerEvents: "none", // Không chặn thao tác video
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
        }}
      ></div>

      <div
        className="absolute bottom-[15px] right-[15px] bg-white"
        style={{
          width: "110px",
          height: "40px",
        }}
      />

      {isPaused && (
        <div
          className="absolute top-[50%] left-[50%] rounded-md translate-x-[-50%] translate-y-[-50%] bg-white"
          style={{
            width: "68px",
            height: "50px",
          }}
        />
      )}

      {/* Logo hoặc thành phần khác (nếu cần) */}
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
