/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef } from "react";
import { Socket } from "socket.io-client";
import { PlaySongEvent, VideoEvent, VideoState } from "../types";
import { FALLBACK_VIDEO_ID } from "../constants";

// Định nghĩa một kiểu dữ liệu cho BackupState
interface BackupState {
  backupUrl: string;
  isLoadingBackup: boolean;
  backupError: boolean;
  backupVideoReady: boolean;
  youtubeError: boolean;
}

// Định nghĩa kiểu cho YouTube Player Ref
interface YouTubePlayerRef {
  loadVideoById: (args: { videoId: string; startSeconds: number }) => void;
  getVideoData: () => { video_id: string };
  getCurrentTime: () => number;
  getDuration: () => number;
  seekTo: (time: number, allowSeekAhead: boolean) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  setPlaybackQuality: (quality: string) => void;
  unMute?: () => void;
}

interface UseVideoEventsProps {
  socket: typeof Socket | null;
  roomId: string;
  videoState: VideoState;
  setVideoState: React.Dispatch<React.SetStateAction<VideoState>>;
  setIsChangingSong: React.Dispatch<React.SetStateAction<boolean>>;
  playerRef: React.RefObject<YouTubePlayerRef>;
  backupVideoRef: React.RefObject<HTMLVideoElement>;
  handleBackupVideoEnd: () => void; // Giữ lại vì có thể cần trong tương lai
  backupState: BackupState;
  setBackupState: React.Dispatch<React.SetStateAction<BackupState>>;
}

