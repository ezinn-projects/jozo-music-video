import React, { useRef, useEffect } from "react";
import Hls from "hls.js";

const HLSPlayer = ({ src }: { src: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Thêm proxy để xử lý CORS
    const proxy = "https://cors-anywhere.herokuapp.com/";
    const proxiedSrc = `${proxy}${src}`;

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(proxiedSrc); // Sử dụng URL có proxy
      hls.attachMedia(videoRef.current as HTMLMediaElement);
      console.log("hls :>> ", hls);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log("HLS manifest loaded, ready to play.");
        videoRef.current?.play();
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error(`HLS error: ${data.type}`, data);
      });

      return () => {
        hls.destroy(); // Cleanup when component unmounts
      };
    } else if (videoRef.current?.canPlayType("application/vnd.apple.mpegurl")) {
      videoRef.current.src = proxiedSrc; // Sử dụng URL có proxy
      videoRef.current?.play();
    }
  }, [src]);

  return (
    <div>
      <video
        ref={videoRef}
        controls
        style={{ width: "100%", height: "auto" }}
      ></video>
    </div>
  );
};

export default HLSPlayer;
