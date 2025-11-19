import { Progress } from "@/components/ui/progress";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UploadProgressProps {
  fileName: string;
  progress: number;
  onCancel?: () => void;
}

export function UploadProgress({ fileName, progress, onCancel }: UploadProgressProps) {
  return (
    <div className="mb-3 px-4 py-3 bg-blue-500/10 border border-blue-500 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <span className="text-sm font-medium truncate">{fileName}</span>
        </div>
        {onCancel && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0"
            onClick={onCancel}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Progress value={progress} className="flex-1" />
        <span className="text-xs text-muted-foreground tabular-nums">{Math.round(progress)}%</span>
      </div>
    </div>
  );
}
