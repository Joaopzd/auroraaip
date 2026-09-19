import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowDownCircle, ArrowLeft, ArrowUpCircle, Layers, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CATEGORIES, categoryEmoji } from "@/lib/categories";
import { todayISO, type Card, type Tx } from "@/lib/finance";

export const Route = createFileRoute("/nova-movimentacao")({
  validateSearch: (search: Record<string, unknown>) => ({
    id: typeof search.id === "string" ? search.id : undefined,
  }),
  component: NovaMovimentacaoPage,
  head: () => ({ meta: [{ title: "Nova movimentação — Ditto" }] }),
});

function NovaMovimentacaoPage() {
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEditing = !!id;

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
    queryKey: ["transactions", "categories-only"],
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

  const { data: existing } = useQuery({
    queryKey: ["transactions", id],
    enabled: isEditing,
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("*").eq("id", id!).single();
      if (error) throw error;
      return { ...data, amount: Number(data.amount) } as Tx;
    },
  });

  useEffect(() => {
    if (existing) {
      setType(existing.type);
      setDescription(existing.description);
      setAmount(String(existing.amount).replace(".", ","));
      setCategory(existing.category ?? "");
      setOccurredOn(existing.occurred_on);
      setCardId(existing.credit_card_id ?? "");
    }
  }, [existing]);

  const save = useMutation({
    mutationFn: async () => {
      const value = parseFloat(amount.replace(",", "."));
      if (!description.trim() || !Number.isFinite(value) || value <= 0) {
        throw new Error("Preencha descrição e valor válidos.");
      }
      if (!isEditing && installmentMode && type === "expense") {
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
        return;
      }

      const payload = {
        type, amount: value,
        description: description.trim(),
        category: category.trim() || null,
        occurred_on: occurredOn,
        credit_card_id: type === "expense" && cardId ? cardId : null,
      };
      if (isEditing) {
        const { error } = await supabase.from("transactions").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("transactions").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["purchases"] });
      toast.success(isEditing ? "Movimentação atualizada!" : installmentMode ? "Compra parcelada criada!" : "Lançamento adicionado!");
      navigate({ to: "/financas" });
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("transactions").delete().eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Movimentação removida.");
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
        <h1 className="text-xl font-bold sm:text-2xl">{isEditing ? "Editar movimentação" : "Nova movimentação"}</h1>
      </header>

      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-5">
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

        {!isEditing && type === "expense" && (
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
          <Field label={installmentMode && !isEditing ? "Valor total (R$)" : "Valor (R$)"}>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0,00"
              className="w-full rounded-xl bg-surface-elevated px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50" />
          </Field>
          {installmentMode && !isEditing ? (
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
          <Field label={installmentMode && !isEditing ? "Cartão" : "Pago com (opcional)"}>
            <select value={cardId} onChange={(e) => setCardId(e.target.value)}
              className="w-full rounded-xl bg-surface-elevated px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50">
              <option value="">{installmentMode && !isEditing ? "Selecione..." : "Dinheiro / débito"}</option>
              {cards.filter((c) => !(installmentMode && !isEditing) || !c.is_benefit).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
        )}

        {save.isError && <p className="text-sm text-destructive">{(save.error as Error).message}</p>}

        <div className="flex gap-2 pb-6">
          <button type="submit" disabled={save.isPending}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gold py-3 text-sm font-semibold text-gold-foreground transition hover:opacity-90 disabled:opacity-60">
            <Plus className="h-4 w-4" />
            {save.isPending ? "Salvando..." : isEditing ? "Salvar alterações" : installmentMode ? "Criar compra parcelada" : "Adicionar"}
          </button>
          {isEditing && (
            <button
              type="button"
              onClick={() => { if (confirm("Remover esta movimentação?")) remove.mutate(); }}
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive"
              aria-label="Excluir movimentação"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          )}
        </div>
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
