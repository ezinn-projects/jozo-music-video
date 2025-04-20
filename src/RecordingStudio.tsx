import { useState, useEffect } from "react";
import { mixingStudio } from "./assets";

// Component hiển thị khi video bị tắt
export const RecordingStudio = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [audioLevels, setAudioLevels] = useState<number[]>([]);

  // Cập nhật thời gian hiện tại mỗi giây
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Tạo hiệu ứng audio level
  useEffect(() => {
    const generateRandomLevels = () => {
      const levels = Array.from({ length: 20 }, () => Math.random() * 100);
      setAudioLevels(levels);
    };

    generateRandomLevels();
    const intervalId = setInterval(generateRandomLevels, 100); // Update every 100ms

    return () => clearInterval(intervalId);
  }, []);

  // Format thời gian
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white text-center p-6 overflow-y-auto relative">
      {/* Background image with overlay */}
      <div className="absolute inset-0 z-0">
        <img
          src={mixingStudio}
          alt="Mixing Studio"
          className="w-full h-full object-cover opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/50"></div>
      </div>

      <div className="relative z-10 w-full max-w-6xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold mb-8 text-gray-100 drop-shadow-[0_0_10px_rgba(255,0,0,0.5)] animate-fadeIn animate-float">
          Phòng thu âm Jozo
        </h1>

        <div className="mb-8 p-6 bg-black/60 backdrop-blur-md rounded-lg border border-red-500/30 max-w-md mx-auto animate-slideInUp animate-float animation-delay-200">
          <div className="relative inline-block mb-4">
            <span className="inline-block text-red-500 text-2xl font-bold animate-pulse">
              ●
            </span>
            <span className="ml-2 text-2xl font-bold text-red-500 relative animate-glow">
              ON AIR
              <span className="absolute inset-0 bg-red-500 opacity-30 blur-md animate-pulse"></span>
            </span>
          </div>
          <p className="text-xl my-3 text-gray-200 animate-fadeIn animation-delay-100">
            Đang ghi âm và sản xuất
          </p>
          <p className="text-xl my-3 text-gray-200 animate-fadeIn animation-delay-200">
            Vui lòng giữ yên lặng
          </p>

          {/* Digital Clock */}
          <div className="mt-4 bg-black/70 inline-block px-4 py-2 rounded-lg border border-gray-700">
            <p className="font-mono text-lg text-green-400">
              {formatTime(currentTime)}
            </p>
            <p className="font-mono text-xs text-gray-400 mt-1">SESSION TIME</p>
          </div>
        </div>

        <div className="italic opacity-80 mt-8 animate-fadeIn animation-delay-300 animate-float animation-delay-400 bg-black/30 p-4 rounded-lg backdrop-blur-sm max-w-md mx-auto">
          <p className="my-2 hover:text-red-300 transition-colors duration-300">
            Chúng tôi đang sản xuất những bản nhạc tuyệt vời
          </p>
          <p className="my-2 hover:text-red-300 transition-colors duration-300">
            Âm nhạc và kỷ niệm - Jozo Studio
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-8 mt-8 w-full">
          <div className="bg-black/60 backdrop-blur-md rounded-lg p-6 min-w-[250px] flex-1 shadow-lg border border-white/10 hover:border-red-500/30 transition-all duration-300 transform hover:-translate-y-1 animate-slideInLeft animate-float-reverse animation-delay-300">
            <h3 className="text-red-400 mb-4 text-xl font-medium inline-block relative after:content-[''] after:absolute after:bottom-[-5px] after:left-0 after:w-full after:h-[1px] after:bg-gradient-to-r after:from-red-500/0 after:via-red-500/80 after:to-red-500/0">
              Quá Trình Sản Xuất
            </h3>
            <ul className="text-left">
              <li className="my-3 pl-6 text-gray-300 relative before:content-['⟐'] before:absolute before:left-0 before:text-red-400 hover:text-white hover:translate-x-1 transition-all duration-300">
                Tracking &amp; Recording
              </li>
              <li className="my-3 pl-6 text-gray-300 relative before:content-['⟐'] before:absolute before:left-0 before:text-red-400 hover:text-white hover:translate-x-1 transition-all duration-300">
                Mixing &amp; Mastering
              </li>
              <li className="my-3 pl-6 text-gray-300 relative before:content-['⟐'] before:absolute before:left-0 before:text-red-400 hover:text-white hover:translate-x-1 transition-all duration-300">
                Sound Engineering
              </li>
              <li className="my-3 pl-6 text-gray-300 relative before:content-['⟐'] before:absolute before:left-0 before:text-red-400 hover:text-white hover:translate-x-1 transition-all duration-300">
                Post-Production
              </li>
            </ul>
          </div>

          <div className="bg-black/60 backdrop-blur-md rounded-lg p-6 min-w-[250px] flex-1 shadow-lg border border-white/10 hover:border-red-500/30 transition-all duration-300 transform hover:-translate-y-1 animate-slideInRight animate-float animation-delay-500">
            <h3 className="text-red-400 mb-4 text-xl font-medium inline-block relative after:content-[''] after:absolute after:bottom-[-5px] after:left-0 after:w-full after:h-[1px] after:bg-gradient-to-r after:from-red-500/0 after:via-red-500/80 after:to-red-500/0">
              Thiết Bị Chuyên Nghiệp
            </h3>
            <ul className="text-left">
              <li className="my-3 pl-6 text-gray-300 relative before:content-['⟐'] before:absolute before:left-0 before:text-red-400 hover:text-white hover:translate-x-1 transition-all duration-300">
                DAW Professional
              </li>
              <li className="my-3 pl-6 text-gray-300 relative before:content-['⟐'] before:absolute before:left-0 before:text-red-400 hover:text-white hover:translate-x-1 transition-all duration-300">
                Condenser Microphones
              </li>
              <li className="my-3 pl-6 text-gray-300 relative before:content-['⟐'] before:absolute before:left-0 before:text-red-400 hover:text-white hover:translate-x-1 transition-all duration-300">
                Digital Audio Interface
              </li>
              <li className="my-3 pl-6 text-gray-300 relative before:content-['⟐'] before:absolute before:left-0 before:text-red-400 hover:text-white hover:translate-x-1 transition-all duration-300">
                Studio Monitors
              </li>
            </ul>
          </div>
        </div>

        {/* Audio Levels Visualization */}
        <div className="mt-8 bg-black/70 backdrop-blur-md p-4 rounded-lg max-w-md mx-auto border border-gray-800 animate-fadeIn animation-delay-600">
          <div className="flex items-end justify-center h-12 gap-1">
            {audioLevels.map((level, i) => (
              <div
                key={i}
                className={`w-1 rounded-sm transition-all duration-100 ${
                  level < 60
                    ? "bg-green-500"
                    : level < 85
                    ? "bg-yellow-500"
                    : "bg-red-500"
                }`}
                style={{ height: `${level}%` }}
              ></div>
            ))}
          </div>
          <p className="text-xs uppercase tracking-widest mt-2 text-gray-400">
            Audio Levels
          </p>
        </div>

        {/* Studio Controls */}
        <div className="mt-6 bg-black/70 backdrop-blur-md p-4 rounded-lg max-w-md mx-auto border border-red-500/20 animate-fadeIn animation-delay-700">
          <div className="flex flex-wrap justify-center gap-3">
            <div className="h-4 w-4 rounded-full bg-red-500 animate-pulse"></div>
            <div className="h-4 w-4 rounded-full bg-yellow-500 animate-pulse animation-delay-200"></div>
            <div className="h-4 w-4 rounded-full bg-green-500 animate-pulse animation-delay-400"></div>
          </div>
          <p className="text-xs uppercase tracking-widest mt-2 text-gray-400">
            Recording Session Active
          </p>
        </div>

        <div className="mt-6 opacity-60 animate-fadeIn animation-delay-500 animate-float animation-delay-700 bg-black/50 inline-block mx-auto py-1 px-3 rounded-full backdrop-blur-sm">
          <p className="text-sm tracking-wider hover:text-red-200 transition-colors duration-300">
            Jozo Recording Studio © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
};