export function useVideoEvents({
  socket,
  roomId,
  videoState,
  setVideoState,
  setIsChangingSong,
  playerRef,
  backupVideoRef,
  handleBackupVideoEnd, // Giữ lại để không phá vỡ API của hook
  backupState,
  setBackupState,
}: UseVideoEventsProps) {
  // Create refs to store the latest values without triggering re-renders
  const videoStateRef = useRef(videoState);
  const roomIdRef = useRef(roomId);
  const backupStateRef = useRef(backupState);
  const socketRef = useRef(socket);

  // Update refs when values change
  useEffect(() => {
    videoStateRef.current = videoState;
    roomIdRef.current = roomId;
    backupStateRef.current = backupState;
    socketRef.current = socket;
  }, [videoState, roomId, backupState, socket]);

  // Handle current song event from server
  useEffect(() => {
    if (!socket) return;

    // Handle current song event after reconnect
    const handleCurrentSong = (data: PlaySongEvent) => {
      console.log("Received current song after reconnect:", data);

      if (!data || !data.video_id) return;

      // Check if song is different from current
      if (
        !videoStateRef.current.nowPlayingData?.video_id ||
        videoStateRef.current.nowPlayingData.video_id !== data.video_id
      ) {
        setIsChangingSong(true);

        setVideoState((prev) => ({
          ...prev,
          nowPlayingData: {
            ...data,
            currentTime: data.currentTime || 0,
          },
          currentVideoId: data.video_id,
          isBuffering: true,
          isPaused: false,
        }));

        // Reset backup states
        setBackupState({
          backupUrl: "",
          isLoadingBackup: false,
          backupError: false,
          backupVideoReady: false,
          youtubeError: false,
        });

        if (playerRef.current?.loadVideoById) {
          // Thêm mới: Đảm bảo player không bị mute trước khi load video mới
          try {
            playerRef.current.unMute?.();
          } catch (e) {
            console.error("Error unmuting during current song update:", e);
          }

          // Calculate current time based on timestamp
          const elapsedTime = (Date.now() - data.timestamp) / 1000;
          const startTime = data.currentTime + elapsedTime;

          playerRef.current.loadVideoById({
            videoId: data.video_id,
            startSeconds: startTime,
          });
        }
      }
    };

    socket.on("current_song", handleCurrentSong);

    return () => {
      socket.off("current_song", handleCurrentSong);
    };
  }, [socket]);

  // Handle play song and video events
  useEffect(() => {
    if (!socket) return;

    // Handle play_song event
    const handlePlaySong = (data: PlaySongEvent) => {
      console.log("Received play song:", data);
      setIsChangingSong(true);

      setVideoState((prev) => ({
        ...prev,
        nowPlayingData: {
          ...data,
          currentTime: 0, // Reset currentTime for new song
        },
        currentVideoId: data.video_id,
        isBuffering: true,
        isPaused: false,
      }));

      // Reset backup states
      setBackupState({
        backupUrl: "",
        isLoadingBackup: false,
        backupError: false,
        backupVideoReady: false,
        youtubeError: false,
      });

      if (playerRef.current?.loadVideoById) {
        // Thêm mới: Đảm bảo player không bị mute trước khi load video mới
        try {
          playerRef.current.unMute?.();
          console.log("Unmuting player before loading new song");
        } catch (e) {
          console.error("Error unmuting during play song:", e);
        }

        playerRef.current.loadVideoById({
          videoId: data.video_id,
          startSeconds: 0, // Start from beginning
        });
      }
    };

    // Handle playback_event
    const handlePlaybackEvent = (data: VideoEvent) => {
      console.log("Received playback event:", data);

      // Handle for backup video
      if (backupState.backupUrl && backupVideoRef.current) {
        switch (data.event) {
          case "play":
            console.log("Playing backup video");
            backupVideoRef.current.currentTime = data.currentTime;
            backupVideoRef.current.play().then(() => {
              setVideoState((prev) => ({ ...prev, isPaused: false }));
            });
            break;
          case "pause":
            console.log("Pausing backup video");
            backupVideoRef.current.pause();
            setVideoState((prev) => ({ ...prev, isPaused: true }));
            break;
          case "seek":
            backupVideoRef.current.currentTime = data.currentTime;
            break;
        }
        return;
      }

      // Handle for YouTube player
      if (playerRef.current) {
        switch (data.event) {
          case "play":
            console.log("Playing YouTube video");
            playerRef.current.seekTo(data.currentTime, true);

            // Đảm bảo video không bị mute trước khi phát
            try {
              playerRef.current.unMute?.();
            } catch (e) {
              console.error("Error unmuting during play event:", e);
            }

            playerRef.current.playVideo();
            setVideoState((prev) => ({ ...prev, isPaused: false }));

            // Thêm kiểm tra sau khi phát để đảm bảo không bị mute
            setTimeout(() => {
              try {
                playerRef.current?.unMute?.();
              } catch {
                // Ignore errors
              }
            }, 500);
            break;
          case "pause":
            console.log("Pausing YouTube video");
            playerRef.current.pauseVideo();
            setVideoState((prev) => ({ ...prev, isPaused: true }));
            break;
          case "seek":
            playerRef.current.seekTo(data.currentTime, true);
            break;
        }
      }
    };

    // Handle now_playing_cleared event
    const handleNowPlayingCleared = () => {
      setVideoState((prev) => ({
        ...prev,
        nowPlayingData: null,
        currentVideoId: "",
      }));

      // Load fallback video
      if (playerRef.current?.loadVideoById) {
        playerRef.current.loadVideoById({
          videoId: FALLBACK_VIDEO_ID,
          startSeconds: 0,
        });
      }
    };

    // Register event listeners
    socket.on("play_song", handlePlaySong);
    socket.on("video_event", handlePlaybackEvent);
    socket.on("now_playing_cleared", handleNowPlayingCleared);

    return () => {
      socket.off("play_song", handlePlaySong);
      socket.off("video_event", handlePlaybackEvent);
      socket.off("now_playing_cleared", handleNowPlayingCleared);
    };
  }, [socket, backupState.backupUrl]);

  // Handle video end
  const handleVideoEnd = useCallback(() => {
    if (!socket || !videoState.nowPlayingData) return;

    socket.emit("song_ended", {
      roomId,
      videoId: videoState.nowPlayingData.video_id,
    });
  }, [socket, videoState.nowPlayingData, roomId]);

  // Handle time updates
  const handleTimeUpdate = useCallback(() => {
    const socket = socketRef.current;
    const videoState = videoStateRef.current;
    const roomId = roomIdRef.current;
    const backupState = backupStateRef.current;

    if (!socket || !videoState.nowPlayingData) return;

    // Handle for backup video
    if (backupState.backupUrl && backupVideoRef.current) {
      const currentTime = backupVideoRef.current.currentTime;
      const rawDuration = backupVideoRef.current.duration;
      const duration = rawDuration ? Math.max(0, rawDuration - 1.5) : 0;
      const isPlaying = !backupVideoRef.current.paused;

      if (currentTime >= duration) {
        // Sử dụng handleBackupVideoEnd nếu đã đến cuối video
        if (typeof handleBackupVideoEnd === "function") {
          handleBackupVideoEnd();
        } else {
          socket.emit("song_ended", {
            roomId,
            videoId: videoState.currentVideoId,
          });
        }
      }

      if (
        currentTime !== undefined &&
        duration &&
        !isNaN(currentTime) &&
        !isNaN(duration)
      ) {
        socket.emit("time_update", {
          roomId,
          videoId: videoState.currentVideoId,
          currentTime,
          duration,
          isPlaying,
        });
      }
      return;
    }

    // Handle for YouTube player
    if (!playerRef.current) return;

    try {
      // Kiểm tra phương thức có tồn tại không mà không tách chúng ra
      if (
        !playerRef.current.getVideoData ||
        !playerRef.current.getCurrentTime ||
        !playerRef.current.getDuration
      ) {
        console.warn("YouTube player methods not ready");
        return;
      }

      // Gọi các phương thức trực tiếp từ đối tượng player để giữ ngữ cảnh 'this'
      const videoData = playerRef.current.getVideoData();
      if (!videoData) return;

      const currentTime = playerRef.current.getCurrentTime();
      const duration = playerRef.current.getDuration();

      if (currentTime >= duration) {
        socket.emit("song_ended", {
          roomId,
          videoId: videoData.video_id,
        });
      }

      if (currentTime && duration && !isNaN(currentTime) && !isNaN(duration)) {
        socket.emit("time_update", {
          roomId,
          videoId: videoData.video_id,
          currentTime,
          duration,
          isPlaying: !videoState.isPaused,
        });
      }
    } catch (error) {
      console.error("Error accessing YouTube player methods:", error);
    }
  }, [backupVideoRef, playerRef, handleBackupVideoEnd]);

  // Set up time update interval
  useEffect(() => {
    const socket = socketRef.current;
    const videoState = videoStateRef.current;

    if (!socket || videoState.isPaused) return;

    console.log("Setting up time update interval");
    const intervalId = window.setInterval(handleTimeUpdate, 1000);

    return () => {
      console.log("Clearing time update interval");
      clearInterval(intervalId);
    };
  }, [handleTimeUpdate]);

  // Video state change handler
  const handleStateChange = useCallback(
    (event: { data: number; target?: any }) => {
      const socket = socketRef.current;
      const videoState = videoStateRef.current;
      const roomId = roomIdRef.current;

      if (!playerRef.current || !socket) return;

      type YouTubePlayerState = {
        UNSTARTED: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };

      const YT: { PlayerState: YouTubePlayerState } = (window as any).YT;
      console.log("YouTube State Change:", event.data);

      try {
        // Video đang phát thì luôn tắt loading Jozo
        if (event.data === YT.PlayerState.PLAYING) {
          console.log("Video is now playing - hiding loading indicator");
          setIsChangingSong(false);
        }

        switch (event.data) {
          case YT.PlayerState.PLAYING:
            console.log("Video is now playing");

            // Ép chất lượng cao nhất mỗi khi video đang phát
            if (
              playerRef.current.setPlaybackQuality &&
              videoState.nowPlayingData
            ) {
              try {
                playerRef.current.setPlaybackQuality("hd1080");
                console.log(
                  "Forced playback quality to HD 1080p during playback"
                );
              } catch (error) {
                console.warn(
                  "Failed to set HD quality during playback:",
                  error
                );
              }
            }

            // Cập nhật trạng thái và gửi event
            setVideoState((prev) => ({
              ...prev,
              isBuffering: false,
              isPaused: false,
            }));

            socket.emit("video_event", {
              roomId,
              event: "play",
              videoId: playerRef.current.getVideoData().video_id,
              currentTime: playerRef.current.getCurrentTime(),
            });
            break;

          case YT.PlayerState.BUFFERING:
            setVideoState((prev) => ({ ...prev, isBuffering: true }));
            break;

          case YT.PlayerState.PAUSED:
            console.log("Video is now paused");
            setVideoState((prev) => ({ ...prev, isPaused: true }));
            socket.emit("video_event", {
              roomId,
              event: "pause",
              videoId: playerRef.current.getVideoData().video_id,
              currentTime: playerRef.current.getCurrentTime(),
            });
            break;

          case YT.PlayerState.ENDED:
            handleVideoEnd();
            break;
        }
      } catch (error) {
        console.error("Error in handleStateChange:", error);
      }
    },
    [setIsChangingSong, setVideoState, handleVideoEnd]
  );

  return {
    handleVideoEnd,
    handleTimeUpdate,
    handleStateChange, // Export để sử dụng trong VideoPlayer.tsx
  };
}
