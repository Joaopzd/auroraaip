import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowDownCircle, ArrowLeft, ArrowUpCircle, Layers, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CATEGORIES, categoryEmoji } from "@/lib/categories";
import { todayISO, type Card, type Tx } from "@/lib/finance";

export const Route = createFileRoute("/nova-movimentacao")({
  component: NovaMovimentacaoPage,
  head: () => ({ meta: [{ title: "Nova movimentação — Ditto" }] }),
});

function NovaMovimentacaoPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [type, setType] = useState<"expense" | "income">("expense");
  const [installmentMode, setInstallmentMode] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [occurredOn, setOccurredOn] = useState(todayISO());
  const [cardId, setCardId] = useState<string>("");
  const [installments, setInstallments] = useState("2");

  const { data: cards = [] } = useQuery({
    queryKey: ["credit_cards"],
    queryFn: async () => {
      const { data, error } = await supabase.from("credit_cards").select("*").order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((c) => ({ ...c, limit_amount: Number(c.limit_amount) })) as Card[];
    },
  });

  const { data: txs = [] } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("category");
      if (error) throw error;
      return data as Pick<Tx, "category">[];
    },
  });
  const categories = useMemo(
    () => Array.from(new Set(txs.map((t) => t.category).filter(Boolean))) as string[],
    [txs],
  );

  const add = useMutation({
    mutationFn: async () => {
      const value = parseFloat(amount.replace(",", "."));
      if (!description.trim() || !Number.isFinite(value) || value <= 0) {
        throw new Error("Preencha descrição e valor válidos.");
      }
      if (installmentMode && type === "expense") {
        const n = parseInt(installments, 10);
        if (!cardId) throw new Error("Selecione o cartão da compra parcelada.");
        if (!Number.isFinite(n) || n < 1) throw new Error("Número de parcelas inválido.");
        const { error } = await supabase.from("purchases").insert({
          credit_card_id: cardId,
          description: description.trim(),
          total_amount: value,
          installments_total: n,
          installments_paid: 0,
          category: category.trim() || null,
          started_on: occurredOn,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("transactions").insert({
          type, amount: value,
          description: description.trim(),
          category: category.trim() || null,
          occurred_on: occurredOn,
          credit_card_id: type === "expense" && cardId ? cardId : null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["purchases"] });
      toast.success(installmentMode ? "Compra parcelada criada!" : "Lançamento adicionado!");
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
        <h1 className="text-xl font-bold sm:text-2xl">Nova movimentação</h1>
      </header>

      <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="space-y-5">
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface-elevated p-1">
          <button type="button" onClick={() => setType("expense")}
            className={cn("flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition",
              type === "expense" ? "bg-destructive text-destructive-foreground" : "text-muted-foreground hover:text-foreground")}>
            <ArrowDownCircle className="h-4 w-4" /> Despesa
          </button>
          <button type="button" onClick={() => { setType("income"); setInstallmentMode(false); }}
            className={cn("flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition",
              type === "income" ? "bg-gold text-gold-foreground" : "text-muted-foreground hover:text-foreground")}>
            <ArrowUpCircle className="h-4 w-4" /> Receita
          </button>
        </div>

        {type === "expense" && (
          <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-surface-elevated px-3 py-2.5 text-sm">
            <input type="checkbox" checked={installmentMode} onChange={(e) => setInstallmentMode(e.target.checked)} className="h-4 w-4 accent-gold" />
            <Layers className="h-4 w-4 text-gold" />
            <span className="font-medium">Compra parcelada no cartão</span>
          </label>
        )}

        <Field label="Descrição">
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Mercado, Salário, Uber..."
            className="w-full rounded-xl bg-surface-elevated px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={installmentMode ? "Valor total (R$)" : "Valor (R$)"}>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0,00"
              className="w-full rounded-xl bg-surface-elevated px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50" />
          </Field>
          {installmentMode ? (
            <Field label="Parcelas">
              <input value={installments} onChange={(e) => setInstallments(e.target.value)} inputMode="numeric" placeholder="2"
                className="w-full rounded-xl bg-surface-elevated px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50" />
            </Field>
          ) : (
            <Field label="Data">
              <input type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)}
                className="w-full rounded-xl bg-surface-elevated px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50" />
            </Field>
          )}
        </div>

        <Field label="Categoria">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base">
              {category ? categoryEmoji(category) : "🏷️"}
            </span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full appearance-none rounded-xl bg-surface-elevated py-2.5 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50"
            >
              <option value="">Selecione uma categoria...</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.emoji}  {c.label}</option>
              ))}
              {categories.filter((c) => !CATEGORIES.some((x) => x.value === c)).map((c) => (
                <option key={c} value={c}>🏷️  {c}</option>
              ))}
            </select>
          </div>
        </Field>

        {type === "expense" && (
          <Field label={installmentMode ? "Cartão" : "Pago com (opcional)"}>
            <select value={cardId} onChange={(e) => setCardId(e.target.value)}
              className="w-full rounded-xl bg-surface-elevated px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50">
              <option value="">{installmentMode ? "Selecione..." : "Dinheiro / débito"}</option>
              {cards.filter((c) => !installmentMode || !c.is_benefit).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
        )}

        {add.isError && <p className="text-sm text-destructive">{(add.error as Error).message}</p>}

        <button type="submit" disabled={add.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gold py-3 text-sm font-semibold text-gold-foreground transition hover:opacity-90 disabled:opacity-60">
          <Plus className="h-4 w-4" /> {add.isPending ? "Salvando..." : installmentMode ? "Criar compra parcelada" : "Adicionar"}
        </button>
      </form>
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
