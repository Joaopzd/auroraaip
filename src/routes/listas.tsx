import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, ChevronLeft, Check, Trash2, Lock, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { KIND_ICON, KIND_LABEL, type ListKind } from "@/lib/listCategories";

export const Route = createFileRoute("/listas")({
  component: ListasPage,
  head: () => ({ meta: [
    { title: "Listas — Ditto" },
    { name: "description", content: "Gerencie compras, receitas e listas gerais com a Ditto." },
    { property: "og:title", content: "Listas — Ditto" },
    { property: "og:description", content: "Gerencie compras, receitas e listas gerais com a Ditto." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});

type List = { id: string; name: string; type: string; is_fixed: boolean; created_at: string };
type Item = { id: string; list_id: string; content: string; completed: boolean; price: number | null; quantity: string | null };
type Category = { id: string; name: string; kind: ListKind };

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function ListasPage() {
  const qc = useQueryClient();
  const [openListId, setOpenListId] = useState<string | null>(null);

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

  const { data: categories = [] } = useQuery({
    queryKey: ["list_categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("list_categories").select("id,name,kind");
      if (error) throw error;
      return data as Category[];
    },
  });
  const kindOf = (typeName: string): ListKind =>
    categories.find((c) => c.name === typeName)?.kind
    ?? (typeName === "shopping" ? "shopping" : typeName === "notes" ? "general" : "general");

  const removeList = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lists").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lists"] }),
  });

  const openList = lists.find((l) => l.id === openListId);
  if (openList) return <ListDetail list={openList} kind={kindOf(openList.type)} onBack={() => setOpenListId(null)} />;

  return (
    <div className="px-5">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Listas</p>
          <h1 className="mt-1 text-3xl font-bold">Listas</h1>
        </div>
        <Link
          to="/nova-lista"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold text-gold-foreground"
          aria-label="Nova lista"
        >
          <Plus className="h-5 w-5" />
        </Link>
      </header>

      <ul className="space-y-2">
        {lists.map((l) => {
          const kind = kindOf(l.type);
          const Icon = KIND_ICON[kind];
          return (
            <li key={l.id}>
              <button onClick={() => setOpenListId(l.id)}
                className="flex w-full items-center gap-4 rounded-2xl bg-surface p-4 text-left ring-1 ring-border transition hover:ring-gold/40">
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl",
                  kind === "shopping" ? "bg-gold/15 text-gold" : "bg-surface-elevated text-foreground")}>
                  <Icon className="h-5 w-5" />
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
                  <p className="text-xs text-muted-foreground">{l.type}</p>
                </div>
                {!l.is_fixed && (
                  <button onClick={(e) => { e.stopPropagation(); removeList.mutate(l.id); }}
                    className="text-muted-foreground hover:text-destructive" aria-label="Remover lista">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </button>
            </li>
          );
        })}
        {lists.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Crie sua primeira lista no botão acima.
          </li>
        )}
      </ul>
    </div>
  );
}

