import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, ShoppingBag, StickyNote, ChevronLeft, Check, Trash2, Lock, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/listas")({
  component: ListasPage,
  head: () => ({ meta: [{ title: "Listas — Aurora" }] }),
});

type List = { id: string; name: string; type: "shopping" | "notes"; is_fixed: boolean; created_at: string };
type Item = { id: string; list_id: string; content: string; completed: boolean; price: number | null };

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function ListasPage() {
  const qc = useQueryClient();
  const [openListId, setOpenListId] = useState<string | null>(null);
  const [newListName, setNewListName] = useState("");
  const [newListType, setNewListType] = useState<"shopping" | "notes">("shopping");

  const { data: lists = [] } = useQuery({
    queryKey: ["lists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lists")
        .select("*")
        .order("is_fixed", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as List[];
    },
  });

  const addList = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("lists")
        .insert({ name: newListName.trim(), type: newListType });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewListName("");
      qc.invalidateQueries({ queryKey: ["lists"] });
    },
  });

  const removeList = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lists").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lists"] }),
  });

  const openList = lists.find((l) => l.id === openListId);
  if (openList) return <ListDetail list={openList} onBack={() => setOpenListId(null)} />;

  return (
    <div className="px-5">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Listas</p>
        <h1 className="mt-1 text-3xl font-bold">Compras & Notas</h1>
      </header>

      <form
        onSubmit={(e) => { e.preventDefault(); if (newListName.trim()) addList.mutate(); }}
        className="mb-6 rounded-2xl bg-surface p-3 ring-1 ring-border"
      >
        <div className="mb-2 flex gap-2">
          <button type="button" onClick={() => setNewListType("shopping")}
            className={cn("flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-sm font-medium",
              newListType === "shopping" ? "bg-gold text-gold-foreground" : "bg-surface-elevated text-muted-foreground")}>
            <ShoppingBag className="h-4 w-4" /> Compras
          </button>
          <button type="button" onClick={() => setNewListType("notes")}
            className={cn("flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-sm font-medium",
              newListType === "notes" ? "bg-gold text-gold-foreground" : "bg-surface-elevated text-muted-foreground")}>
            <StickyNote className="h-4 w-4" /> Notas
          </button>
        </div>
        <div className="flex gap-2">
          <input value={newListName} onChange={(e) => setNewListName(e.target.value)}
            placeholder="Nome da nova lista..."
            className="flex-1 rounded-xl bg-surface-elevated px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none" />
          <button type="submit" className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold text-gold-foreground" aria-label="Criar lista">
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </form>

      <ul className="space-y-2">
        {lists.map((l) => (
          <li key={l.id}>
            <button onClick={() => setOpenListId(l.id)}
              className="flex w-full items-center gap-4 rounded-2xl bg-surface p-4 text-left ring-1 ring-border transition hover:ring-gold/40">
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl",
                l.type === "shopping" ? "bg-gold/15 text-gold" : "bg-surface-elevated text-foreground")}>
                {l.type === "shopping" ? <ShoppingBag className="h-5 w-5" /> : <StickyNote className="h-5 w-5" />}
              </div>
              <div className="flex-1">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  {l.name}
                  {l.is_fixed && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-medium text-gold">
                      <Lock className="h-2.5 w-2.5" /> Fixa
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {l.type === "shopping" ? "Lista de compras" : "Notas rápidas"}
                </p>
              </div>
              {!l.is_fixed && (
                <button onClick={(e) => { e.stopPropagation(); removeList.mutate(l.id); }}
                  className="text-muted-foreground hover:text-destructive" aria-label="Remover lista">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </button>
          </li>
        ))}
        {lists.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Crie sua primeira lista acima.
          </li>
        )}
      </ul>
    </div>
  );
}

