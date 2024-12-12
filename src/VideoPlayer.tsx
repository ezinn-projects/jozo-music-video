import React, { useEffect, useRef, useState } from "react";

interface YouTubePlayerProps {
  videoId: string;
  logoSrc?: string; // Đường dẫn logo tùy chọn
}

const YouTubePlayer: React.FC<YouTubePlayerProps> = ({ videoId, logoSrc }) => {
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

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
        },
        events: {
          onReady: () => {
            // Tự động fullscreen khi video bắt đầu
            enterFullscreen();
            showOverlay(3); // Che logo trong 3 giây đầu
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

    // Cleanup khi component unmount
    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  }, [videoId]);

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "100vw", height: "100vh" }}
    >
      {/* IFrame YouTube */}
      <div id="youtube-player" style={{ width: "100%", height: "100%" }}></div>

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
      >
        {isPaused && (
          <p style={{ color: "white", fontSize: "20px" }}>Video Paused</p>
        )}
      </div>

      <div
        className="absolute bottom-0 right-0 bg-white"
        style={{
          width: "110px",
          height: "40px",
        }}
      />
    </div>
  );
};

export default YouTubePlayer;
