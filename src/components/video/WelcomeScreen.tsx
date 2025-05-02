import React from "react";
import { logo } from "../../assets";
import { CUTE_MESSAGES } from "./constants";
import TrendingSongsList from "./TrendingSongsList";

interface WelcomeScreenProps {
  currentMessageIndex: number;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  currentMessageIndex,
}) => {
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-purple-900/90 via-black/95 to-pink-900/90 z-[30] flex flex-col items-center justify-center">
      <div className="relative mb-8">
        <img
          src={logo}
          alt="logo"
          className="w-32 h-32 object-contain animate-[bounce_6s_ease-in-out_infinite] drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/5 to-transparent animate-[pulse_2s_ease-in-out_infinite]"></div>
      </div>

      <div className="px-8 py-4 rounded-2xl bg-black/30 backdrop-blur-sm border border-white/10 shadow-[0_0_15px_rgba(0,0,0,0.3)] mb-8">
        <p className="text-white text-xl font-bold text-center animate-bounce">
          {CUTE_MESSAGES[currentMessageIndex]}
        </p>
      </div>

      {/* Trending songs list */}
      <TrendingSongsList />
    </div>
  );
};

export default WelcomeScreen;
