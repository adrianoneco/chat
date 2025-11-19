import { useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { MessageWithSender, User } from "@shared/schema";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ChatAreaProps {
  messages: MessageWithSender[];
  currentUser: User;
}

export function ChatArea({ messages, currentUser }: ChatAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

        return (
          <div
            key={message.id}
            className={cn(
              "flex items-end gap-2",
              isCurrentUser ? "flex-row-reverse" : "flex-row"
            )}
            data-testid={`message-${message.id}`}
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
                "flex flex-col gap-1 max-w-[70%]",
                isCurrentUser ? "items-end" : "items-start"
              )}
            >
              {showAvatar && !isCurrentUser && (
                <span className="text-xs text-muted-foreground px-3">
                  {message.sender.firstName} {message.sender.lastName}
                </span>
              )}
              <div
                className={cn(
                  "px-4 py-2 rounded-2xl",
                  isCurrentUser
                    ? "bg-primary text-primary-foreground rounded-tr-md"
                    : "bg-muted text-muted-foreground rounded-tl-md"
                )}
              >
                <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
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
