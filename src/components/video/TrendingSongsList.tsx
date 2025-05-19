import React from "react";
import { TRENDING_SONGS } from "./constants";

interface TrendingSong {
  title: string;
  artist: string;
  views: string;
  genre: string;
  category: "summer" | "school";
  description: string;
}

interface TrendingSongsListProps {
  songs?: TrendingSong[];
}

const TrendingSongsList: React.FC<TrendingSongsListProps> = ({
  songs = TRENDING_SONGS,
}) => {
  // Split songs into categories
  const summerSongs = songs.filter((song) => song.category === "summer");
  const schoolSongs = songs.filter((song) => song.category === "school");

  return (
    <div className="w-full max-w-4xl px-2">
      <div className="grid grid-cols-2 gap-2">
        {/* Summer Songs Box */}
        <div className="bg-black/40 backdrop-blur-sm rounded-lg p-2 border border-white/10">
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-6 h-6 flex items-center justify-center bg-gradient-to-r from-yellow-500 to-orange-500 rounded">
              <span className="text-sm">🌞</span>
            </div>
            <h2 className="text-base font-bold text-white">Mùa Hè</h2>
          </div>

          <div className="space-y-1.5">
            {summerSongs.map((song, index) => (
              <div
                key={index}
                className="bg-white/5 rounded p-1.5 border border-white/5"
              >
                <div className="flex items-start gap-2">
                  {/* Song Number */}
                  <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded text-sm font-bold text-white/80">
                    {index + 1}
                  </div>

                  {/* Song Info */}
                  <div className="flex-grow min-w-0">
                    <h3 className="text-sm font-bold text-white leading-tight">
                      {song.title}
                    </h3>
                    <p className="text-white/70 text-xs leading-tight">
                      {song.artist}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-white/90">
                        {song.genre}
                      </span>
                      <span className="text-white/60 text-[10px] flex items-center">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-2.5 w-2.5 mr-0.5"
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
                      </span>
                    </div>
                    <p className="text-white/50 text-[10px] mt-0.5 italic leading-tight">
                      {song.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* School Songs Box */}
        <div className="bg-black/40 backdrop-blur-sm rounded-lg p-2 border border-white/10">
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-6 h-6 flex items-center justify-center bg-gradient-to-r from-blue-500 to-indigo-500 rounded">
              <span className="text-sm">🎓</span>
            </div>
            <h2 className="text-base font-bold text-white">Cuối Năm Học</h2>
          </div>

          <div className="space-y-1.5">
            {schoolSongs.map((song, index) => (
              <div
                key={index}
                className="bg-white/5 rounded p-1.5 border border-white/5"
              >
                <div className="flex items-start gap-2">
                  {/* Song Number */}
                  <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded text-sm font-bold text-white/80">
                    {index + 1}
                  </div>

                  {/* Song Info */}
                  <div className="flex-grow min-w-0">
                    <h3 className="text-sm font-bold text-white leading-tight">
                      {song.title}
                    </h3>
                    <p className="text-white/70 text-xs leading-tight">
                      {song.artist}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gradient-to-r from-blue-500/20 to-indigo-500/20 text-white/90">
                        {song.genre}
                      </span>
                      <span className="text-white/60 text-[10px] flex items-center">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-2.5 w-2.5 mr-0.5"
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
                      </span>
                    </div>
                    <p className="text-white/50 text-[10px] mt-0.5 italic leading-tight">
                      {song.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrendingSongsList;