function ListDetail({ list, onBack }: { list: List; onBack: () => void }) {
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const [price, setPrice] = useState("");
  const [showCheckout, setShowCheckout] = useState(false);

  const isShoppingMonth = list.is_fixed && list.type === "shopping";

  const { data: items = [] } = useQuery({
    queryKey: ["list_items", list.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("list_items").select("*").eq("list_id", list.id)
        .order("completed", { ascending: true }).order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((i) => ({ ...i, price: i.price !== null ? Number(i.price) : null })) as Item[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const p = price.trim() ? parseFloat(price.replace(",", ".")) : null;
      const { error } = await supabase.from("list_items").insert({
        list_id: list.id, content: content.trim(),
        price: p !== null && Number.isFinite(p) ? p : null,
      });
      if (error) throw error;
    },
    onSuccess: () => { setContent(""); setPrice(""); qc.invalidateQueries({ queryKey: ["list_items", list.id] }); },
  });

  const toggle = useMutation({
    mutationFn: async (it: Item) => {
      const { error } = await supabase.from("list_items").update({ completed: !it.completed }).eq("id", it.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["list_items", list.id] }),
  });

  const updatePrice = useMutation({
    mutationFn: async ({ id, price }: { id: string; price: number | null }) => {
      const { error } = await supabase.from("list_items").update({ price }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["list_items", list.id] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("list_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["list_items", list.id] }),
  });

  const { total, completedTotal, allDone, hasItems } = useMemo(() => {
    const total = items.reduce((acc, i) => acc + (i.price ?? 0), 0);
    const completedTotal = items.filter((i) => i.completed).reduce((acc, i) => acc + (i.price ?? 0), 0);
    return {
      total, completedTotal,
      allDone: items.length > 0 && items.every((i) => i.completed),
      hasItems: items.length > 0,
    };
  }, [items]);

  return (
    <div className="px-5">
      <button onClick={onBack} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Listas
      </button>
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {list.type === "shopping" ? "Compras" : "Notas"}
          </p>
          <h1 className="mt-1 text-3xl font-bold">{list.name}</h1>
        </div>
        {isShoppingMonth && hasItems && (
          <button
            onClick={() => setShowCheckout(true)}
            className="flex items-center gap-2 rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-gold-foreground shadow-[var(--shadow-gold)]"
          >
            <Receipt className="h-4 w-4" /> Finalizar compra
          </button>
        )}
      </header>

      {isShoppingMonth && (
        <section className="mb-4 grid gap-3 sm:grid-cols-3">
          <Stat label="Itens" value={`${items.length}`} />
          <Stat label="Comprados" value={`${items.filter((i) => i.completed).length} · ${fmt.format(completedTotal)}`} />
          <Stat label="Total estimado" value={fmt.format(total)} highlight />
        </section>
      )}

      <form onSubmit={(e) => { e.preventDefault(); if (content.trim()) add.mutate(); }}
        className="mb-4 flex gap-2 rounded-2xl bg-surface p-2 ring-1 ring-border">
        <input value={content} onChange={(e) => setContent(e.target.value)}
          placeholder={list.type === "shopping" ? "Adicionar item..." : "Nova nota..."}
          className="flex-1 bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none" />
        {list.type === "shopping" && (
          <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal"
            placeholder="R$"
            className="w-20 rounded-xl bg-surface-elevated px-2 py-2 text-right text-sm focus:outline-none" />
        )}
        <button type="submit" className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold text-gold-foreground" aria-label="Adicionar">
          <Plus className="h-5 w-5" />
        </button>
      </form>

      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.id}
            className={cn("flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 ring-1 ring-border",
              it.completed && "opacity-60")}>
            <button onClick={() => toggle.mutate(it)}
              className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2",
                it.completed ? "border-gold bg-gold text-gold-foreground" : "border-muted-foreground/40")}
              aria-label="Concluir">
              {it.completed && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
            </button>
            <span className={cn("flex-1 text-sm", it.completed && "line-through")}>{it.content}</span>
            {list.type === "shopping" && (
              <input
                defaultValue={it.price ?? ""}
                onBlur={(e) => {
                  const raw = e.target.value.trim();
                  const v = raw ? parseFloat(raw.replace(",", ".")) : null;
                  const next = v !== null && Number.isFinite(v) ? v : null;
                  if (next !== it.price) updatePrice.mutate({ id: it.id, price: next });
                }}
                inputMode="decimal"
                placeholder="R$"
                className="w-20 rounded-lg bg-surface-elevated px-2 py-1 text-right text-xs focus:outline-none focus:ring-1 focus:ring-gold/40"
              />
            )}
            <button onClick={() => remove.mutate(it.id)}
              className="text-muted-foreground hover:text-destructive" aria-label="Remover">
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
        {items.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Lista vazia. Comece adicionando um item acima.
          </li>
        )}
      </ul>

      {isShoppingMonth && allDone && !showCheckout && (
        <div className="mt-6 rounded-2xl bg-gold/10 p-4 text-center ring-1 ring-gold/30">
          <p className="text-sm font-medium text-gold">Tudo comprado! Finalize para lançar a despesa no Santander.</p>
          <button onClick={() => setShowCheckout(true)}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-gold-foreground">
            <Receipt className="h-4 w-4" /> Finalizar agora
          </button>
        </div>
      )}

      {showCheckout && (
        <CheckoutModal
          listId={list.id}
          listName={list.name}
          initialTotal={total > 0 ? total : completedTotal}
          onClose={() => setShowCheckout(false)}
        />
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn("rounded-2xl p-4 ring-1 ring-border", highlight ? "bg-[var(--gradient-hero)]" : "bg-surface")}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}

function CheckoutModal({
  listId, listName, initialTotal, onClose,
}: { listId: string; listName: string; initialTotal: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [value, setValue] = useState(initialTotal.toFixed(2));
  const todayISO = new Date().toISOString().slice(0, 10);

  const finalize = useMutation({
    mutationFn: async () => {
      const v = parseFloat(value.replace(",", "."));
      if (!Number.isFinite(v) || v <= 0) throw new Error("Informe um valor válido.");

      // Find Santander card
      const { data: card, error: ce } = await supabase
        .from("credit_cards").select("id").ilike("name", "Santander").maybeSingle();
      if (ce) throw ce;
      if (!card) throw new Error("Cartão Santander não encontrado.");

      // Create expense
      const { error: te } = await supabase.from("transactions").insert({
        type: "expense",
        amount: v,
        description: listName,
        category: "Mercado/Alimentação",
        occurred_on: todayISO,
        credit_card_id: card.id,
      });
      if (te) throw te;

      // Reset list: delete all items to restart the month
      const { error: de } = await supabase.from("list_items").delete().eq("list_id", listId);
      if (de) throw de;
    },
    onSuccess: () => {
      toast.success(`Despesa de ${fmt.format(parseFloat(value.replace(",", ".")))} lançada no Santander.`);
      qc.invalidateQueries({ queryKey: ["list_items", listId] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl border border-border bg-surface p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold text-gold-foreground">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Finalizar compra</h3>
            <p className="text-xs text-muted-foreground">{listName}</p>
          </div>
        </div>

        <div className="mt-5">
          <label className="block text-xs font-medium text-muted-foreground">
            Valor total gasto (ajuste se necessário)
          </label>
          <div className="mt-2 flex items-center gap-2 rounded-xl bg-surface-elevated px-3 py-2 ring-1 ring-border focus-within:ring-gold/60">
            <span className="text-sm text-muted-foreground">R$</span>
            <input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              inputMode="decimal"
              className="flex-1 bg-transparent text-lg font-semibold focus:outline-none"
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Será lançado como despesa no cartão <strong className="text-gold">Santander</strong> e a lista será limpa para o próximo mês.
          </p>
        </div>

        {finalize.isError && (
          <p className="mt-3 text-xs text-destructive">{(finalize.error as Error).message}</p>
        )}

        <div className="mt-6 flex gap-2">
          <button onClick={onClose}
            className="flex-1 rounded-xl bg-surface-elevated px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground">
            Cancelar
          </button>
          <button onClick={() => finalize.mutate()} disabled={finalize.isPending}
            className="flex-1 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-gold-foreground disabled:opacity-60">
            {finalize.isPending ? "Lançando..." : "Confirmar e lançar"}
          </button>
        </div>
      </div>
    </div>
  );
}
