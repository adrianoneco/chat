import { useState, useRef, useEffect } from "react";
import { Mic, Video, Image as ImageIcon, Paperclip, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface MessageInputProps {
  onSendMessage: (content: string) => void;
  disabled?: boolean;
}

export function MessageInput({ onSendMessage, disabled }: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [height, setHeight] = useState(60);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage("");
      setHeight(60);
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

  const actionButtons = [
    { icon: Mic, label: "Gravar áudio", testId: "button-record-audio" },
    { icon: Video, label: "Gravar vídeo", testId: "button-record-video" },
    { icon: ImageIcon, label: "Enviar imagem", testId: "button-send-image" },
    { icon: Paperclip, label: "Anexar arquivo", testId: "button-attach-file" },
  ];

  return (
    <div
      className="bg-background border-t border-border p-4"
      style={{ minHeight: `${height + 32}px` }}
      data-testid="message-input-container"
    >
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem..."
            disabled={disabled}
            className="resize-none pr-4 min-h-[60px]"
            style={{ height: `${height}px` }}
            data-testid="input-message"
          />
        </div>

        <div className="flex items-center gap-1">
          {actionButtons.map((button, index) => {
            const Icon = button.icon;
            return (
              <Tooltip key={index}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={disabled}
                    className="h-10 w-10 flex-shrink-0"
                    data-testid={button.testId}
                  >
                    <Icon className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{button.label}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}

          <Button
            onClick={handleSend}
            disabled={!message.trim() || disabled}
            size="icon"
            className="h-10 w-10 rounded-full flex-shrink-0"
            data-testid="button-send-message"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
