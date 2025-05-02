/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef } from "react";

interface YouTubePlayerIframeProps {
  playerRef: React.MutableRefObject<any>;
  videoId: string | undefined;
  onReady: (event: any) => void;
  onStateChange: (event: any) => void;
  onError: (event: any) => void;
  onPlaybackQualityChange: (event: any) => void;
  isFallback: boolean;
  fallbackVideoId: string;
  showControls?: boolean;
}

const YouTubePlayerIframe: React.FC<YouTubePlayerIframeProps> = ({
  playerRef,
  videoId,
  onReady,
  onStateChange,
  onError,
  onPlaybackQualityChange,
  isFallback,
  fallbackVideoId,
  showControls = false,
}) => {
  const playerDivRef = useRef<HTMLDivElement>(null);
  const playerCreatedRef = useRef(false);

  useEffect(() => {
    // YouTube IFrame API needs to be loaded first by the parent component
    if (!(window as any).YT || !(window as any).YT.Player) {
      console.warn("YouTube API not loaded");
      return;
    }

    // Only create the player once
    if (!playerCreatedRef.current && playerDivRef.current) {
      try {
        const actualVideoId = isFallback ? fallbackVideoId : videoId;
        if (!actualVideoId) {
          console.warn("No video ID provided");
          return;
        }

        const player = new (window as any).YT.Player(playerDivRef.current, {
          videoId: actualVideoId,
          playerVars: {
            autoplay: 1,
            controls: showControls ? 1 : 0,
            disablekb: 1,
            enablejsapi: 1,
            fs: 0,
            iv_load_policy: 3,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            autohide: 1,
          },
          events: {
            onReady: (event: any) => {
              if (playerRef.current !== player) {
                playerRef.current = player;
              }
              // Make sure to call onReady at this point so we trigger setIsChangingSong(false)
              console.log("YouTube player ready - should hide loading");
              onReady(event);
            },
            onStateChange,
            onError,
            onPlaybackQualityChange,
          },
        });

        playerCreatedRef.current = true;
      } catch (error) {
        console.error("Error creating YouTube player:", error);
      }
    }

    // Update video ID when it changes
    const updateVideoId = () => {
      const actualVideoId = isFallback ? fallbackVideoId : videoId;
      if (playerRef.current && actualVideoId) {
        try {
          if (playerRef.current.getVideoData) {
            const currentVideoId = playerRef.current.getVideoData().video_id;
            if (currentVideoId !== actualVideoId) {
              playerRef.current.loadVideoById(actualVideoId);
            }
          } else {
            // If getVideoData not available yet, just load the video
            playerRef.current.loadVideoById(actualVideoId);
          }
        } catch (e) {
          console.error("Error updating video ID:", e);
        }
      }
    };

    if (playerCreatedRef.current) {
      updateVideoId();
    }
  }, [
    videoId,
    onReady,
    onStateChange,
    onError,
    onPlaybackQualityChange,
    playerRef,
    isFallback,
    fallbackVideoId,
    showControls,
  ]);

  return <div id="youtube-player" ref={playerDivRef} />;
};

export default YouTubePlayerIframe;
