import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, Wallet, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { occursOn, type EventLike } from "@/lib/eventRecurrence";
import { fmt } from "@/lib/finance";

export const Route = createFileRoute("/alertas")({
  component: AlertasPage,
  head: () => ({ meta: [
    { title: "Alertas — Ditto" },
    { name: "description", content: "Veja eventos e contas pendentes da sua rotina." },
    { property: "og:title", content: "Alertas — Ditto" },
    { property: "og:description", content: "Veja eventos e contas pendentes da sua rotina." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});

type EventRow = EventLike & {
  id: string;
  title: string;
  time_label: string;
  category: string;
  reminders: number[];
};
type BillRow = { id: string; description: string; amount: number; due_date: string; is_paid: boolean };
type Alert = { id: string; kind: "event" | "bill"; title: string; detail: string; date: string; time: string; to: "/novo-evento" | "/financas" };

function isoDate(offset = 0) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function AlertasPage() {
  const today = isoDate();
  const tomorrow = isoDate(1);
  const horizon = isoDate(90);

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["pending_alerts", today],
    queryFn: async () => {
      const [{ data: events, error: eventError }, { data: bills, error: billError }] = await Promise.all([
        supabase.from("routine_blocks").select("id,title,event_date,time_label,recurrence,category,day_of_week,reminders"),
        supabase.from("bills").select("id,description,amount,due_date,is_paid").eq("is_paid", false).lte("due_date", horizon),
      ]);
      if (eventError) throw eventError;
      if (billError) throw billError;

      const pending: Alert[] = [];
      for (const event of (events ?? []) as EventRow[]) {
        if (!event.reminders?.length) continue;
        for (let offset = 0; offset <= 90; offset += 1) {
          const date = isoDate(offset);
          if (!occursOn(event, date)) continue;
          pending.push({
            id: `event-${event.id}-${date}`,
            kind: "event",
            title: event.title,
            detail: `${event.category} · lembrete ativo`,
            date,
            time: event.time_label || "23:59",
            to: "/novo-evento",
          });
          break;
        }
      }
      for (const bill of (bills ?? []) as BillRow[]) {
        pending.push({
          id: `bill-${bill.id}`,
          kind: "bill",
          title: bill.description,
          detail: `${fmt.format(Number(bill.amount))} · conta pendente`,
          date: bill.due_date,
          time: "23:59",
          to: "/financas",
        });
      }
      return pending.sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
    },
  });

  const groups = [
    { label: "Hoje", items: alerts.filter((alert) => alert.date <= today) },
    { label: "Amanhã", items: alerts.filter((alert) => alert.date === tomorrow) },
    { label: "Próximos", items: alerts.filter((alert) => alert.date > tomorrow) },
  ].filter((group) => group.items.length > 0);

  return (
    <div className="mx-auto max-w-2xl px-1 pb-6 sm:px-4">
      <header className="mb-6 flex items-center gap-3">
        <Link to="/" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-elevated" aria-label="Voltar">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Central</p>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Bell className="h-6 w-6 text-gold" /> Alertas</h1>
        </div>
      </header>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((item) => <div key={item} className="h-20 animate-pulse rounded-2xl bg-surface" />)}</div>
      ) : groups.length === 0 ? (
        <div className="py-20 text-center">
          <Bell className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 font-semibold">Tudo em dia</h2>
          <p className="mt-1 text-sm text-muted-foreground">Nenhum evento com lembrete ou conta pendente.</p>
        </div>
      ) : (
        <div className="space-y-7">
          {groups.map((group) => (
            <section key={group.label}>
              <h2 className="mb-2 text-sm font-semibold">{group.label}</h2>
              <ul className="space-y-2">
                {group.items.map((alert) => (
                  <li key={alert.id}>
                    <Link
                      to={alert.to}
                      search={alert.kind === "event" ? { id: alert.id.split("-")[1], date: undefined } : undefined}
                      className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl bg-surface p-4 ring-1 ring-border transition hover:ring-gold/40"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/10 text-gold">
                        {alert.kind === "bill" ? <Wallet className="h-5 w-5" /> : <CalendarDays className="h-5 w-5" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{alert.title}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {new Date(`${alert.date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                          {alert.kind === "event" ? ` às ${alert.time}` : ""} · {alert.detail}
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}