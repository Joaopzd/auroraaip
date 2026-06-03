import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Star, Check, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: MeuDiaPage,
  head: () => ({ meta: [{ title: "Meu Dia — Aurora" }] }),
});

type Task = {
  id: string;
  title: string;
  is_priority: boolean;
  completed: boolean;
  scheduled_date: string;
};

const today = () => new Date().toISOString().slice(0, 10);

function MeuDiaPage() {
  const qc = useQueryClient();
  const [newTitle, setNewTitle] = useState("");

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", today()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("scheduled_date", today())
        .order("is_priority", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Task[];
    },
  });

  const addTask = useMutation({
    mutationFn: async (title: string) => {
      const { error } = await supabase
        .from("tasks")
        .insert({ title, scheduled_date: today() });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const toggle = useMutation({
    mutationFn: async (t: Task) => {
      const { error } = await supabase
        .from("tasks")
        .update({ completed: !t.completed })
        .eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const setPriority = useMutation({
    mutationFn: async (t: Task) => {
      // unset others, set this
      await supabase.from("tasks").update({ is_priority: false }).eq("scheduled_date", today());
      const { error } = await supabase
        .from("tasks")
        .update({ is_priority: !t.is_priority })
        .eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const priority = tasks.find((t) => t.is_priority);
  const completed = tasks.filter((t) => t.completed).length;
  const total = tasks.length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

  const todayLabel = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  return (
    <div className="px-5">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Meu Dia</p>
        <h1 className="mt-1 text-3xl font-bold capitalize">{todayLabel}</h1>
      </header>

      {/* Priority */}
      <section className="mb-6 overflow-hidden rounded-3xl bg-[var(--gradient-hero)] p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold">
          <Star className="h-3.5 w-3.5 fill-gold" />
          Prioridade do dia
        </div>
        {priority ? (
          <p className="mt-3 text-xl font-semibold leading-snug">{priority.title}</p>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Toque na estrela ao lado de uma tarefa para destacá-la como prioridade.
          </p>
        )}
      </section>

      {/* Progress */}
      <section className="mb-6 rounded-2xl bg-surface p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Progresso</span>
          <span className="text-sm font-semibold">
            {completed}/{total} concluídas
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-elevated">
          <div
            className="h-full rounded-full bg-gold transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </section>

      {/* New task */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!newTitle.trim()) return;
          addTask.mutate(newTitle.trim());
          setNewTitle("");
        }}
        className="mb-4 flex gap-2 rounded-2xl bg-surface p-2 ring-1 ring-border"
      >
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Nova tarefa de hoje..."
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

      {/* Task list */}
      <ul className="space-y-2">
        {tasks.map((t) => (
          <li
            key={t.id}
            className={cn(
              "flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 ring-1 ring-border",
              t.completed && "opacity-60",
            )}
          >
            <button
              onClick={() => toggle.mutate(t)}
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
                t.completed
                  ? "border-gold bg-gold text-gold-foreground"
                  : "border-muted-foreground/40",
              )}
              aria-label="Concluir"
            >
              {t.completed && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
            </button>
            <span className={cn("flex-1 text-sm", t.completed && "line-through")}>
              {t.title}
            </span>
            <button
              onClick={() => setPriority.mutate(t)}
              className={cn(
                "rounded-lg p-1.5",
                t.is_priority ? "text-gold" : "text-muted-foreground hover:text-foreground",
              )}
              aria-label="Marcar prioridade"
            >
              <Star className={cn("h-4 w-4", t.is_priority && "fill-gold")} />
            </button>
            <button
              onClick={() => remove.mutate(t.id)}
              className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive"
              aria-label="Remover"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
        {tasks.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nenhuma tarefa para hoje. Comece adicionando uma acima.
          </li>
        )}
      </ul>
    </div>
  );
}
