import React from "react";
import { CUTE_MESSAGES } from "./constants";
import TrendingSongsList from "./TrendingSongsList";

interface WelcomeScreenProps {
  currentMessageIndex: number;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  currentMessageIndex,
}) => {
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-purple-900/90 via-black/95 to-pink-900/90 z-[30] flex flex-col">
      {/* Fixed cute message at top */}
      <div className="w-full px-4 py-2">
        <div className="px-4 py-2 rounded-xl bg-black/30 backdrop-blur-sm border border-white/10 shadow-[0_0_15px_rgba(0,0,0,0.3)]">
          <p className="text-white text-lg font-bold text-center">
            {CUTE_MESSAGES[currentMessageIndex]}
          </p>
        </div>
      </div>

      {/* Song list without scrolling */}
      <div className="flex-1 px-2 py-2">
        <TrendingSongsList />
      </div>
    </div>
  );
};

export default WelcomeScreen;
