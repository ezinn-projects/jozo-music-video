import YouTubePlayer from "./VideoPlayer";

// interface SongData {
//   video_id: string;
//   title: string;
//   thumbnail: string;
//   author: string;
//   duration: number;
//   timestamp: number;
//   currentTime: number;
// }

const App = () => {
  // const [songData, setSongData] = useState<SongData | null>(null);

  // if (!songData) {
  //   return <div>Loading...</div>;
  // }

  // console.log("songData", songData);

  return <YouTubePlayer />;
};

export default App;
