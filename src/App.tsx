import { useEffect, useState } from "react";
import YouTubePlayer from "./VideoPlayer";

interface SongData {
  video_id: string;
  title: string;
  thumbnail: string;
  author: string;
  duration: number;
  timestamp: number;
  currentTime: number;
}

const App = () => {
  const [songData, setSongData] = useState<SongData | null>(null);

  // useEffect(() => {
  //   const fetchRoomData = async () => {
  //     const urlParams = new URLSearchParams(window.location.search);
  //     const roomId = urlParams.get("roomId");

  //     if (!roomId) return;

  //     try {
  //       const response = await fetch(`/${roomId}/now-playing`);
  //       if (!response.ok) {
  //         throw new Error("Failed to fetch room data");
  //       }

  //       const data = await response.json();
  //       setSongData(data.result);
  //     } catch (error) {
  //       console.error("Error fetching room data:", error);
  //     }
  //   };

  //   fetchRoomData();
  // }, []);

  if (!songData) {
    return <div>Loading...</div>;
  }

  console.log("songData", songData);

  return (
    <YouTubePlayer
      videoId={songData.video_id}
      initialTime={songData.currentTime}
      songInfo={{
        title: songData.title,
        author: songData.author,
        thumbnail: songData.thumbnail,
        duration: songData.duration,
      }}
      currentTime={songData.currentTime}
    />
  );
};

export default App;
