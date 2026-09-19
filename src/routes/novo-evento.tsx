import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Bell, Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  RECURRENCE_OPTIONS, REMINDER_OPTIONS, DEFAULT_CATEGORIES, categoryColorClass, nextPaletteColor,
  type Recurrence,
} from "@/lib/eventRecurrence";

export const Route = createFileRoute("/novo-evento")({
  validateSearch: (search: Record<string, unknown>) => ({
    id: typeof search.id === "string" ? search.id : undefined,
    date: typeof search.date === "string" ? search.date : undefined,
  }),
  component: NovoEventoPage,
  head: () => ({ meta: [{ title: "Novo evento — Ditto" }] }),
});

type Category = { id: string; name: string; color: string };
type EventRow = {
  id: string;
  title: string;
  category: string;
  event_date: string | null;
  time_label: string;
  description: string;
  recurrence: string;
  reminders: number[];
  day_of_week: number;
};

const today = () => new Date().toISOString().slice(0, 10);
const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];
const QUICK_TIMES = ["08:00", "12:00", "18:00", "20:00"];

function NovoEventoPage() {
  const { id, date } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEditing = !!id;

  const [eventDate, setEventDate] = useState(date || today());
  const [eventTime, setEventTime] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("Rotina");
  const [description, setDescription] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence>("never");
  const [reminders, setReminders] = useState<number[]>([]);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [error, setError] = useState("");

  const { data: categories = [] } = useQuery({
    queryKey: ["event_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_categories").select("id,name,color").order("name");
      if (error) throw error;
      return data as Category[];
    },
  });

  // First-time users: seed the default category set.
  const seedDefaults = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("event_categories").insert(
        DEFAULT_CATEGORIES.map((c) => ({ name: c.name, color: c.color })),
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["event_categories"] }),
  });
  const { data: categoriesChecked } = useQuery({
    queryKey: ["event_categories", "seed-check"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("event_categories").select("id", { count: "exact", head: true });
      if (error) throw error;
      if ((count ?? 0) === 0) seedDefaults.mutate();
      return true;
    },
  });

  const { data: existing } = useQuery({
    queryKey: ["routine_blocks", id],
    enabled: isEditing,
    queryFn: async () => {
      if (!id) throw new Error("Evento não encontrado.");
      const { data, error } = await supabase.from("routine_blocks").select("*").eq("id", id).single();
      if (error) throw error;
      return data as EventRow;
    },
  });

  useEffect(() => {
    if (existing) {
      setEventDate(existing.event_date || today());
      setEventTime(existing.time_label || "");
      setTitle(existing.title);
      setCategory(existing.category);
      setDescription(existing.description || "");
      setRecurrence(existing.recurrence as Recurrence);
      setReminders(existing.reminders || []);
    }
  }, [existing]);

  const addCategory = useMutation({
    mutationFn: async (name: string) => {
      const color = nextPaletteColor(categories.length);
      const { data, error } = await supabase
        .from("event_categories").insert({ name, color }).select().single();
      if (error) throw error;
      return data as Category;
    },
    onSuccess: (cat) => {
      qc.invalidateQueries({ queryKey: ["event_categories"] });
      setCategory(cat.name);
      setAddingCategory(false);
      setNewCategoryName("");
    },
    onError: (mutationError: Error) => setError(mutationError.message || "Não deu pra criar a categoria."),
  });

  const toggleReminder = (v: number) => {
    setReminders((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v].sort((a, b) => a - b)));
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Dê um nome ao evento.");
      if (reminders.length > 0 && typeof Notification !== "undefined" && Notification.permission === "default") {
        await Notification.requestPermission();
      }
      const dayOfWeek = new Date(eventDate + "T00:00:00").getDay();
      const payload = {
        title: title.trim(),
        category,
        event_date: eventDate,
        day_of_week: dayOfWeek,
        time_label: eventTime,
        description: description.trim(),
        recurrence,
        reminders,
      };
      if (isEditing) {
        if (!id) throw new Error("Evento não encontrado.");
        const { error } = await supabase.from("routine_blocks").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("routine_blocks").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["routine_blocks"] });
      navigate({ to: "/semana" });
    },
    onError: (e: Error) => setError(e.message || "Não deu pra salvar o evento."),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("Evento não encontrado.");
      const { error } = await supabase.from("routine_blocks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["routine_blocks"] });
      navigate({ to: "/semana" });
    },
  });

  const pickCategory = (cat: Category) => {
    setCategory(cat.name);
    if (!isEditing) {
      const def = DEFAULT_CATEGORIES.find((d) => d.name === cat.name);
      if (def) setRecurrence(def.recurrence);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-1">
      <header className="mb-6 flex items-center gap-3">
        <Link
          to="/semana"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold sm:text-2xl">{isEditing ? "Editar evento" : "Novo evento"}</h1>
      </header>

      <form
        onSubmit={(e) => { e.preventDefault(); setError(""); save.mutate(); }}
        className="space-y-5"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Dia">
            <input
              type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required
              className="w-full rounded-xl bg-surface-elevated px-3 py-2.5 text-sm focus:outline-none"
            />
          </Field>
          <Field label="Hora">
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <select
                  aria-label="Hora do evento"
                  value={eventTime.split(":")[0] ?? ""}
                  onChange={(e) => setEventTime(`${e.target.value}:${eventTime.split(":")[1] || "00"}`)}
                  className="min-w-0 rounded-xl bg-surface-elevated px-3 py-2.5 text-center text-base focus:outline-none"
                >
                  <option value="">Hora</option>
                  {HOURS.map((hour) => <option key={hour} value={hour}>{hour}</option>)}
                </select>
                <span className="font-semibold text-muted-foreground">:</span>
                <select
                  aria-label="Minuto do evento"
                  value={eventTime.split(":")[1] ?? ""}
                  onChange={(e) => setEventTime(`${eventTime.split(":")[0] || "00"}:${e.target.value}`)}
                  className="min-w-0 rounded-xl bg-surface-elevated px-3 py-2.5 text-center text-base focus:outline-none"
                >
                  <option value="">Min.</option>
                  {MINUTES.map((minute) => <option key={minute} value={minute}>{minute}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {QUICK_TIMES.map((time) => (
                  <button
                    key={time}
                    type="button"
                    onClick={() => setEventTime(time)}
                    className={cn(
                      "rounded-lg px-1 py-2 text-xs font-medium ring-1 ring-border",
                      eventTime === time ? "bg-gold text-gold-foreground ring-gold" : "bg-surface text-muted-foreground",
                    )}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>
          </Field>
        </div>

        <Field label="Nome do evento">
          <input
            value={title} onChange={(e) => setTitle(e.target.value)} required
            placeholder="Ex.: Consulta com o dentista"
            className="w-full rounded-xl bg-surface-elevated px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none"
          />
        </Field>

        <Field label="Categoria">
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat.id} type="button" onClick={() => pickCategory(cat)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition",
                  category === cat.name
                    ? "bg-gold text-gold-foreground ring-gold"
                    : "bg-surface-elevated text-muted-foreground ring-border hover:text-foreground",
                )}
              >
                <span className={cn("h-2 w-2 rounded-full", categoryColorClass(cat.color))} /> {cat.name}
              </button>
            ))}

            {addingCategory ? (
              <div
                className="flex items-center gap-1 rounded-full bg-surface-elevated px-2 py-1 ring-1 ring-border"
              >
                <input
                  autoFocus value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    const name = newCategoryName.trim();
                    if (!name || addCategory.isPending) return;
                    setError("");
                    addCategory.mutate(name);
                  }}
                  placeholder="Nova categoria"
                  className="w-28 bg-transparent px-1 text-xs focus:outline-none"
                />
                <button
                  type="button"
                  disabled={addCategory.isPending || !newCategoryName.trim()}
                  onClick={() => {
                    setError("");
                    addCategory.mutate(newCategoryName.trim());
                  }}
                  className="text-gold disabled:opacity-40"
                  aria-label="Salvar categoria"
                ><Plus className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => setAddingCategory(false)} className="text-muted-foreground" aria-label="Cancelar">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button" onClick={() => setAddingCategory(true)}
                className="flex items-center gap-1 rounded-full bg-surface-elevated px-3 py-1.5 text-xs font-medium text-muted-foreground ring-1 ring-dashed ring-border hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> Nova categoria
              </button>
            )}
          </div>
        </Field>

        <Field label="Descrição">
          <textarea
            value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
            placeholder="Detalhes opcionais..."
            className="w-full resize-none rounded-xl bg-surface-elevated px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none"
          />
        </Field>

        <Field label="Repetir evento">
          <select
            value={recurrence} onChange={(e) => setRecurrence(e.target.value as Recurrence)}
            className="w-full rounded-xl bg-surface-elevated px-3 py-2.5 text-sm focus:outline-none"
          >
            {RECURRENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>

        <div className="rounded-2xl bg-surface-elevated p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Bell className="h-4 w-4 text-gold" /> Lembretes (notificação no telefone)
          </div>
          <div className="flex flex-wrap gap-2">
            {REMINDER_OPTIONS.map((o) => (
              <button
                key={o.value} type="button" onClick={() => toggleReminder(o.value)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition",
                  reminders.includes(o.value)
                    ? "bg-gold text-gold-foreground ring-gold"
                    : "bg-surface text-muted-foreground ring-border hover:text-foreground",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          {reminders.length > 0 && (
            <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
              Para receber mesmo com a Ditto fechada, ative as notificações no Perfil e mantenha o aplicativo instalado no telefone.
            </p>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2 pb-6">
          <button
            type="submit" disabled={save.isPending}
            className="flex-1 rounded-2xl bg-gold py-3 text-sm font-semibold text-gold-foreground disabled:opacity-60"
          >
            {save.isPending ? "Salvando..." : isEditing ? "Salvar alterações" : "Criar evento"}
          </button>
          {isEditing && (
            <button
              type="button" onClick={() => remove.mutate()}
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive"
              aria-label="Excluir evento"
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
