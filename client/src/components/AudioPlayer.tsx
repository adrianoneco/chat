import { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import jsmediatags from "jsmediatags";

interface AudioPlayerProps {
  src: string;
  fileName?: string;
  className?: string;
}

interface AudioMetadata {
  title?: string;
  artist?: string;
  album?: string;
  picture?: {
    data: Uint8Array;
    format: string;
  };
}

export function AudioPlayer({ src, fileName, className }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [metadata, setMetadata] = useState<AudioMetadata>({});
  const [albumArtUrl, setAlbumArtUrl] = useState<string | null>(null);

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

  useEffect(() => {
    // Read ID3 tags
    jsmediatags.read(src, {
      onSuccess: (tag: any) => {
        const { title, artist, album, picture } = tag.tags;
        setMetadata({ title, artist, album, picture });

        if (picture) {
          const { data, format } = picture;
          let base64String = "";
          for (let i = 0; i < data.length; i++) {
            base64String += String.fromCharCode(data[i]);
          }
          const imageUrl = `data:${format};base64,${btoa(base64String)}`;
          setAlbumArtUrl(imageUrl);
        }
      },
      onError: (error: any) => {
        console.error("Error reading audio tags:", error);
      },
    });
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

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleProgressChange = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    const newTime = value[0];
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    const newVolume = value[0];
    audio.volume = newVolume;
    setVolume(newVolume);
    if (newVolume > 0 && isMuted) {
      audio.muted = false;
      setIsMuted(false);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const displayTitle = metadata.title || fileName || "Áudio";
  const displayArtist = metadata.artist || "Artista desconhecido";
  const displayAlbum = metadata.album || "";

  return (
    <div className={cn("flex gap-3 p-3 bg-muted/50 rounded-lg max-w-md", className)}>
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
          {displayAlbum && (
            <p className="text-xs text-muted-foreground truncate" title={displayAlbum}>
              {displayAlbum}
            </p>
          )}
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
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatTime(duration)}
            </span>
          </div>

          {/* Volume control */}
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={toggleMute}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>

          <Slider
            value={[isMuted ? 0 : volume]}
            min={0}
            max={1}
            step={0.01}
            onValueChange={handleVolumeChange}
            className="w-20"
          />
        </div>
      </div>
    </div>
  );
}
