import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { occursOn, type EventLike } from "@/lib/eventRecurrence";

// Best-effort reminders: only fire while the Ditto tab/app is open (foreground
// or backgrounded browser tab). A real "notify even with the app fully closed"
// experience needs server-side push (a scheduled job + push subscriptions),
// which is a separate backend feature — ask if you'd like that built next.

type EventRow = EventLike & {
  id: string;
  title: string;
  time_label: string;
  reminders: number[];
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function firedKey(eventId: string, leadMinutes: number) {
  return `ditto:event-reminded:${todayKey()}:${eventId}:${leadMinutes}`;
}

function fireReminder(e: EventRow, leadMinutes: number, minutesUntil: number) {
  const key = firedKey(e.id, leadMinutes);
  if (localStorage.getItem(key)) return;
  localStorage.setItem(key, "1");

  const msg =
    minutesUntil > 0
      ? `Em ${minutesUntil} min: ${e.title}${e.time_label ? ` às ${e.time_label}` : ""}`
      : `Agora: ${e.title}${e.time_label ? ` às ${e.time_label}` : ""}`;

  toast(msg, {
    icon: <Bell className="h-4 w-4 text-gold" />,
    duration: 10000,
  });

  if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
    try {
      new Notification("Ditto · Lembrete", {
        body: msg,
        tag: `ditto-event-${e.id}-${leadMinutes}-${todayKey()}`,
      });
    } catch {
      /* noop */
    }
  }
}

export function EventReminders() {
  const timeoutsRef = useRef<number[]>([]);

  const { data: events = [] } = useQuery({
    queryKey: ["routine_blocks", "reminders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routine_blocks")
        .select("id,title,event_date,time_label,recurrence,day_of_week,reminders");
      if (error) throw error;
      return (data as EventRow[]).filter((e) => (e.reminders || []).length > 0);
    },
    refetchInterval: 5 * 60 * 1000,
  });

  // Ask for notification permission on first interaction
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      const ask = () => {
        Notification.requestPermission().catch(() => {});
        window.removeEventListener("click", ask);
      };
      window.addEventListener("click", ask, { once: true });
      return () => window.removeEventListener("click", ask);
    }
  }, []);

  useEffect(() => {
    timeoutsRef.current.forEach((id) => window.clearTimeout(id));
    timeoutsRef.current = [];

    const now = Date.now();
    const today = todayKey();

    const todaysEvents = events.filter(
      (e) => occursOn(e, today) && /^\d{1,2}:\d{2}$/.test(e.time_label || ""),
    );

    for (const e of todaysEvents) {
      const [h, m] = e.time_label.split(":").map(Number);
      const eventAt = new Date();
      eventAt.setHours(h, m, 0, 0);

      for (const leadMinutes of e.reminders) {
        const remindAt = eventAt.getTime() - leadMinutes * 60 * 1000;
        const delay = remindAt - now;
        const minutesUntilEvent = Math.round((eventAt.getTime() - now) / 60000);

        if (delay <= 0 && eventAt.getTime() > now) {
          fireReminder(e, leadMinutes, minutesUntilEvent);
          continue;
        }
        if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
          const id = window.setTimeout(() => fireReminder(e, leadMinutes, leadMinutes), delay);
          timeoutsRef.current.push(id);
        }
      }
    }

    return () => {
      timeoutsRef.current.forEach((id) => window.clearTimeout(id));
      timeoutsRef.current = [];
    };
  }, [events]);

  return null;
}
