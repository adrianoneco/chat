import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { User } from "@shared/schema";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransfer: (attendantId: string) => void;
}

export default function TransferConversationModal({ open, onOpenChange, onTransfer }: Props) {
  const { data: attendants = [], isLoading } = useQuery<User[]>({ queryKey: ["/api/attendants"] });
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transferir conversa</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div>Carregando atendentes...</div>
          ) : attendants.length === 0 ? (
            <div>Nenhum atendente disponível</div>
          ) : (
            <div className="space-y-2">
              {attendants.map((a) => (
                <label key={a.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer">
                  <input type="radio" name="attendant" value={a.id} checked={selected === a.id} onChange={() => setSelected(a.id)} />
                  <div className="flex items-center gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={a.profileImageUrl || undefined} />
                      <AvatarFallback>{(a.firstName?.charAt(0) || "A") + (a.lastName?.charAt(0) || "")}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-sm font-medium">{a.firstName} {a.lastName}</div>
                      <div className="text-xs text-muted-foreground">{a.email}</div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button disabled={!selected} onClick={() => { if (selected) { onTransfer(selected); } }}>
              Transferir
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
