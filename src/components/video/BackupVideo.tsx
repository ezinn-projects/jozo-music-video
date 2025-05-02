import React, { forwardRef } from "react";

interface BackupVideoProps {
  url: string;
  onLoadedData: () => void;
  onEnded: () => void;
  onError: (e: React.SyntheticEvent<HTMLVideoElement, Event>) => void;
}

const BackupVideo = forwardRef<HTMLVideoElement, BackupVideoProps>(
  ({ url, onLoadedData, onEnded, onError }, ref) => {
    if (!url) return null;

    return (
      <video
        ref={ref}
        key={url}
        className="absolute inset-0 w-full h-full object-contain z-10"
        autoPlay
        playsInline
        controls={false}
        disablePictureInPicture
        controlsList="nodownload noplaybackrate nofullscreen"
        onLoadedData={onLoadedData}
        onEnded={onEnded}
        onError={onError}
        preload="auto"
        style={{
          objectFit: "contain",
          width: "100%",
          height: "100%",
          backgroundColor: "#000",
        }}
      >
        <source src={url} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    );
  }
);

BackupVideo.displayName = "BackupVideo";

export default BackupVideo;
