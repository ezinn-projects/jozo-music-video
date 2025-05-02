/* eslint-disable @typescript-eslint/no-explicit-any */
import { FC, useEffect, useRef, useState, useMemo } from "react";
import { YouTubePlayerRef } from "./types";

// Biến global để theo dõi trạng thái
let isYouTubeApiLoaded = !!(window as any).YT && !!(window as any).YT.Player;
let globalYouTubePlayer: any = null;

interface YouTubePlayerIframeProps {
  playerRef: React.RefObject<YouTubePlayerRef>;
  videoId: string | undefined;
  onReady: (event: any) => void;
  onStateChange: (event: any) => void;
  onError: (event: any) => void;
  onPlaybackQualityChange: (event: any) => void;
  isFallback: boolean;
  fallbackVideoId: string;
  startSeconds?: number;
  showControls?: boolean;
}

const YouTubePlayerIframe: FC<YouTubePlayerIframeProps> = ({
  playerRef,
  videoId,
  onReady,
  onStateChange,
  onError,
  onPlaybackQualityChange,
  isFallback,
  fallbackVideoId,
  startSeconds,
  showControls = false,
}) => {
  const [apiLoaded, setApiLoaded] = useState(isYouTubeApiLoaded);
  const lastVideoIdRef = useRef<string | undefined>(videoId);
  const initializingRef = useRef(false);
  const playerInitializedRef = useRef(false);

  // Wrapper function for onReady to ensure playerRef is properly set
  const handleOnReady = (event: any) => {
    try {
      // Retrieve the player object
      const player = event.target;

      // Test each method by actually calling it (in a safe way)
      // This ensures the 'this' context is valid
      let hasValidMethods = false;

      try {
        // // Try to get current video data (this is a common source of 'this is undefined' errors)
        // // eslint-disable-next-line @typescript-eslint/no-unused-vars
        // const videoData = player.getVideoData();
        // // Try to get current time and duration (just to verify they work with proper 'this' binding)
        // // eslint-disable-next-line @typescript-eslint/no-unused-vars
        // const currentTime = player.getCurrentTime();
        // // eslint-disable-next-line @typescript-eslint/no-unused-vars
        // const duration = player.getDuration();

        // Make sure the methods needed for playback control exist
        hasValidMethods =
          typeof player.seekTo === "function" &&
          typeof player.playVideo === "function" &&
          typeof player.pauseVideo === "function" &&
          typeof player.loadVideoById === "function" &&
          typeof player.setPlaybackQuality === "function";

        console.log("YouTube player successfully initialized with methods");
      } catch (methodError) {
        console.error("Error verifying YouTube player methods:", methodError);
        hasValidMethods = false;
      }

      if (!hasValidMethods) {
        console.error(
          "YouTube player is missing required methods or has invalid context"
        );

        // Try to recreate the player if methods are missing or invalid
        if (!initializingRef.current) {
          setTimeout(() => {
            console.log("Attempting to reinitialize YouTube player...");
            initializingRef.current = false;
            playerInitializedRef.current = false;
            // This will trigger reinit on next cycle
          }, 1000);
        }
        return;
      }

      // Ép chất lượng video cao nhất khi player sẵn sàng (chỉ khi có video thực, không phải fallback)
      if (videoId && player.setPlaybackQuality) {
        try {
          // Áp dụng nhiều phương pháp buộc chất lượng HD
          console.log("===== FORCING HD 1080p QUALITY (onReady) =====");

          // Phương pháp 1: setPlaybackQuality trực tiếp
          player.setPlaybackQuality("hd1080");

          // Phương pháp 2: setPlaybackQualityRange nếu có
          if (player.setPlaybackQualityRange) {
            player.setPlaybackQualityRange("hd1080", "hd1080");
          }

          // Phương pháp 3: Thực hiện nhiều lần với các mức độ khác nhau
          const qualities = ["hd1080", "hd720", "large"];
          qualities.forEach((quality, index) => {
            setTimeout(() => {
              try {
                console.log(
                  `Setting quality to ${quality} (attempt ${index + 1})`
                );
                player.setPlaybackQuality(quality);
              } catch (e) {
                console.debug(`Error setting quality to ${quality}:`, e);
              }
            }, index * 500);
          });

          // Phương pháp 4: Lặp lại nhiều lần để đảm bảo
          for (let i = 1; i <= 5; i++) {
            setTimeout(() => {
              try {
                console.log(`Enforcing HD 1080p (attempt ${i})`);
                player.setPlaybackQuality("hd1080");
              } catch {
                // Ignore errors
              }
            }, i * 1000); // 1s, 2s, 3s, 4s, 5s
          }
        } catch (qualityError) {
          console.warn("Failed to set HD quality:", qualityError);
        }
      }

      // Update references only when we've verified the methods work
      // @ts-expect-error - bỏ qua lỗi TypeScript
      playerRef.current = player;
      globalYouTubePlayer = player;
      playerInitializedRef.current = true;

      // Call the original onReady handler with the working player
      onReady(event);
    } catch (error) {
      console.error("Fatal error in YouTube player onReady handler:", error);
    }
  };

  useEffect(() => {
    // Nếu đã có player toàn cục và chưa có player ref, gán nó
    if (
      globalYouTubePlayer &&
      !playerRef.current &&
      !playerInitializedRef.current
    ) {
      try {
        // Verify the global player has required methods
        const hasAllMethods =
          typeof globalYouTubePlayer.getVideoData === "function" &&
          typeof globalYouTubePlayer.getCurrentTime === "function" &&
          typeof globalYouTubePlayer.getDuration === "function";

        if (hasAllMethods) {
          // @ts-expect-error - bỏ qua lỗi TypeScript
          playerRef.current = globalYouTubePlayer;
          playerInitializedRef.current = true;
        } else {
          console.warn("Global YouTube player exists but has missing methods");
          globalYouTubePlayer = null; // Reset the global player reference
        }
      } catch (error) {
        console.error("Error assigning global YouTube player:", error);
      }
    }

    // Nếu API đã được tải
    if ((window as any).YT && (window as any).YT.Player && !apiLoaded) {
      isYouTubeApiLoaded = true;
      setApiLoaded(true);
    }

    // Nếu video ID không thay đổi và player đã tồn tại, không làm gì cả
    if (
      lastVideoIdRef.current === videoId &&
      playerRef.current &&
      playerInitializedRef.current
    ) {
      return;
    }

    // Nếu đang khởi tạo, tránh gọi nhiều lần
    if (initializingRef.current) {
      return;
    }

    lastVideoIdRef.current = videoId;

    const PROD_ORIGIN = "https://video.jozo.com.vn";
    const ORIGIN = import.meta.env.PROD ? PROD_ORIGIN : window.location.origin;

    // Hàm khởi tạo player
    const initializePlayer = () => {
      if (initializingRef.current) return;
      initializingRef.current = true;

      // Nếu player đã tồn tại, chỉ cần load video mới
      if (playerRef.current && playerInitializedRef.current) {
        try {
          const currentVideoId = playerRef.current.getVideoData?.()?.video_id;
          if (videoId && currentVideoId !== videoId) {
            console.log("Tải video mới vào player hiện có:", videoId);
            playerRef.current.loadVideoById({
              videoId: videoId,
              startSeconds: 0,
            });
          }
          initializingRef.current = false;
          return;
        } catch (e) {
          console.error("Lỗi khi tải video mới:", e);
          // Có lỗi, reset trạng thái player
          playerInitializedRef.current = false;
        }
      }

      // Kiểm tra container
      const playerContainer = document.getElementById("youtube-player");
      if (!playerContainer) {
        console.error("Không tìm thấy container YouTube player");
        initializingRef.current = false;
        return;
      }

      // Tạo player mới
      try {
        if (
          globalYouTubePlayer &&
          typeof globalYouTubePlayer.destroy === "function"
        ) {
          try {
            globalYouTubePlayer.destroy();
          } catch (error) {
            console.warn("Error destroying previous player:", error);
          }
          globalYouTubePlayer = null;
        }

        console.log(
          "Khởi tạo YouTube player mới với video:",
          videoId || fallbackVideoId
        );

        // Thiết lập tham số player
        const hdPlayerVars = {
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
          // Ép chất lượng cao NHẤT có thể
          vq: "hd1080",
          hd: 1,
          highres: 1,
          html5: 1,
          suggestedQuality: "hd1080",
          loop: videoId ? 0 : 1,
          playlist: !videoId ? fallbackVideoId : undefined,
          quality: "hd1080",
          hl: "vi",
          cc_load_policy: 0,
          color: "white",
          origin: ORIGIN,
        };

        // Khởi tạo player với tham số đã thiết lập
        globalYouTubePlayer = new (window as any).YT.Player("youtube-player", {
          videoId: videoId || (isFallback ? fallbackVideoId : undefined),
          host: "https://www.youtube.com",
          playerVars: hdPlayerVars,
          events: {
            onReady: handleOnReady,
            onStateChange,
            onPlaybackQualityChange: (event: {
              data: string;
              target?: any;
            }) => {
              // Gọi hàm callback gốc
              onPlaybackQualityChange(event);

              // Ghi log chất lượng hiện tại
              console.log("Quality change detected:", event.data);

              // Cố gắng buộc chất lượng HD nếu chưa phải là hd1080
              if (event.data !== "hd1080" && event.target?.setPlaybackQuality) {
                console.log("Quality not hd1080, forcing to hd1080...");

                // Thử đổi cả URL iframe để buộc chất lượng cao
                try {
                  const iframe = document.querySelector(
                    "#youtube-player iframe"
                  ) as HTMLIFrameElement;
                  if (iframe) {
                    // Lưu vị trí hiện tại
                    const currentTime = event.target.getCurrentTime?.() || 0;
                    // Tạo URL mới với tham số bổ sung
                    const src = iframe.src;
                    const newSrc = src.includes("?")
                      ? `${src}&vq=hd1080&hd=1&highres=1&quality=highres`
                      : `${src}?vq=hd1080&hd=1&highres=1&quality=highres`;

                    if (newSrc !== src) {
                      console.log("Reloading iframe with stronger HD params");
                      iframe.src = newSrc;

                      // Sau khi load lại, cần seek đến vị trí cũ
                      setTimeout(() => {
                        if (event.target?.seekTo) {
                          event.target.seekTo(currentTime, true);
                        }
                      }, 1000);
                    }
                  }
                } catch (e) {
                  console.error(
                    "Error updating iframe during quality change:",
                    e
                  );
                }

                try {
                  event.target.setPlaybackQuality("hd1080");

                  // Thêm một timeout để kiểm tra lại sau một khoảng thời gian
                  setTimeout(() => {
                    try {
                      if (event.target?.setPlaybackQuality) {
                        console.log("Re-enforcing hd1080 after timeout");
                        event.target.setPlaybackQuality("hd1080");
                      }
                    } catch (e) {
                      console.error("Error re-enforcing quality:", e);
                    }
                  }, 500);
                } catch (e) {
                  console.error("Error forcing quality in handler:", e);
                }
              }
            },
            onError,
          },
        });

        initializingRef.current = false;
      } catch (error) {
        console.error("Lỗi khởi tạo YouTube player:", error);
        initializingRef.current = false;
        playerInitializedRef.current = false;
      }
    };

    // Tải API YouTube nếu chưa có
    if (!apiLoaded && !(window as any).YT) {
      // Thêm script tag nếu chưa có
      if (
        !document.querySelector(
          'script[src="https://www.youtube.com/iframe_api"]'
        )
      ) {
        console.log("Đang tải YouTube API script");
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";

        tag.onload = () => {
          console.log("Tải YouTube API thành công");
          isYouTubeApiLoaded = true;
          setApiLoaded(true);
        };

        const firstScriptTag = document.getElementsByTagName("script")[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

        // Đăng ký callback
        (window as any).onYouTubeIframeAPIReady = () => {
          console.log("YouTube iframe API đã sẵn sàng");
          isYouTubeApiLoaded = true;
          setApiLoaded(true);
          initializePlayer();
        };
      }
    } else if (apiLoaded || ((window as any).YT && (window as any).YT.Player)) {
      // API đã tải, khởi tạo player ngay
      initializePlayer();
    }

    // Không cần cleanup để tránh tái tạo player
    return () => {
      initializingRef.current = false;
    };
  }, [
    videoId,
    apiLoaded,
    playerRef,
    onReady,
    onStateChange,
    onError,
    onPlaybackQualityChange,
    isFallback,
    fallbackVideoId,
  ]);

  // Sử dụng interval để ép chất lượng cao liên tục
  useEffect(() => {
    if (!videoId || isFallback) return;

    // Hàm để ép chất lượng cao
    const enforceHighQuality = () => {
      if (playerRef.current && playerInitializedRef.current) {
        try {
          // Ép chất lượng theo nhiều cách khác nhau
          if (playerRef.current.setPlaybackQuality) {
            // Thử tất cả các loại chất lượng HD
            console.log("Setting quality to hd1080");
            playerRef.current.setPlaybackQuality("hd1080");

            // Backup: thử các mức chất lượng khác nhau
            setTimeout(() => {
              if (playerRef.current) {
                try {
                  console.log("Setting quality to large");
                  playerRef.current.setPlaybackQuality("large");
                } catch (e) {
                  console.debug("Error setting large quality:", e);
                }
              }
            }, 500);
          }

          // Thử cách khác: đặt chất lượng qua đối tượng player
          try {
            if (playerRef.current.setPlaybackQualityRange) {
              playerRef.current.setPlaybackQualityRange("hd1080", "hd1080");
            }
          } catch (e) {
            console.debug("Error setting quality range:", e);
          }

          // Nếu có thể, thiết lập chất lượng thủ công qua postMessage
          const iframe = document.querySelector(
            "#youtube-player iframe"
          ) as HTMLIFrameElement | null;
          if (iframe && iframe.contentWindow) {
            // Gửi thông điệp đến YouTube player
            iframe.contentWindow.postMessage(
              JSON.stringify({
                event: "command",
                func: "setPlaybackQuality",
                args: ["hd1080"],
              }),
              "*"
            );

            // Thử gửi một thông điệp khác để buộc HD
            iframe.contentWindow.postMessage(
              JSON.stringify({
                event: "command",
                func: "setPlaybackQualityRange",
                args: ["hd1080", "hd1080"],
              }),
              "*"
            );
          }
        } catch (e) {
          // Chỉ log lỗi ở cấp độ debug
          console.debug("Error enforcing quality:", e);
        }
      }
    };

    // Ép chất lượng khi mới mount
    setTimeout(enforceHighQuality, 1000);

    // Thiết lập interval để liên tục kiểm tra và ép chất lượng cao
    const qualityInterval = setInterval(enforceHighQuality, 3000);

    return () => {
      clearInterval(qualityInterval);
    };
  }, [videoId, isFallback, playerRef]);

  // Tuỳ chỉnh trực tiếp URL để ép chất lượng cao
  useEffect(() => {
    if (!videoId || isFallback) return;

    // Đợi một chút cho iframe được tạo
    const timeoutId = setTimeout(() => {
      const iframe = document.querySelector(
        "#youtube-player iframe"
      ) as HTMLIFrameElement | null;
      if (!iframe) return;

      try {
        // Lấy URL hiện tại
        let src = iframe.src;

        // Thêm các tham số chất lượng cao nếu chưa có
        const qualityParams = [
          "hd=1",
          "vq=hd1080",
          "iv_load_policy=3",
          "modestbranding=1",
          "rel=0",
          "showinfo=0",
          "fs=1",
        ];

        qualityParams.forEach((param) => {
          if (!src.includes(param.split("=")[0] + "=")) {
            src += (src.includes("?") ? "&" : "?") + param;
          }
        });

        // Cập nhật lại URL iframe
        if (src !== iframe.src) {
          console.log("Modifying YouTube iframe URL to force HD quality:", src);
          iframe.src = src;
        }
      } catch (e) {
        console.error("Error updating iframe src for quality:", e);
      }
    }, 1000);

    // Kiểm tra và ép buộc chất lượng mỗi 3 giây
    const qualityCheckInterval = setInterval(() => {
      const iframe = document.querySelector(
        "#youtube-player iframe"
      ) as HTMLIFrameElement | null;

      if (iframe && iframe.contentWindow) {
        try {
          // Buộc chất lượng HD bằng cách thay đổi src
          const currentSrc = iframe.src;
          // Chỉ làm mới src nếu chưa có tham số chất lượng
          if (
            !currentSrc.includes("vq=hd1080") &&
            !currentSrc.includes("hd=1")
          ) {
            const newSrc =
              currentSrc +
              (currentSrc.includes("?") ? "&" : "?") +
              "vq=hd1080&hd=1";
            console.log("Re-forcing HD quality via iframe src:", newSrc);
            iframe.src = newSrc;
          }
        } catch (e) {
          console.debug("Error in quality check interval:", e);
        }
      }
    }, 3000);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(qualityCheckInterval);
    };
  }, [videoId, isFallback]);

  // Generate the correct YouTube embed URL
  const youtubeUrl = useMemo(() => {
    if (!videoId) return "";

    // Thay đổi cách nhúng: dùng nocookie.com và thêm nhiều tham số hơn
    const url = `https://www.youtube-nocookie.com/embed/${videoId}?`;

    // Add base parameters with more quality forcing
    const params = [
      "enablejsapi=1",
      "origin=" + (typeof window !== "undefined" ? window.location.origin : ""),
      "autoplay=1",
      "rel=0",
      "modestbranding=1",
      "vq=hd1080", // Force high quality
      "hd=1", // Force HD
      "highres=1", // Try highres param
      "quality=highres", // Additional quality param
      "iv_load_policy=3",
      "playsinline=1",
      `controls=${showControls ? 1 : 0}`, // Hiển thị controls nếu được yêu cầu
      "fs=1",
      "showinfo=0",
      "hl=vi",
      "cc_load_policy=0",
      "color=white",
    ];

    // Add custom starting point if provided
    if (startSeconds) {
      params.push(`start=${startSeconds}`);
    }

    return url + params.join("&");
  }, [videoId, startSeconds, showControls]);

  return (
    <div
      id="youtube-player"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {apiLoaded ? (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            overflow: "hidden",
          }}
        >
          <iframe
            id={`youtube-player-iframe-${videoId}`}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: "1920px",
              height: "1080px",
              transform: "translate(-50%, -50%) scale(1.01)",
              transformOrigin: "center center",
            }}
            src={youtubeUrl}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            title="YouTube video player"
            referrerPolicy="origin"
          ></iframe>
        </div>
      ) : (
        <div
          id="youtube-player"
          className="absolute top-0 left-0 w-full h-full"
        />
      )}
    </div>
  );
};

export default YouTubePlayerIframe;
