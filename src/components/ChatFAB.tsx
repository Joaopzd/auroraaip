import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X, Loader2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { sendChatMessage } from "@/lib/chat.functions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

export function ChatFAB() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const qc = useQueryClient();
  const sendFn = useServerFn(sendChatMessage);

  const { data: messages = [] } = useQuery({
    queryKey: ["chat_messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("id, role, content")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as ChatMessage[];
    },
  });

  const mutation = useMutation({
    mutationFn: async (text: string) => {
      // optimistic insert user message
      const { data: userRow, error: e1 } = await supabase
        .from("chat_messages")
        .insert({ role: "user", content: text })
        .select("id, role, content")
        .single();
      if (e1) throw e1;

      qc.setQueryData<ChatMessage[]>(["chat_messages"], (old = []) => [
        ...old,
        userRow as ChatMessage,
      ]);

      const history = [
        ...(qc.getQueryData<ChatMessage[]>(["chat_messages"]) ?? []),
      ].map((m) => ({ role: m.role, content: m.content }));

      const { reply } = await sendFn({ data: { messages: history } });

      const { data: aiRow, error: e2 } = await supabase
        .from("chat_messages")
        .insert({ role: "assistant", content: reply })
        .select("id, role, content")
        .single();
      if (e2) throw e2;
      return aiRow as ChatMessage;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat_messages"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["routine_blocks"] });
      qc.invalidateQueries({ queryKey: ["lists"] });
      qc.invalidateQueries({ queryKey: ["list_items"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["credit_cards"] });
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao enviar mensagem"),
  });

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open, mutation.isPending]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || mutation.isPending) return;
    setInput("");
    mutation.mutate(text);
  };

  return (
    <>
      {!open && (
        <button
          aria-label="Abrir assistente"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gold text-gold-foreground shadow-[var(--shadow-gold)] transition-transform hover:scale-105 active:scale-95"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center">
          <div className="flex h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-border bg-surface sm:rounded-3xl">
            <header className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-base font-semibold">Assistente Aurora</h2>
                <p className="text-xs text-muted-foreground">Sempre aqui pra te ajudar a se organizar</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full p-2 text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
              {messages.length === 0 && !mutation.isPending && (
                <div className="mt-12 text-center text-sm text-muted-foreground">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gold/10 text-gold">
                    <MessageCircle className="h-6 w-6" />
                  </div>
                  Comece uma conversa. Posso sugerir prioridades,<br />
                  organizar sua semana ou montar listas.
                </div>
              )}
              <div className="space-y-3">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "flex",
                      m.role === "user" ? "justify-end" : "justify-start",
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                        m.role === "user"
                          ? "bg-gold text-gold-foreground"
                          : "bg-surface-elevated text-foreground",
                      )}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
                {mutation.isPending && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-2xl bg-surface-elevated px-4 py-2.5 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Pensando...
                    </div>
                  </div>
                )}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="border-t border-border bg-surface p-3">
              <div className="flex items-end gap-2 rounded-2xl bg-surface-elevated px-3 py-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  rows={1}
                  placeholder="Pergunte algo ao assistente..."
                  className="max-h-32 flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || mutation.isPending}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold text-gold-foreground disabled:opacity-40"
                  aria-label="Enviar"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
