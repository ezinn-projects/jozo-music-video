import { useEffect, useRef } from "react";
import io, { Socket } from "socket.io-client";

const App = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const socketRef = useRef<typeof Socket | null>(null);

  useEffect(() => {
    // Kết nối WebSocket
    socketRef.current = io("http://localhost:8080", {
      query: { roomId: "room1" }, // Kết nối với room tương ứng
    });
    // full screen
    // videoRef.current?.requestFullscreen();

    // Lắng nghe các lệnh từ WebSocket
    socketRef.current.on("command", (payload: any) => {
      console.log("Command received:", payload);

      switch (payload.action) {
        case "play":
          videoRef.current?.play();
          break;
        case "pause":
          videoRef.current?.pause();
          break;
        case "seek":
          if (videoRef.current) {
            videoRef.current.currentTime = payload.data || 0;
          }
          break;
        default:
          console.log("Unknown action:", payload.action);
      }
    });

    // Dọn dẹp khi component bị unmount
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  return (
    <video
      ref={videoRef}
      controls={false}
      style={{ width: "100%", height: "auto" }}
      src="https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4" // Thay thế bằng URL video của bạn
    >
      Your browser does not support the video tag.
    </video>
  );
};

export default App;
