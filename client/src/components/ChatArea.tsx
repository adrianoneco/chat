import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MessageWithSender, User } from "@shared/schema";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Reply, Forward, Smile } from "lucide-react";

interface ChatAreaProps {
  messages: MessageWithSender[];
  currentUser: User;
  onReply?: (message: MessageWithSender) => void;
  onForward?: (message: MessageWithSender) => void;
  onReact?: (message: MessageWithSender) => void;
}

export function ChatArea({ messages, currentUser, onReply, onForward, onReact }: ChatAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
            className={cn(
              "flex items-end gap-2 group relative",
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
                "flex flex-col gap-1 max-w-[70%] relative",
                isCurrentUser ? "items-end" : "items-start"
              )}
            >
              {showAvatar && !isCurrentUser && (
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
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => onReact(message)}
                        data-testid={`button-react-${message.id}`}
                      >
                        <Smile className="h-4 w-4" />
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
                    <div className="mb-2 pb-2 border-b border-border/50">
                      <div className="flex items-center gap-1 text-xs opacity-70 mb-1">
                        <Reply className="h-3 w-3" />
                        <span>Respondendo</span>
                      </div>
                      <p className="text-xs opacity-70 truncate">
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

                  <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
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
