import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { DEFAULT_LIST_CATEGORIES, DEFAULT_CUSTOM_KIND, KIND_ICON, KIND_LABEL, type ListKind } from "@/lib/listCategories";

export const Route = createFileRoute("/nova-lista")({
  component: NovaListaPage,
  head: () => ({ meta: [{ title: "Nova lista — Ditto" }] }),
});

type Category = { id: string; name: string; kind: ListKind };

function NovaListaPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [categoryName, setCategoryName] = useState("Compras");
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryKind, setNewCategoryKind] = useState<ListKind>(DEFAULT_CUSTOM_KIND);
  const [error, setError] = useState("");

  const { data: categories = [] } = useQuery({
    queryKey: ["list_categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("list_categories").select("id,name,kind").order("name");
      if (error) throw error;
      return data as Category[];
    },
  });

  // First-time users: seed the three default categories.
  const seedDefaults = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("list_categories").insert(
        DEFAULT_LIST_CATEGORIES.map((c) => ({ name: c.name, kind: c.kind })),
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["list_categories"] }),
  });
  useQuery({
    queryKey: ["list_categories", "seed-check"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("list_categories").select("id", { count: "exact", head: true });
      if (error) throw error;
      if ((count ?? 0) === 0) seedDefaults.mutate();
      return true;
    },
  });

  const addCategory = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("list_categories").insert({ name: newCategoryName.trim(), kind: newCategoryKind }).select().single();
      if (error) throw error;
      return data as Category;
    },
    onSuccess: (cat) => {
      qc.invalidateQueries({ queryKey: ["list_categories"] });
      setCategoryName(cat.name);
      setAddingCategory(false);
      setNewCategoryName("");
      setNewCategoryKind(DEFAULT_CUSTOM_KIND);
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Dê um nome à lista.");
      const { error } = await supabase.from("lists").insert({ name: name.trim(), type: categoryName });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lists"] });
      navigate({ to: "/listas" });
    },
    onError: (e: Error) => setError(e.message || "Não deu pra criar a lista."),
  });

  return (
    <div className="mx-auto max-w-lg px-1">
      <header className="mb-6 flex items-center gap-3">
        <Link
          to="/listas"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold sm:text-2xl">Nova lista</h1>
      </header>

      <form onSubmit={(e) => { e.preventDefault(); setError(""); create.mutate(); }} className="space-y-5">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Nome da lista</span>
          <input
            value={name} onChange={(e) => setName(e.target.value)} required autoFocus
            placeholder="Ex.: Bolo de cenoura, Viagem à praia..."
            className="w-full rounded-xl bg-surface-elevated px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none"
          />
        </label>

        <div>
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Categoria</span>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => {
              const Icon = KIND_ICON[cat.kind];
              return (
                <button
                  key={cat.id} type="button" onClick={() => setCategoryName(cat.name)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition",
                    categoryName === cat.name
                      ? "bg-gold text-gold-foreground ring-gold"
                      : "bg-surface-elevated text-muted-foreground ring-border hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" /> {cat.name}
                </button>
              );
            })}

            {!addingCategory && (
              <button
                type="button" onClick={() => setAddingCategory(true)}
                className="flex items-center gap-1 rounded-full bg-surface-elevated px-3 py-1.5 text-xs font-medium text-muted-foreground ring-1 ring-dashed ring-border hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> Nova categoria
              </button>
            )}
          </div>

          {addingCategory && (
            <div className="mt-3 space-y-2 rounded-2xl bg-surface-elevated p-3 ring-1 ring-border">
              <div className="flex items-center gap-2">
                <input
                  autoFocus value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Nome da categoria"
                  className="flex-1 rounded-lg bg-surface px-2.5 py-2 text-sm focus:outline-none"
                />
                <button
                  type="button" onClick={() => { setAddingCategory(false); setNewCategoryName(""); }}
                  className="text-muted-foreground" aria-label="Cancelar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex gap-2">
                {(Object.keys(KIND_LABEL) as ListKind[]).map((k) => (
                  <button
                    key={k} type="button" onClick={() => setNewCategoryKind(k)}
                    className={cn(
                      "flex-1 rounded-lg py-1.5 text-xs font-medium",
                      newCategoryKind === k ? "bg-gold text-gold-foreground" : "bg-surface text-muted-foreground",
                    )}
                  >
                    {KIND_LABEL[k]}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Escolha o comportamento: Compras mostra valor por item, Receita mostra quantidade, Geral é só uma lista simples.
              </p>
              <button
                type="button"
                onClick={() => newCategoryName.trim() && addCategory.mutate()}
                className="w-full rounded-lg bg-gold py-2 text-xs font-semibold text-gold-foreground"
              >
                Criar categoria
              </button>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          type="submit" disabled={create.isPending}
          className="w-full rounded-2xl bg-gold py-3 text-sm font-semibold text-gold-foreground disabled:opacity-60"
        >
          {create.isPending ? "Criando..." : "Criar lista"}
        </button>
      </form>
    </div>
  );
}
