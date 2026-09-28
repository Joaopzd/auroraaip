import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Star, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { Task } from "@/lib/taskOrder";

export const Route = createFileRoute("/tarefa/$id")({
  component: TaskPage,
  head: () => ({ meta: [
    { title: "Tarefa — Ditto" },
    { name: "description", content: "Veja e organize uma tarefa do seu dia na Ditto." },
    { property: "og:title", content: "Tarefa — Ditto" },
    { property: "og:description", content: "Veja e organize uma tarefa do seu dia na Ditto." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});

function TaskPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const { data: task, isPending, isError } = useQuery({
    queryKey: ["tasks", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as Task | null;
    },
  });

  useEffect(() => {
    if (task) { setTitle(task.title); setDate(task.scheduled_date); }
  }, [task]);

  const save = useMutation({
    mutationFn: async (changes: Partial<Pick<Task, "title" | "scheduled_date" | "completed" | "is_priority">>) => {
      if (!task) return;
      if (changes.is_priority === true || (task.is_priority && changes.scheduled_date && changes.scheduled_date !== task.scheduled_date)) {
        const { error } = await supabase.from("tasks").update({ is_priority: false })
          .eq("scheduled_date", changes.scheduled_date ?? task.scheduled_date).eq("is_priority", true).neq("id", id);
        if (error) throw error;
      }
      const { error } = await supabase.from("tasks").update(changes).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setErrorMessage("");
    },
    onError: () => setErrorMessage("Não foi possível salvar a tarefa. Tente novamente."),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      navigate({ to: "/" });
    },
    onError: () => setErrorMessage("Não foi possível excluir a tarefa."),
  });

  return (
    <div className="mx-auto max-w-lg px-1">
      <header className="mb-7 flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild aria-label="Voltar para Meu Dia">
          <Link to="/"><ArrowLeft /></Link>
        </Button>
        <h1 className="text-2xl font-bold">Tarefa</h1>
      </header>
      {isPending ? <p className="text-sm text-muted-foreground">Carregando tarefa...</p>
        : isError ? <p role="alert" className="text-sm text-destructive">Não foi possível carregar a tarefa.</p>
        : !task ? <p className="text-sm text-muted-foreground">Tarefa não encontrada.</p>
        : <form className="space-y-6" onSubmit={(e) => {
          e.preventDefault();
          if (title.trim() && date) save.mutate({ title: title.trim(), scheduled_date: date });
        }}>
          <div>
            <label htmlFor="task-title" className="mb-2 block text-sm font-semibold">Nome</label>
            <input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} required
              className="w-full rounded-lg bg-surface px-4 py-3 text-base ring-1 ring-border focus:outline-none focus:ring-gold" />
          </div>
          <div>
            <label htmlFor="task-date" className="mb-2 block text-sm font-semibold">Dia</label>
            <input id="task-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required
              className="w-full rounded-lg bg-surface px-4 py-3 text-base ring-1 ring-border focus:outline-none focus:ring-gold" />
          </div>
          <label className="flex items-center gap-3 text-sm font-medium">
            <Checkbox checked={task.completed} disabled={save.isPending} onCheckedChange={(checked) => save.mutate({ completed: checked === true })} />
            Concluída
          </label>
          <Button type="button" variant="outline" disabled={save.isPending} onClick={() => save.mutate({ is_priority: !task.is_priority })}
            className="w-full justify-start gap-3">
            <Star className={task.is_priority ? "fill-gold text-gold" : "text-muted-foreground"} />
            {task.is_priority ? "Prioridade do dia" : "Definir como prioridade do dia"}
          </Button>
          {errorMessage && <p role="alert" className="text-sm text-destructive">{errorMessage}</p>}
          <div className="flex items-center justify-between gap-3 border-t border-border pt-5">
            <Button type="button" variant="ghost" className="text-destructive" disabled={remove.isPending}
              onClick={() => { if (window.confirm("Excluir esta tarefa?")) remove.mutate(); }}>
              <Trash2 /> Excluir
            </Button>
            <Button type="submit" disabled={save.isPending || !title.trim() || !date}>Salvar</Button>
          </div>
        </form>}
    </div>
  );
}