import { useState } from "react";
import { Trash2, LogOut, Sun, Moon, X, AlertTriangle } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const RESETTABLE_TABLES = [
  "transactions",
  "purchases",
  "card_invoice_payments",
  "credit_cards",
  "bills",
  "investments",
  "weekly_budgets",
  "list_items",
  "lists",
  "routine_blocks",
  "tasks",
  "chat_messages",
] as const;

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [confirmReset, setConfirmReset] = useState(false);

  const reset = useMutation({
    mutationFn: async () => {
      for (const t of RESETTABLE_TABLES) {
        const { error } = await supabase.from(t).delete().not("id", "is", null);
        if (error) throw new Error(`${t}: ${error.message}`);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Todos os dados foram resetados.");
      setConfirmReset(false);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleLogout() {
    await supabase.auth.signOut();
    onClose();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md space-y-3 rounded-3xl bg-card p-6 shadow-2xl ring-2 ring-gold/30" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Configurações</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        <button
          onClick={toggle}
          className="flex w-full items-center justify-between rounded-2xl bg-surface-elevated px-4 py-3 text-sm transition hover:bg-surface-elevated/80"
        >
          <span className="flex items-center gap-3">
            {theme === "dark" ? <Moon className="h-4 w-4 text-gold" /> : <Sun className="h-4 w-4 text-gold" />}
            <span className="font-medium">Tema</span>
          </span>
          <span className="text-xs text-muted-foreground">{theme === "dark" ? "Escuro" : "Claro"} · trocar</span>
        </button>

        <button
          onClick={handleLogout}
          className="flex w-full items-center justify-between rounded-2xl bg-surface-elevated px-4 py-3 text-sm transition hover:bg-surface-elevated/80"
        >
          <span className="flex items-center gap-3">
            <LogOut className="h-4 w-4 text-gold" />
            <span className="font-medium">Sair da conta</span>
          </span>
        </button>

        <div className={cn("rounded-2xl border p-4", confirmReset ? "border-destructive/40 bg-destructive/5" : "border-border")}>
          <div className="flex items-start gap-3">
            <AlertTriangle className={cn("mt-0.5 h-4 w-4 shrink-0", confirmReset ? "text-destructive" : "text-muted-foreground")} />
            <div className="flex-1 text-sm">
              <p className="font-medium">Resetar todos os dados</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Apaga finanças, tarefas, rotina, listas e histórico da Aurora. A conta é mantida.
              </p>
            </div>
          </div>
          {confirmReset ? (
            <div className="mt-3 flex gap-2">
              <button onClick={() => setConfirmReset(false)} className="flex-1 rounded-xl bg-surface-elevated px-3 py-2 text-xs font-medium">Cancelar</button>
              <button onClick={() => reset.mutate()} disabled={reset.isPending}
                className="flex-1 rounded-xl bg-destructive px-3 py-2 text-xs font-semibold text-destructive-foreground disabled:opacity-60">
                {reset.isPending ? "Apagando..." : "Sim, apagar tudo"}
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmReset(true)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/20">
              <Trash2 className="h-3.5 w-3.5" /> Resetar dados
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
