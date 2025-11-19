import { useState, useRef, useEffect } from "react";
import { Mic, Video, Image as ImageIcon, Paperclip, Send, X, Reply, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { UploadProgress } from "./UploadProgress";
import type { MessageWithSender } from "@shared/schema";

interface MessageInputProps {
  onSendMessage: (content: string, replyToId?: string) => void;
  onSendFile?: (file: File, type: string, replyToId?: string) => void;
  disabled?: boolean;
  replyingTo?: MessageWithSender | null;
  onCancelReply?: () => void;
  uploadProgress?: number;
  uploadFileName?: string;
  onCancelUpload?: () => void;
}

export function MessageInput({ 
  onSendMessage, 
  onSendFile, 
  disabled, 
  replyingTo, 
  onCancelReply,
  uploadProgress,
  uploadFileName,
  onCancelUpload 
}: MessageInputProps) {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [height, setHeight] = useState(60);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingType, setRecordingType] = useState<'audio' | 'video' | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSendMessage(message.trim(), replyingTo?.id);
      setMessage("");
      setHeight(60);
      if (onCancelReply) {
        onCancelReply();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const scrollHeight = textareaRef.current.scrollHeight;
      const newHeight = Math.min(Math.max(scrollHeight, 60), 200);
      setHeight(newHeight);
    }
  }, [message]);

  const startRecording = async (type: 'audio' | 'video') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video'
      });

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: type === 'audio' ? 'audio/webm' : 'video/webm'
        });
        const file = new File([blob], `${type}-${Date.now()}.webm`, {
          type: blob.type
        });
        
        if (onSendFile) {
          onSendFile(file, type, replyingTo?.id);
        }
        
        stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
        setRecordingType(null);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingType(type);
    } catch (error) {
      console.error('Error accessing media devices:', error);
      toast({
        title: "Erro ao acessar mídia",
        description: "Não foi possível acessar câmera/microfone",
        variant: "destructive"
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const file = e.target.files?.[0];
    if (file && onSendFile) {
      onSendFile(file, type, replyingTo?.id);
    }
    e.target.value = '';
  };

  return (
    <div
      className="bg-background border-t border-border p-4"
      style={{ minHeight: `${height + 32}px` }}
      data-testid="message-input-container"
    >
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => handleFileSelect(e, 'image')}
        className="hidden"
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        onChange={(e) => handleFileSelect(e, 'video')}
        className="hidden"
      />
      <input
        ref={fileInputRef}
        type="file"
        onChange={(e) => handleFileSelect(e, 'file')}
        className="hidden"
      />

      {replyingTo && (
        <div className="mb-3 px-3 py-2 bg-purple-500/10 border-l-4 border-l-purple-500 rounded flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <Reply className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground mb-0.5">
                Respondendo a {replyingTo.sender.firstName}
              </p>
              <p className="text-sm text-muted-foreground truncate">
                {replyingTo.content}
              </p>
            </div>
          </div>
          {onCancelReply && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 flex-shrink-0"
              onClick={onCancelReply}
              data-testid="button-cancel-reply"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {uploadProgress !== undefined && uploadProgress < 100 && uploadFileName && (
        <UploadProgress
          fileName={uploadFileName}
          progress={uploadProgress}
          onCancel={onCancelUpload}
        />
      )}

      {isRecording && (
        <div className="mb-3 px-4 py-3 bg-red-500/10 border border-red-500 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium">
              Gravando {recordingType === 'audio' ? 'áudio' : 'vídeo'}...
            </span>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={stopRecording}
            className="gap-2"
          >
            <Square className="h-4 w-4 fill-current" />
            Parar
          </Button>
        </div>
      )}
      
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={replyingTo ? "Digite sua resposta..." : "Digite sua mensagem..."}
            disabled={disabled || isRecording}
            className="resize-none pr-48 min-h-[60px]"
            style={{ height: `${height}px` }}
            data-testid="input-message"
          />
          
          {/* Buttons inside the textarea on the right */}
          <div className="absolute right-2 bottom-2 flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={disabled || isRecording}
                  onClick={() => isRecording ? stopRecording() : startRecording('audio')}
                  className="h-9 w-9 flex-shrink-0"
                  data-testid="button-record-audio"
                >
                  {isRecording && recordingType === 'audio' ? (
                    <Square className="w-4 h-4 fill-current text-red-500" />
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isRecording && recordingType === 'audio' ? 'Parar gravação' : 'Gravar áudio'}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={disabled || isRecording}
                  onClick={() => isRecording ? stopRecording() : startRecording('video')}
                  className="h-9 w-9 flex-shrink-0"
                  data-testid="button-record-video"
                >
                  {isRecording && recordingType === 'video' ? (
                    <Square className="w-4 h-4 fill-current text-red-500" />
                  ) : (
                    <Video className="w-4 h-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isRecording && recordingType === 'video' ? 'Parar gravação' : 'Gravar vídeo'}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={disabled || isRecording}
                  onClick={() => imageInputRef.current?.click()}
                  className="h-9 w-9 flex-shrink-0"
                  data-testid="button-send-image"
                >
                  <ImageIcon className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Enviar imagem</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={disabled || isRecording}
                  onClick={() => fileInputRef.current?.click()}
                  className="h-9 w-9 flex-shrink-0"
                  data-testid="button-attach-file"
                >
                  <Paperclip className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Anexar arquivo</p>
              </TooltipContent>
            </Tooltip>

            <Button
              onClick={handleSend}
              disabled={!message.trim() || disabled || isRecording}
              size="icon"
              className="h-9 w-9 rounded-full flex-shrink-0"
              data-testid="button-send-message"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
