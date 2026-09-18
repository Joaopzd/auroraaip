import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { todayISO, type Card } from "@/lib/finance";

export function PayInvoiceModal({
  info, onClose,
}: { info: { card: Card; month: string; amount: number }; onClose: () => void }) {
  const qc = useQueryClient();
  const [method, setMethod] = useState<"cash" | "transfer">("cash");
  const [paidOn, setPaidOn] = useState(todayISO());
  const [value, setValue] = useState(String(info.amount.toFixed(2)).replace(".", ","));

  const pay = useMutation({
    mutationFn: async () => {
      const v = parseFloat(value.replace(",", "."));
      if (!Number.isFinite(v) || v <= 0) throw new Error("Valor inválido.");
      const { error } = await supabase.from("card_invoice_payments").insert({
        credit_card_id: info.card.id,
        reference_month: info.month,
        amount: v,
        paid_on: paidOn,
        paid_method: method,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["card_invoice_payments"] });
      toast.success("Fatura registrada como paga!");
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md space-y-4 rounded-3xl bg-surface p-6 ring-1 ring-border" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold">Pagar fatura — {info.card.name}</h3>
        <p className="text-xs text-muted-foreground">
          Referência: {new Date(info.month + "-01").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
        </p>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Valor pago (R$)</span>
          <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" className="w-full rounded-xl bg-surface-elevated px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Data do pagamento</span>
          <input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className="w-full rounded-xl bg-surface-elevated px-3 py-2 text-sm" />
        </label>
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface-elevated p-1">
          <button type="button" onClick={() => setMethod("cash")} className={cn("rounded-lg py-2 text-sm font-medium", method === "cash" ? "bg-gold text-gold-foreground" : "text-muted-foreground")}>Dinheiro/Débito</button>
          <button type="button" onClick={() => setMethod("transfer")} className={cn("rounded-lg py-2 text-sm font-medium", method === "transfer" ? "bg-gold text-gold-foreground" : "text-muted-foreground")}>Transferência/Pix</button>
        </div>
        {pay.isError && <p className="text-xs text-destructive">{(pay.error as Error).message}</p>}
        <button onClick={() => pay.mutate()} disabled={pay.isPending} className="w-full rounded-xl bg-gold py-2.5 text-sm font-semibold text-gold-foreground disabled:opacity-60">
          Confirmar pagamento
        </button>
      </div>
    </div>
  );
}
