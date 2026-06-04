import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Trash2, Wallet } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/semana")({
  component: SemanaPage,
  head: () => ({ meta: [{ title: "Semana — Aurora" }] }),
});

type Block = {
  id: string;
  day_of_week: number;
  time_label: string;
  title: string;
  completed: boolean;
};

const DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function SemanaPage() {
  const qc = useQueryClient();
  const [activeDay, setActiveDay] = useState(new Date().getDay());
  const [time, setTime] = useState("");
  const [title, setTitle] = useState("");

  const { data: blocks = [] } = useQuery({
    queryKey: ["routine_blocks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routine_blocks")
        .select("*")
        .order("time_label", { ascending: true });
      if (error) throw error;
      return data as Block[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("routine_blocks").insert({
        day_of_week: activeDay,
        time_label: time.trim(),
        title: title.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTime("");
      setTitle("");
      qc.invalidateQueries({ queryKey: ["routine_blocks"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("routine_blocks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["routine_blocks"] }),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase
        .from("routine_blocks")
        .update({ completed })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["routine_blocks"] }),
  });

  const dayBlocks = blocks.filter((b) => b.day_of_week === activeDay);

  return (
    <div className="px-5">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Semana</p>
        <h1 className="mt-1 text-3xl font-bold">Sua rotina</h1>
      </header>

      <div className="mb-6 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {SHORT.map((d, i) => {
          const active = i === activeDay;
          return (
            <button
              key={d}
              onClick={() => setActiveDay(i)}
              className={`flex shrink-0 flex-col items-center gap-1 rounded-2xl px-4 py-3 text-xs font-semibold transition ${
                active
                  ? "bg-gold text-gold-foreground shadow-[var(--shadow-gold)]"
                  : "bg-surface text-muted-foreground"
              }`}
            >
              <span className="text-[10px] uppercase tracking-wider opacity-80">{d}</span>
            </button>
          );
        })}
      </div>

      <h2 className="mb-3 text-lg font-semibold">{DAYS[activeDay]}</h2>

      <ul className="mb-6 space-y-2">
        {dayBlocks.map((b) => (
          <li
            key={b.id}
            className={`flex items-center gap-3 rounded-2xl bg-surface p-4 ring-1 ring-border transition ${
              b.completed ? "opacity-60" : ""
            }`}
          >
            <Checkbox
              checked={b.completed}
              onCheckedChange={(v) => toggle.mutate({ id: b.id, completed: v === true })}
              className="h-5 w-5 rounded-md border-gold data-[state=checked]:bg-gold data-[state=checked]:text-gold-foreground"
              aria-label="Marcar como concluído"
            />
            <div className="w-14 shrink-0 text-sm font-semibold text-gold">
              {b.time_label || "--:--"}
            </div>
            <div className="h-10 w-px bg-border" />
            <div className={`flex-1 text-sm ${b.completed ? "line-through" : ""}`}>{b.title}</div>
            <button
              onClick={() => remove.mutate(b.id)}
              className="text-muted-foreground hover:text-destructive"
              aria-label="Remover"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
        {dayBlocks.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nenhum bloco para {DAYS[activeDay]} ainda.
          </li>
        )}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          add.mutate();
        }}
        className="space-y-2 rounded-2xl bg-surface p-3 ring-1 ring-border"
      >
        <div className="flex gap-2">
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-24 rounded-xl bg-surface-elevated px-3 py-2 text-sm focus:outline-none"
          />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Novo bloco de rotina..."
            className="flex-1 rounded-xl bg-surface-elevated px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none"
          />
          <button
            type="submit"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold text-gold-foreground"
            aria-label="Adicionar"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </form>
    </div>
  );
}
