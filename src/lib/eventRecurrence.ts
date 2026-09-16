export type Recurrence = "never" | "daily" | "weekdays" | "weekly" | "monthly" | "yearly";

export const RECURRENCE_OPTIONS: { value: Recurrence; label: string }[] = [
  { value: "never", label: "Nunca" },
  { value: "daily", label: "Diariamente" },
  { value: "weekdays", label: "Segunda a sexta" },
  { value: "weekly", label: "Semanalmente" },
  { value: "monthly", label: "Mensalmente" },
  { value: "yearly", label: "Anualmente" },
];

export const REMINDER_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "No horário" },
  { value: 10, label: "10 min antes" },
  { value: 30, label: "30 min antes" },
  { value: 60, label: "1 hora antes" },
  { value: 1440, label: "1 dia antes" },
];

// Default categories seeded for a brand-new user, per the product spec.
export const DEFAULT_CATEGORIES: { name: string; color: string; recurrence: Recurrence }[] = [
  { name: "Aniversário", color: "pink", recurrence: "yearly" },
  { name: "Médico", color: "rose", recurrence: "never" },
  { name: "Compras", color: "blue", recurrence: "never" },
  { name: "Lembrete", color: "gold", recurrence: "never" },
  { name: "Rotina", color: "teal", recurrence: "weekly" },
];

export const CATEGORY_COLOR_CLASS: Record<string, string> = {
  teal: "bg-teal-500",
  gold: "bg-gold",
  rose: "bg-rose-500",
  pink: "bg-pink-500",
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  green: "bg-emerald-500",
  orange: "bg-orange-500",
  red: "bg-red-500",
  indigo: "bg-indigo-500",
};
export function categoryColorClass(color: string | null | undefined): string {
  return (color && CATEGORY_COLOR_CLASS[color]) || "bg-muted-foreground/40";
}

const PALETTE = Object.keys(CATEGORY_COLOR_CLASS);
export function nextPaletteColor(existingCount: number): string {
  return PALETTE[existingCount % PALETTE.length];
}

export type EventLike = { event_date: string | null; recurrence: string; day_of_week: number };

/** Whether a (possibly recurring) routine/event row occurs on the given ISO date (YYYY-MM-DD). */
export function occursOn(ev: EventLike, dateISO: string): boolean {
  const d = new Date(dateISO + "T00:00:00");

  // Legacy rows created before "event_date" existed: fall back to plain weekly-by-weekday.
  if (!ev.event_date) return d.getDay() === ev.day_of_week;

  if (dateISO < ev.event_date) return false;
  const start = new Date(ev.event_date + "T00:00:00");
  switch (ev.recurrence) {
    case "never":
      return dateISO === ev.event_date;
    case "daily":
      return true;
    case "weekdays": {
      const dow = d.getDay();
      return dow >= 1 && dow <= 5;
    }
    case "weekly":
      return d.getDay() === start.getDay();
    case "monthly":
      return d.getDate() === start.getDate();
    case "yearly":
      return d.getDate() === start.getDate() && d.getMonth() === start.getMonth();
    default:
      return false;
  }
}

/** First occurrence on/after fromISO (inclusive), searching up to limitDays ahead. */
export function nextOccurrence(ev: EventLike, fromISO: string, limitDays = 366): string | null {
  const from = new Date(fromISO + "T00:00:00");
  for (let i = 0; i <= limitDays; i++) {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    if (occursOn(ev, iso)) return iso;
  }
  return null;
}

export function recurrenceLabel(r: string): string {
  return RECURRENCE_OPTIONS.find((o) => o.value === r)?.label ?? r;
}
