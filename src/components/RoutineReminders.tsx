import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Block = {
  id: string;
  day_of_week: number;
  time_label: string;
  title: string;
  completed: boolean;
};

const REMINDER_LEAD_MS = 30 * 60 * 1000; // 30 minutos

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function firedKey(blockId: string) {
  return `aurora:reminded:${todayKey()}:${blockId}`;
}

function fireReminder(b: Block, minutesUntil: number) {
  const key = firedKey(b.id);
  if (localStorage.getItem(key)) return;
  localStorage.setItem(key, "1");

  const msg =
    minutesUntil > 0
      ? `Em ${minutesUntil} min: ${b.title}${b.time_label ? ` às ${b.time_label}` : ""}`
      : `Agora: ${b.title}${b.time_label ? ` às ${b.time_label}` : ""}`;

  toast(msg, {
    icon: <Bell className="h-4 w-4 text-gold" />,
    duration: 10000,
  });

  if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
    try {
      new Notification("Ditto · Lembrete de rotina", {
        body: msg,
        tag: `aurora-${b.id}-${todayKey()}`,
      });
    } catch {
      /* noop */
    }
  }
}

export function RoutineReminders() {
  const timeoutsRef = useRef<number[]>([]);
  const today = new Date().getDay();

  const { data: blocks = [] } = useQuery({
    queryKey: ["routine_blocks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routine_blocks")
        .select("id, day_of_week, time_label, title, completed");
      if (error) throw error;
      return data as Block[];
    },
    refetchInterval: 5 * 60 * 1000,
  });

  // Pede permissão de notificação na primeira interação
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
    // limpa timers anteriores
    timeoutsRef.current.forEach((id) => window.clearTimeout(id));
    timeoutsRef.current = [];

    const now = Date.now();
    const todaysBlocks = blocks.filter(
      (b) => b.day_of_week === today && !b.completed && /^\d{1,2}:\d{2}$/.test(b.time_label),
    );

    for (const b of todaysBlocks) {
      const [h, m] = b.time_label.split(":").map(Number);
      const eventAt = new Date();
      eventAt.setHours(h, m, 0, 0);
      const remindAt = eventAt.getTime() - REMINDER_LEAD_MS;
      const delay = remindAt - now;
      const minutesUntilEvent = Math.round((eventAt.getTime() - now) / 60000);

      if (delay <= 0 && eventAt.getTime() > now) {
        // Já passou o ponto de 30 min antes, mas o evento ainda não aconteceu
        fireReminder(b, minutesUntilEvent);
        continue;
      }
      if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
        const id = window.setTimeout(() => fireReminder(b, 30), delay);
        timeoutsRef.current.push(id);
      }
    }

    return () => {
      timeoutsRef.current.forEach((id) => window.clearTimeout(id));
      timeoutsRef.current = [];
    };
  }, [blocks, today]);

  return null;
}
