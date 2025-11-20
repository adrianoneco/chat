import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Video, Image as ImageIcon, Paperclip, Send, X, Reply, Square, Sparkles, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { UploadProgress } from "./UploadProgress";
import type { MessageWithSender, ReadyMessage } from "@shared/schema";
import { useUserActivity } from "@/hooks/useUserActivity";

interface MessageInputProps {
  onSendMessage: (content: string, replyToId?: string) => void;
  onSendFile?: (file: File, type: string, replyToId?: string) => void;
  disabled?: boolean;
  replyingTo?: MessageWithSender | null;
  onCancelReply?: () => void;
  uploadProgress?: number;
  uploadFileName?: string;
  onCancelUpload?: () => void;
  conversationId?: string;
  otherParticipantId?: string;
  conversationData?: {
    clientFirstName: string;
    clientLastName: string;
    attendantFirstName?: string;
    attendantLastName?: string;
    protocolNumber: string;
  };
}

export function MessageInput({ 
  onSendMessage, 
  onSendFile, 
  disabled, 
  replyingTo, 
  onCancelReply,
  uploadProgress,
  uploadFileName,
  onCancelUpload,
  conversationId,
  otherParticipantId,
  conversationData 
}: MessageInputProps) {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [height, setHeight] = useState(60);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingType, setRecordingType] = useState<'audio' | 'video' | null>(null);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { sendActivity } = useUserActivity(conversationId, otherParticipantId);

  const { data: readyMessages = [] } = useQuery<ReadyMessage[]>({
    queryKey: ["/api/ready-messages"],
  });

  const handleSend = () => {
    if (message.trim() && !disabled) {
      sendActivity(null); // Clear typing status
      onSendMessage(message.trim(), replyingTo?.id);
      setMessage("");
      setHeight(60);
      if (onCancelReply) {
        onCancelReply();
      }
    }
  };

  const handleMessageChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newMessage = e.target.value;
    setMessage(newMessage);

    // Send typing indicator with debounce
    sendActivity('typing');
    
    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Clear typing status after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      sendActivity(null);
    }, 2000);
  }, [sendActivity]);

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
      sendActivity('recording'); // Notify that user is recording
      
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
        
        sendActivity('uploading'); // Switch to uploading status
        
        if (onSendFile) {
          onSendFile(file, type, replyingTo?.id);
        }
        
        stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
        setRecordingType(null);
        
        // Clear activity status after a short delay
        setTimeout(() => sendActivity(null), 1000);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingType(type);
    } catch (error) {
      console.error('Error accessing media devices:', error);
      sendActivity(null); // Clear recording status on error
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
      sendActivity(null); // Clear recording status immediately
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const file = e.target.files?.[0];
    if (file && onSendFile) {
      sendActivity('uploading'); // Notify that user is uploading
      
      // Auto-detect file type based on MIME type
      let detectedType = type;
      
      if (type === 'file') {
        if (file.type.startsWith('audio/')) {
          detectedType = 'audio';
        } else if (file.type.startsWith('image/')) {
          detectedType = 'image';
        } else if (file.type.startsWith('video/')) {
          detectedType = 'video';
        }
      }
      
      onSendFile(file, detectedType, replyingTo?.id);
      
      // Clear activity status after a short delay
      setTimeout(() => sendActivity(null), 1000);
    }
    e.target.value = '';
  };

  const handleCorrectText = async () => {
    if (!message.trim()) {
      toast({ title: "Digite uma mensagem para corrigir", variant: "destructive" });
      return;
    }

    setIsCorrecting(true);
    try {
      const response = await fetch("/api/groq/correct-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message }),
      });

      if (!response.ok) throw new Error("Erro ao corrigir texto");

      const data = await response.json();
      setMessage(data.correctedText);
      toast({ title: "Texto corrigido com sucesso!" });
    } catch (error) {
      toast({ title: "Erro ao corrigir texto", variant: "destructive" });
    } finally {
      setIsCorrecting(false);
    }
  };

  const replaceParameters = (content: string): string => {
    if (!conversationData) return content;

    const currentDate = new Date().toLocaleDateString('pt-BR');
    const currentTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    return content
      .replace(/{{clientFirstName}}/g, conversationData.clientFirstName || '')
      .replace(/{{clientLastName}}/g, conversationData.clientLastName || '')
      .replace(/{{clientFullName}}/g, `${conversationData.clientFirstName} ${conversationData.clientLastName}`.trim())
      .replace(/{{attendantFirstName}}/g, conversationData.attendantFirstName || '')
      .replace(/{{attendantLastName}}/g, conversationData.attendantLastName || '')
      .replace(/{{attendantFullName}}/g, `${conversationData.attendantFirstName || ''} ${conversationData.attendantLastName || ''}`.trim())
      .replace(/{{protocolNumber}}/g, conversationData.protocolNumber || '')
      .replace(/{{currentDate}}/g, currentDate)
      .replace(/{{currentTime}}/g, currentTime);
  };

  const handleSelectReadyMessage = (readyMessage: ReadyMessage) => {
    const processedContent = replaceParameters(readyMessage.content);
    setMessage(processedContent);
    toast({ title: `Mensagem "${readyMessage.title}" inserida!` });
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      // Clear activity status
      sendActivity(null);
      // Stop recording if active
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
    };
  }, [sendActivity, isRecording]);

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
        {/* Left buttons: Text correction and Ready messages */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={disabled || isRecording || isCorrecting}
                onClick={handleCorrectText}
                className="h-9 w-9 flex-shrink-0"
                data-testid="button-correct-text"
              >
                <Sparkles className={`w-4 h-4 ${isCorrecting ? 'animate-pulse' : ''}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isCorrecting ? 'Corrigindo...' : 'Corrigir texto com IA'}</p>
            </TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={disabled || isRecording}
                    className="h-9 w-9 flex-shrink-0"
                    data-testid="button-ready-messages"
                  >
                    <MessageSquareText className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>Mensagens prontas</p>
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start" className="w-64 max-h-80 overflow-y-auto">
              {readyMessages.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Nenhuma mensagem pronta cadastrada
                </div>
              ) : (
                readyMessages.map((msg) => (
                  <DropdownMenuItem
                    key={msg.id}
                    onClick={() => handleSelectReadyMessage(msg)}
                    className="cursor-pointer flex-col items-start"
                  >
                    <div className="font-medium text-sm">{msg.title}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {msg.content}
                    </div>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={handleMessageChange}
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
