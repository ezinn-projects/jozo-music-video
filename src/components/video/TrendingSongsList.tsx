import React from "react";
import { TrendingSong } from "./types";
import { TRENDING_SONGS } from "./constants";

interface TrendingSongsListProps {
  songs?: TrendingSong[];
}

const TrendingSongsList: React.FC<TrendingSongsListProps> = ({
  songs = TRENDING_SONGS,
}) => {
  return (
    <div className="w-full max-w-3xl px-6">
      <div className="bg-black/40 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
        <h3 className="text-white text-xl font-bold mb-6 flex items-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 mr-2 text-pink-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
            />
          </svg>
          Đang Thịnh Hành
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {songs.map((song, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors group border border-white/5"
            >
              <div className="flex items-center flex-1 min-w-0">
                <span className="text-2xl font-bold text-white/50 w-8 shrink-0">
                  {index + 1}
                </span>
                <div className="ml-4 truncate">
                  <p className="text-white font-semibold group-hover:text-pink-500 transition-colors truncate">
                    {song.title}
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-white/60 text-sm truncate">
                      {song.artist}
                    </p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/80">
                      {song.genre}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center text-white/60 text-sm ml-4 shrink-0">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 mr-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
                {song.views}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TrendingSongsList;
