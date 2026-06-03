import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, ShoppingBag, StickyNote, ChevronLeft, Check, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/listas")({
  component: ListasPage,
  head: () => ({ meta: [{ title: "Listas — Aurora" }] }),
});

type List = { id: string; name: string; type: "shopping" | "notes"; created_at: string };
type Item = { id: string; list_id: string; content: string; completed: boolean };

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

  if (openList) {
    return <ListDetail list={openList} onBack={() => setOpenListId(null)} />;
  }

  return (
    <div className="px-5">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Listas</p>
        <h1 className="mt-1 text-3xl font-bold">Compras & Notas</h1>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!newListName.trim()) return;
          addList.mutate();
        }}
        className="mb-6 rounded-2xl bg-surface p-3 ring-1 ring-border"
      >
        <div className="mb-2 flex gap-2">
          <button
            type="button"
            onClick={() => setNewListType("shopping")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-sm font-medium",
              newListType === "shopping" ? "bg-gold text-gold-foreground" : "bg-surface-elevated text-muted-foreground",
            )}
          >
            <ShoppingBag className="h-4 w-4" />
            Compras
          </button>
          <button
            type="button"
            onClick={() => setNewListType("notes")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-sm font-medium",
              newListType === "notes" ? "bg-gold text-gold-foreground" : "bg-surface-elevated text-muted-foreground",
            )}
          >
            <StickyNote className="h-4 w-4" />
            Notas
          </button>
        </div>
        <div className="flex gap-2">
          <input
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            placeholder="Nome da nova lista..."
            className="flex-1 rounded-xl bg-surface-elevated px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none"
          />
          <button
            type="submit"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold text-gold-foreground"
            aria-label="Criar lista"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </form>

      <ul className="space-y-2">
        {lists.map((l) => (
          <li key={l.id}>
            <button
              onClick={() => setOpenListId(l.id)}
              className="flex w-full items-center gap-4 rounded-2xl bg-surface p-4 text-left ring-1 ring-border transition hover:ring-gold/40"
            >
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl",
                  l.type === "shopping" ? "bg-gold/15 text-gold" : "bg-surface-elevated text-foreground",
                )}
              >
                {l.type === "shopping" ? <ShoppingBag className="h-5 w-5" /> : <StickyNote className="h-5 w-5" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{l.name}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {l.type === "shopping" ? "Lista de compras" : "Notas rápidas"}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeList.mutate(l.id);
                }}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Remover lista"
              >
                <Trash2 className="h-4 w-4" />
              </button>
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

  const { data: items = [] } = useQuery({
    queryKey: ["list_items", list.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("list_items")
        .select("*")
        .eq("list_id", list.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Item[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("list_items")
        .insert({ list_id: list.id, content: content.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      setContent("");
      qc.invalidateQueries({ queryKey: ["list_items", list.id] });
    },
  });

  const toggle = useMutation({
    mutationFn: async (it: Item) => {
      const { error } = await supabase
        .from("list_items")
        .update({ completed: !it.completed })
        .eq("id", it.id);
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

  return (
    <div className="px-5">
      <button
        onClick={onBack}
        className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Listas
      </button>
      <header className="mb-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {list.type === "shopping" ? "Compras" : "Notas"}
        </p>
        <h1 className="mt-1 text-3xl font-bold">{list.name}</h1>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!content.trim()) return;
          add.mutate();
        }}
        className="mb-4 flex gap-2 rounded-2xl bg-surface p-2 ring-1 ring-border"
      >
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={list.type === "shopping" ? "Adicionar item..." : "Nova nota..."}
          className="flex-1 bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none"
        />
        <button
          type="submit"
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold text-gold-foreground"
          aria-label="Adicionar"
        >
          <Plus className="h-5 w-5" />
        </button>
      </form>

      <ul className="space-y-2">
        {items.map((it) => (
          <li
            key={it.id}
            className={cn(
              "flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 ring-1 ring-border",
              it.completed && "opacity-60",
            )}
          >
            <button
              onClick={() => toggle.mutate(it)}
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2",
                it.completed
                  ? "border-gold bg-gold text-gold-foreground"
                  : "border-muted-foreground/40",
              )}
              aria-label="Concluir"
            >
              {it.completed && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
            </button>
            <span className={cn("flex-1 text-sm", it.completed && "line-through")}>
              {it.content}
            </span>
            <button
              onClick={() => remove.mutate(it.id)}
              className="text-muted-foreground hover:text-destructive"
              aria-label="Remover"
            >
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
    </div>
  );
}
