import { useState, useRef, useEffect } from "react";
import { Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface AudioMetadata {
  title?: string;
  artist?: string;
  album?: string;
  coverArt?: string;
}

interface AudioPlayerProps {
  src: string;
  fileName?: string;
  metadata?: AudioMetadata;
  className?: string;
}

export function AudioPlayer({ src, fileName, metadata: initialMetadata, className }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  // Reset state and audio element when src changes
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [src]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      // Pause all other audio/video elements
      const allMedia = document.querySelectorAll("audio, video");
      allMedia.forEach((media) => {
        if (media !== audio) {
          (media as HTMLMediaElement).pause();
        }
      });
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleProgressChange = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    const newTime = value[0];
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const displayTitle = initialMetadata?.title || fileName || "Áudio";
  const displayArtist = initialMetadata?.artist || "Artista desconhecido";
  const displayAlbum = initialMetadata?.album || "Álbum desconhecido";
  const albumArtUrl = initialMetadata?.coverArt;

  return (
    <div className={cn("flex gap-3 p-3 bg-muted/50 rounded-lg max-w-2xl", className)}>
      <audio ref={audioRef} src={src} />
      
      {/* Album art or fallback */}
      <div className="flex-shrink-0">
        {albumArtUrl ? (
          <img
            src={albumArtUrl}
            alt="Album art"
            className="w-20 h-20 rounded object-cover"
          />
        ) : (
          <div className="w-20 h-20 rounded bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <svg
              className="w-10 h-10 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Audio info and controls */}
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        {/* Title, artist, album */}
        <div className="flex flex-col gap-0.5 min-w-0">
          <p className="text-sm font-medium truncate" title={displayTitle}>
            {displayTitle}
          </p>
          <p className="text-xs text-muted-foreground truncate" title={displayArtist}>
            {displayArtist}
          </p>
          <p className="text-xs text-muted-foreground truncate" title={displayAlbum}>
            {displayAlbum}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={togglePlay}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>

          {/* Progress bar */}
          <div className="flex-1 flex items-center gap-2">
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatTime(currentTime)}
            </span>
            <Slider
              value={[currentTime]}
              min={0}
              max={duration || 100}
              step={0.1}
              onValueChange={handleProgressChange}
              className="flex-1 [&_[role=slider]]:hidden"
            />
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatTime(duration)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
