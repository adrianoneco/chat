import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { MessageWithSender, User } from "@shared/schema";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Reply, Forward, Smile, Image as ImageIcon, Video, Mic, FileText, Trash2 } from "lucide-react";
import { AudioPlayer } from "./AudioPlayer";
import { VideoPlayer } from "./VideoPlayer";

interface ChatAreaProps {
  messages: MessageWithSender[];
  currentUser: User;
  onReply?: (message: MessageWithSender) => void;
  onForward?: (message: MessageWithSender) => void;
  onReact?: (message: MessageWithSender, emoji: string) => void;
  onDelete?: (message: MessageWithSender) => void;
}

const QUICK_EMOJIS = ["❤️", "👍", "😂", "😮", "😢", "🙏"];

export function ChatArea({ messages, currentUser, onReply, onForward, onReact, onDelete }: ChatAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToMessage = (messageId: string) => {
    const element = messageRefs.current.get(messageId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.classList.add("highlight-flash");
      setTimeout(() => element.classList.remove("highlight-flash"), 2000);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-center p-8">
        <div>
          <MessageSquare className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhuma mensagem ainda</h3>
          <p className="text-sm text-muted-foreground">
            Envie uma mensagem para iniciar a conversa
          </p>
        </div>
      </div>
    );
  }

  const getMediaIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <ImageIcon className="h-3 w-3" />;
      case 'video':
        return <Video className="h-3 w-3" />;
      case 'audio':
        return <Mic className="h-3 w-3" />;
      case 'file':
        return <FileText className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getMediaLabel = (type: string) => {
    switch (type) {
      case 'image':
        return 'Imagem';
      case 'video':
        return 'Vídeo';
      case 'audio':
        return 'Áudio';
      case 'file':
        return 'Arquivo';
      default:
        return '';
    }
  };

  const renderMedia = (message: MessageWithSender) => {
    if (!message.fileMetadata?.url) return null;

    switch (message.type) {
      case 'image':
        return (
          <a
            href={message.fileMetadata.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block max-w-sm"
          >
            <img
              src={message.fileMetadata.url}
              alt={message.fileMetadata.fileName || 'Image'}
              className="max-h-96 rounded-lg cursor-pointer hover:opacity-90 transition-opacity object-contain w-full"
            />
          </a>
        );
      
      case 'video':
        return (
          <VideoPlayer
            src={message.fileMetadata.url}
            className="my-2"
          />
        );
      
      case 'audio':
        return (
          <AudioPlayer
            src={message.fileMetadata.url}
            fileName={message.fileMetadata.fileName}
            metadata={message.fileMetadata.id3}
            className="my-2"
          />
        );
      
      case 'file':
        return (
          <a
            href={message.fileMetadata.url}
            download={message.fileMetadata.fileName}
            className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{message.fileMetadata.fileName}</p>
              {message.fileMetadata.fileSize && (
                <p className="text-xs text-muted-foreground">
                  {(message.fileMetadata.fileSize / 1024 / 1024).toFixed(2)} MB
                </p>
              )}
            </div>
          </a>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4" data-testid="chat-messages-area">
      {messages.map((message, index) => {
        const isCurrentUser = message.senderId === currentUser.id;
        const showAvatar =
          index === 0 ||
          messages[index - 1].senderId !== message.senderId;
        const isReplied = !!message.replyToId;
        const isForwarded = !!message.forwardedFromId;
        const isHovered = hoveredMessageId === message.id;

        return (
          <div
            key={message.id}
            ref={(el) => {
              if (el) messageRefs.current.set(message.id, el);
            }}
            className={cn(
              "flex items-end gap-2 group relative transition-all",
              isCurrentUser ? "flex-row-reverse" : "flex-row"
            )}
            data-testid={`message-${message.id}`}
            onMouseEnter={() => setHoveredMessageId(message.id)}
            onMouseLeave={() => setHoveredMessageId(null)}
          >
            {showAvatar && !isCurrentUser ? (
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarImage src={message.sender.profileImageUrl || undefined} />
                <AvatarFallback className="text-xs">
                  {message.sender.firstName?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
            ) : (
              !isCurrentUser && <div className="w-8" />
            )}

            <div
              className={cn(
                "flex flex-col gap-1 max-w-full md:max-w-[70%] relative",
                isCurrentUser ? "items-end" : "items-start"
              )}
            >
              {showAvatar && (currentUser.role === 'client' || !isCurrentUser) && (
                <span className="text-xs text-muted-foreground px-3">
                  {message.sender.firstName} {message.sender.lastName}
                </span>
              )}
              
              <div className="relative">
                {/* Action buttons on hover */}
                {isHovered && (
                  <div
                    className={cn(
                      "absolute -top-8 flex gap-1 bg-background border border-border rounded-md shadow-lg p-1 z-10",
                      isCurrentUser ? "right-0" : "left-0"
                    )}
                  >
                    {onReply && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => onReply(message)}
                        data-testid={`button-reply-${message.id}`}
                      >
                        <Reply className="h-4 w-4" />
                      </Button>
                    )}
                    {onForward && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => onForward(message)}
                        data-testid={`button-forward-${message.id}`}
                      >
                        <Forward className="h-4 w-4" />
                      </Button>
                    )}
                    {onReact && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            data-testid={`button-react-${message.id}`}
                          >
                            <Smile className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-2">
                          <div className="flex gap-1">
                            {QUICK_EMOJIS.map((emoji) => (
                              <Button
                                key={emoji}
                                variant="ghost"
                                size="sm"
                                className="text-xl hover:scale-125 transition-transform"
                                onClick={() => onReact(message, emoji)}
                              >
                                {emoji}
                              </Button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                    {onDelete && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => onDelete(message)}
                        data-testid={`button-delete-${message.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}

                <div
                  className={cn(
                    "px-4 py-2 rounded-2xl relative",
                    isCurrentUser
                      ? "bg-primary text-primary-foreground rounded-tr-md"
                      : "bg-muted text-muted-foreground rounded-tl-md",
                    isReplied && "border-l-4 border-l-purple-500 pl-3",
                    isForwarded && "border-l-4 border-l-blue-500 pl-3"
                  )}
                >
                  {/* Replied message indicator */}
                  {isReplied && message.replyTo && (
                    <div
                      className="mb-2 pb-2 border-b border-border/50 cursor-pointer hover:opacity-70"
                      onClick={() => scrollToMessage(message.replyToId!)}
                      data-testid={`reply-preview-${message.id}`}
                    >
                      <div className="flex items-center gap-1 text-xs opacity-70 mb-1">
                        <Reply className="h-3 w-3" />
                        <span className="font-medium">Resposta</span>
                      </div>
                      <div className="flex items-start gap-2">
                        {message.replyTo.type !== 'text' && (
                          <div className="flex items-center gap-1 text-xs opacity-70">
                            {getMediaIcon(message.replyTo.type)}
                            <span>{getMediaLabel(message.replyTo.type)}</span>
                          </div>
                        )}
                        {message.replyTo.type === 'image' && message.replyTo.fileMetadata?.url && (
                          <img
                            src={message.replyTo.fileMetadata.url}
                            alt="Preview"
                            className="w-12 h-12 rounded object-cover"
                          />
                        )}
                      </div>
                      <p className="text-xs opacity-70 truncate mt-1">
                        {message.replyTo.content}
                      </p>
                    </div>
                  )}

                  {/* Forwarded message indicator */}
                  {isForwarded && (
                    <div className="flex items-center gap-1 text-xs opacity-70 mb-2">
                      <Forward className="h-3 w-3" />
                      <span>Mensagem encaminhada</span>
                    </div>
                  )}

                  {/* Media content */}
                  {renderMedia(message)}

                  {/* Text content */}
                  {message.content && (
                    <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                  )}

                  {/* Reactions */}
                  {message.reactions && message.reactions.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {message.reactions.map((reaction) => (
                        <span
                          key={reaction.id}
                          className="text-sm px-2 py-0.5 bg-background/50 rounded-full"
                        >
                          {reaction.emoji}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <span className="text-xs text-muted-foreground px-3">
                {format(new Date(message.createdAt!), "HH:mm", { locale: ptBR })}
              </span>
            </div>

            {isCurrentUser && <div className="w-8" />}
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
}

function MessageSquare(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
