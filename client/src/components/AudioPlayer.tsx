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

  const hasMetadata = initialMetadata?.title || initialMetadata?.artist || initialMetadata?.album;
  const displayTitle = initialMetadata?.title || fileName || "Áudio";
  const displayArtist = initialMetadata?.artist;
  const displayAlbum = initialMetadata?.album;
  const albumArtUrl = initialMetadata?.coverArt;
  
  // Detecta se é gravação de voz (baseado no nome do arquivo ou ausência de metadados)
  const isVoiceRecording = fileName?.startsWith('audio-') || (!hasMetadata && fileName?.includes('.webm'));

  return (
    <div className={cn("flex flex-col gap-3 p-4 bg-muted/50 rounded-lg w-full min-w-0 md:min-w-[600px]", className)}>
      <audio ref={audioRef} src={src} />
      
      <div className="flex gap-3">
        {/* Album art or fallback */}
        <div className="flex-shrink-0">
          {albumArtUrl ? (
            <img
              src={albumArtUrl}
              alt="Album art"
              className="w-16 h-16 rounded object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              {isVoiceRecording ? (
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-8 h-8 text-white"
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
              )}
            </div>
          )}
        </div>

        {/* Audio info */}
        <div className="flex-1 min-w-0 flex flex-col gap-1 justify-center">
          {hasMetadata ? (
            <>
              <p className="text-sm font-medium truncate" title={displayTitle}>
                {displayTitle}
              </p>
              {displayArtist && (
                <p className="text-xs text-muted-foreground truncate" title={displayArtist}>
                  {displayArtist}
                </p>
              )}
              {displayAlbum && (
                <p className="text-xs text-muted-foreground truncate" title={displayAlbum}>
                  {displayAlbum}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm font-medium truncate" title={displayTitle}>
              {isVoiceRecording ? "Mensagem de Voz" : displayTitle}
            </p>
          )}
        </div>
      </div>

      {/* Play/Pause button and Progress bar */}
      <div className="flex items-center gap-3">
        <Button
          size="icon"
          variant="ghost"
          onClick={togglePlay}
          className={cn(
            "flex-shrink-0 transition-colors",
            isPlaying ? "bg-primary/30 hover:bg-primary/40" : "bg-primary/10 hover:bg-primary/20"
          )}
          data-testid="button-audio-play-pause"
        >
          {isPlaying ? (
            <Pause className="h-9 w-9 text-primary" />
          ) : (
            <Play className="h-9 w-9 text-primary drop-shadow-md" />
          )}
        </Button>
        
        <div className="flex-1 flex flex-col gap-1">
          <Slider
            value={[currentTime]}
            min={0}
            max={duration || 100}
            step={0.1}
            onValueChange={handleProgressChange}
            className="w-full [&_[role=slider]]:hidden"
            data-testid="slider-audio-progress"
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground tabular-nums" data-testid="text-audio-current-time">
              {formatTime(currentTime)}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums" data-testid="text-audio-duration">
              {formatTime(duration)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