function ListDetail({ list, kind, onBack }: { list: List; kind: ListKind; onBack: () => void }) {
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [showCheckout, setShowCheckout] = useState(false);

  const isShopping = kind === "shopping";
  const isRecipe = kind === "recipe";
  const isFixedShopping = list.is_fixed && isShopping;

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
      const p = isShopping && price.trim() ? parseFloat(price.replace(",", ".")) : null;
      const { error } = await supabase.from("list_items").insert({
        list_id: list.id, content: content.trim(),
        price: p !== null && Number.isFinite(p) ? p : null,
        quantity: isRecipe && quantity.trim() ? quantity.trim() : null,
      });
      if (error) throw error;
    },
    onSuccess: () => { setContent(""); setPrice(""); setQuantity(""); qc.invalidateQueries({ queryKey: ["list_items", list.id] }); },
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

  const updateQuantity = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: string | null }) => {
      const { error } = await supabase.from("list_items").update({ quantity }).eq("id", id);
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
      <header className="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{list.type}</p>
          <h1 className="mt-1 text-3xl font-bold">{list.name}</h1>
        </div>
        {isFixedShopping && hasItems && (
          <button
            onClick={() => setShowCheckout(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-gold-foreground shadow-[var(--shadow-gold)] sm:w-auto"
          >
            <Receipt className="h-4 w-4" /> Finalizar compra
          </button>
        )}
      </header>

      {isShopping && (
        <section className="mb-4 grid grid-cols-3 divide-x divide-border rounded-2xl bg-surface p-4 ring-1 ring-border">
          <MiniStat label="Itens" value={`${items.length}`} />
          <MiniStat label="Comprados" value={`${items.filter((i) => i.completed).length}`} />
          <MiniStat label="Total" value={fmt.format(total)} highlight />
        </section>
      )}

      <form onSubmit={(e) => { e.preventDefault(); if (content.trim()) add.mutate(); }}
        className="mb-4 flex items-center gap-2 rounded-2xl bg-surface p-2 ring-1 ring-border">
        <input value={content} onChange={(e) => setContent(e.target.value)}
          placeholder={isShopping ? "Adicionar item..." : isRecipe ? "Novo ingrediente..." : "Novo item..."}
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none" />
        {isShopping && (
          <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal"
            aria-label="Valor do item" placeholder="R$ 0,00"
            className="w-[4.5rem] shrink-0 rounded-xl bg-surface-elevated px-2 py-2 text-right text-sm focus:outline-none focus:ring-1 focus:ring-gold/40" />
        )}
        {isRecipe && (
          <input value={quantity} onChange={(e) => setQuantity(e.target.value)}
            placeholder="Qtd."
            className="w-16 shrink-0 rounded-xl bg-surface-elevated px-2 py-2 text-right text-sm focus:outline-none focus:ring-1 focus:ring-gold/40" />
        )}
        <button type="submit" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold text-gold-foreground" aria-label="Adicionar">
          <Plus className="h-5 w-5" />
        </button>
      </form>

      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.id}
            className={cn("flex items-center gap-2.5 rounded-2xl bg-surface px-3 py-3 ring-1 ring-border sm:gap-3 sm:px-4",
              it.completed && "opacity-60")}>
            <button onClick={() => toggle.mutate(it)}
              className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2",
                it.completed ? "border-gold bg-gold text-gold-foreground" : "border-muted-foreground/40")}
              aria-label="Concluir">
              {it.completed && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
            </button>
            <span className={cn("min-w-0 flex-1 truncate text-sm", it.completed && "line-through")}>{it.content}</span>
            {isShopping && (
              <input
                defaultValue={it.price ?? ""}
                onBlur={(e) => {
                  const raw = e.target.value.trim();
                  const v = raw ? parseFloat(raw.replace(",", ".")) : null;
                  const next = v !== null && Number.isFinite(v) ? v : null;
                  if (next !== it.price) updatePrice.mutate({ id: it.id, price: next });
                }}
                inputMode="decimal"
                aria-label={`Valor de ${it.content}`}
                placeholder="R$ 0,00"
                className="w-[4.5rem] shrink-0 rounded-lg bg-surface-elevated px-2 py-1.5 text-right text-xs focus:outline-none focus:ring-1 focus:ring-gold/40"
              />
            )}
            {isRecipe && (
              <input
                defaultValue={it.quantity ?? ""}
                onBlur={(e) => {
                  const next = e.target.value.trim() || null;
                  if (next !== it.quantity) updateQuantity.mutate({ id: it.id, quantity: next });
                }}
                placeholder="Qtd."
                className="w-16 shrink-0 rounded-lg bg-surface-elevated px-2 py-1.5 text-right text-xs focus:outline-none focus:ring-1 focus:ring-gold/40"
              />
            )}
            <button onClick={() => remove.mutate(it.id)}
              className="shrink-0 text-muted-foreground hover:text-destructive" aria-label="Remover">
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

      {isFixedShopping && allDone && !showCheckout && (
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

function MiniStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="min-w-0 px-2 text-center first:pl-0 last:pr-0">
      <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-1 truncate text-base font-bold tabular-nums", highlight && "text-gold")}>{value}</p>
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

      const { data: card, error: ce } = await supabase
        .from("credit_cards").select("id").ilike("name", "Santander").maybeSingle();
      if (ce) throw ce;
      if (!card) throw new Error("Cartão Santander não encontrado.");

      const { error: te } = await supabase.from("transactions").insert({
        type: "expense",
        amount: v,
        description: listName,
        category: "Mercado/Alimentação",
        occurred_on: todayISO,
        credit_card_id: card.id,
      });
      if (te) throw te;

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
