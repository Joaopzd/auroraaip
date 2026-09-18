import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, CreditCard, Gift, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Card } from "@/lib/finance";

export const Route = createFileRoute("/novo-cartao")({
  validateSearch: (search: Record<string, unknown>) => ({
    id: typeof search.id === "string" ? search.id : undefined,
  }),
  component: NovoCartaoPage,
  head: () => ({ meta: [{ title: "Novo cartão — Ditto" }] }),
});

function NovoCartaoPage() {
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEditing = !!id;

  const [step, setStep] = useState<"kind" | "form">(isEditing ? "form" : "kind");
  const [isBenefit, setIsBenefit] = useState(false);
  const [name, setName] = useState("");
  const [limit, setLimit] = useState("");
  const [color, setColor] = useState("#2DD4BF");
  const [dueDay, setDueDay] = useState("");
  const [closingDay, setClosingDay] = useState("");
  const [renewalDay, setRenewalDay] = useState("");
  const [error, setError] = useState("");

  const { data: existing } = useQuery({
    queryKey: ["credit_cards", id],
    enabled: isEditing,
    queryFn: async () => {
      const { data, error } = await supabase.from("credit_cards").select("*").eq("id", id!).single();
      if (error) throw error;
      return data as Card;
    },
  });

  useEffect(() => {
    if (existing) {
      setIsBenefit(existing.is_benefit);
      setName(existing.name);
      setLimit(String(existing.limit_amount).replace(".", ","));
      setColor(existing.color ?? "#2DD4BF");
      setDueDay(existing.due_day?.toString() ?? "");
      setClosingDay(existing.closing_day?.toString() ?? "");
      setRenewalDay(existing.renewal_day?.toString() ?? "");
    }
  }, [existing]);

  const save = useMutation({
    mutationFn: async () => {
      const lim = parseFloat(limit.replace(",", "."));
      if (!name.trim() || !Number.isFinite(lim) || lim < 0) throw new Error("Preencha nome e limite.");
      const payload = {
        name: name.trim(),
        limit_amount: lim,
        color,
        is_benefit: isBenefit,
        due_day: !isBenefit && dueDay ? Math.min(31, Math.max(1, parseInt(dueDay, 10))) : null,
        closing_day: !isBenefit && closingDay ? Math.min(31, Math.max(1, parseInt(closingDay, 10))) : null,
        renewal_day: isBenefit && renewalDay ? Math.min(31, Math.max(1, parseInt(renewalDay, 10))) : null,
      };
      if (isEditing) {
        const { error } = await supabase.from("credit_cards").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("credit_cards").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["credit_cards"] });
      toast.success(isEditing ? "Cartão atualizado!" : "Cartão criado!");
      navigate({ to: "/financas" });
    },
    onError: (e: Error) => setError(e.message || "Não deu pra salvar o cartão."),
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("credit_cards").delete().eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["credit_cards"] });
      toast.success("Cartão removido.");
      navigate({ to: "/financas" });
    },
  });

  return (
    <div className="mx-auto max-w-lg px-1">
      <header className="mb-6 flex items-center gap-3">
        <Link
          to="/financas"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold sm:text-2xl">{isEditing ? "Editar cartão" : "Novo cartão"}</h1>
      </header>

      {step === "kind" ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Esse cartão é um benefício (vale-refeição, vale-alimentação...) ou um cartão de crédito comum?</p>
          <button
            onClick={() => { setIsBenefit(false); setStep("form"); }}
            className="flex w-full items-center gap-4 rounded-2xl bg-surface p-4 text-left ring-1 ring-border hover:ring-gold/40"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/15 text-gold"><CreditCard className="h-5 w-5" /></div>
            <div>
              <p className="text-sm font-semibold">Cartão de crédito</p>
              <p className="text-xs text-muted-foreground">Tem fatura mensal, dia de fechamento e vencimento.</p>
            </div>
          </button>
          <button
            onClick={() => { setIsBenefit(true); setStep("form"); }}
            className="flex w-full items-center gap-4 rounded-2xl bg-surface p-4 text-left ring-1 ring-border hover:ring-gold/40"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/15 text-gold"><Gift className="h-5 w-5" /></div>
            <div>
              <p className="text-sm font-semibold">Benefício</p>
              <p className="text-xs text-muted-foreground">Renova o saldo automaticamente todo mês, sem fatura acumulada.</p>
            </div>
          </button>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); setError(""); save.mutate(); }} className="space-y-5">
          {!isEditing && (
            <button type="button" onClick={() => setStep("kind")} className="text-xs text-gold hover:underline">
              ← Trocar tipo de cartão
            </button>
          )}

          <div className="inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1 text-xs font-semibold text-gold">
            {isBenefit ? <Gift className="h-3.5 w-3.5" /> : <CreditCard className="h-3.5 w-3.5" />}
            {isBenefit ? "Benefício" : "Cartão de crédito"}
          </div>

          <Field label="Nome">
            <input value={name} onChange={(e) => setName(e.target.value)} required
              className="w-full rounded-xl bg-surface-elevated px-3 py-2.5 text-sm focus:outline-none" />
          </Field>

          <Field label="Limite (R$)">
            <input value={limit} onChange={(e) => setLimit(e.target.value)} inputMode="decimal"
              className="w-full rounded-xl bg-surface-elevated px-3 py-2.5 text-sm focus:outline-none" />
          </Field>

          {isBenefit ? (
            <Field label="Dia de renovação">
              <input value={renewalDay} onChange={(e) => setRenewalDay(e.target.value)} inputMode="numeric" placeholder="1"
                className="w-full rounded-xl bg-surface-elevated px-3 py-2.5 text-sm focus:outline-none" />
            </Field>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Dia de vencimento">
                <input value={dueDay} onChange={(e) => setDueDay(e.target.value)} inputMode="numeric" placeholder="10"
                  className="w-full rounded-xl bg-surface-elevated px-3 py-2.5 text-sm focus:outline-none" />
              </Field>
              <Field label="Dia de fechamento">
                <input value={closingDay} onChange={(e) => setClosingDay(e.target.value)} inputMode="numeric" placeholder="3"
                  className="w-full rounded-xl bg-surface-elevated px-3 py-2.5 text-sm focus:outline-none" />
              </Field>
            </div>
          )}

          <Field label="Cor">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-11 w-full rounded-xl bg-surface-elevated" />
          </Field>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2 pb-6">
            <button type="submit" disabled={save.isPending}
              className="flex-1 rounded-2xl bg-gold py-3 text-sm font-semibold text-gold-foreground disabled:opacity-60">
              {save.isPending ? "Salvando..." : isEditing ? "Salvar alterações" : "Criar cartão"}
            </button>
            {isEditing && (
              <button
                type="button"
                onClick={() => { if (confirm("Remover este cartão? Esta ação não pode ser desfeita.")) del.mutate(); }}
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive"
                aria-label="Excluir cartão"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
