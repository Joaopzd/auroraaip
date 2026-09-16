import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { occursOn, nextOccurrence, categoryColorClass, type EventLike } from "@/lib/eventRecurrence";

export const Route = createFileRoute("/calendario")({
  component: CalendarioPage,
  head: () => ({ meta: [{ title: "Calendário — Ditto" }] }),
});

type EventRow = EventLike & {
  id: string;
  title: string;
  time_label: string;
  category: string;
};
type Category = { id: string; name: string; color: string };

const MONTH_LABEL = (d: Date) => d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];
const toISO = (d: Date) => d.toISOString().slice(0, 10);
const todayISO = () => toISO(new Date());

function CalendarioPage() {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [selected, setSelected] = useState<string | null>(null);

  const { data: events = [] } = useQuery({
    queryKey: ["routine_blocks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routine_blocks").select("id,title,event_date,time_label,recurrence,category,day_of_week");
      if (error) throw error;
      return data as EventRow[];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["event_categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("event_categories").select("id,name,color");
      if (error) throw error;
      return data as Category[];
    },
  });
  const catColor = (name: string) => categories.find((c) => c.name === name)?.color;

  const monthDays = useMemo(() => {
    const first = new Date(cursor);
    const firstWeekday = first.getDay();
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    return cells;
  }, [cursor]);

  const eventsOn = (iso: string) => events.filter((e) => occursOn(e, iso));

  const upcoming = useMemo(() => {
    const from = todayISO();
    const rows = events
      .map((e) => ({ e, date: nextOccurrence(e, from, 120) }))
      .filter((r): r is { e: EventRow; date: string } => !!r.date)
      .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1))
      .slice(0, 20);
    return rows;
  }, [events]);

  const selectedEvents = selected ? eventsOn(selected) : [];

  return (
    <div className="px-1">
      <header className="mb-6 flex items-center gap-3">
        <Link
          to="/semana"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold sm:text-2xl">Calendário</h1>
      </header>

      <section className="mb-6 rounded-3xl bg-surface p-4 ring-1 ring-border sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-elevated"
            aria-label="Mês anterior"
          ><ChevronLeft className="h-4 w-4" /></button>
          <h2 className="text-sm font-semibold capitalize">{MONTH_LABEL(cursor)}</h2>
          <button
            onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-elevated"
            aria-label="Próximo mês"
          ><ChevronRight className="h-4 w-4" /></button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-muted-foreground">
          {WEEKDAY_LABELS.map((w, i) => <div key={i} className="py-1">{w}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {monthDays.map((d, i) => {
            if (!d) return <div key={i} />;
            const iso = toISO(d);
            const has = eventsOn(iso).length > 0;
            const isToday = iso === todayISO();
            const isSelected = iso === selected;
            return (
              <button
                key={i}
                onClick={() => setSelected(iso)}
                className={cn(
                  "relative flex aspect-square flex-col items-center justify-center rounded-xl text-xs font-medium transition",
                  isSelected ? "bg-gold text-gold-foreground" : isToday ? "ring-1 ring-gold text-gold" : "text-foreground hover:bg-surface-elevated",
                )}
              >
                {d.getDate()}
                {has && <span className={cn("absolute bottom-1 h-1 w-1 rounded-full", isSelected ? "bg-gold-foreground" : "bg-gold")} />}
              </button>
            );
          })}
        </div>
      </section>

      {selected && (
        <section className="mb-6 rounded-2xl bg-surface p-4 ring-1 ring-border">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold capitalize">
              {new Date(selected + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
            </h3>
            <Link
              to="/novo-evento" search={{ date: selected }}
              className="flex items-center gap-1 rounded-full bg-gold/15 px-3 py-1 text-xs font-semibold text-gold"
            >
              <Plus className="h-3.5 w-3.5" /> Novo
            </Link>
          </div>
          {selectedEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum evento neste dia.</p>
          ) : (
            <ul className="space-y-2">
              {selectedEvents.map((e) => (
                <Link key={e.id} to="/novo-evento" search={{ id: e.id }}
                  className="flex items-center gap-2 rounded-xl bg-surface-elevated px-3 py-2 text-sm hover:ring-1 hover:ring-gold/40">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", categoryColorClass(catColor(e.category)))} />
                  <span className="flex-1 truncate">{e.title}</span>
                  {e.time_label && <span className="text-xs text-gold">{e.time_label}</span>}
                </Link>
              ))}
            </ul>
          )}
        </section>
      )}

      <section>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Próximos eventos</h3>
        {upcoming.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhum evento futuro por enquanto.
          </p>
        ) : (
          <ul className="space-y-2">
            {upcoming.map(({ e, date }) => (
              <Link key={e.id} to="/novo-evento" search={{ id: e.id }}
                className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 ring-1 ring-border hover:ring-gold/40">
                <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", categoryColorClass(catColor(e.category)))} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{e.title}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {new Date(date + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
                    {e.time_label ? ` · ${e.time_label}` : ""}
                  </p>
                </div>
              </Link>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
