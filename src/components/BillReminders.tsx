import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Bill = {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  recurrence: string;
  is_paid: boolean;
};

type WeeklyBudget = { week_start: string; amount: number };

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const todayISO = () => new Date().toISOString().slice(0, 10);

function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function sundayOfWeek(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x.toISOString().slice(0, 10);
}

function fired(key: string) {
  if (localStorage.getItem(key)) return true;
  localStorage.setItem(key, "1");
  return false;
}

export function BillReminders() {
  const { data: bills = [] } = useQuery({
    queryKey: ["bills"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bills")
        .select("id,description,amount,due_date,recurrence,is_paid")
        .eq("is_paid", false);
      if (error) throw error;
      return (data ?? []).map((b) => ({ ...b, amount: Number(b.amount) })) as Bill[];
    },
    refetchInterval: 10 * 60 * 1000,
  });

  const { data: budget } = useQuery({
    queryKey: ["weekly_budget", sundayOfWeek()],
    queryFn: async () => {
      const { data } = await supabase
        .from("weekly_budgets")
        .select("week_start,amount")
        .eq("week_start", sundayOfWeek())
        .maybeSingle();
      return (data ?? null) as WeeklyBudget | null;
    },
  });

  // Bill due-date alerts
  useEffect(() => {
    const today = todayISO();
    const tomorrow = addDays(today, 1);
    for (const b of bills) {
      if (b.due_date === today && !fired(`aurora:bill-today:${today}:${b.id}`)) {
        toast(`Vence hoje: ${b.description} · ${fmt.format(b.amount)}`, {
          icon: <AlertTriangle className="h-4 w-4 text-destructive" />,
          duration: 12000,
        });
      } else if (b.due_date === tomorrow && !fired(`aurora:bill-tomorrow:${today}:${b.id}`)) {
        toast(`Vence amanhã: ${b.description} · ${fmt.format(b.amount)}`, {
          icon: <CalendarClock className="h-4 w-4 text-gold" />,
          duration: 10000,
        });
      }
    }
  }, [bills]);

  // Sunday planning reminder
  useEffect(() => {
    const now = new Date();
    if (now.getDay() !== 0) return; // domingo
    const sun = sundayOfWeek(now);
    if (budget) return; // já definiu teto
    if (fired(`aurora:plan-week:${sun}`)) return;
    toast("Domingo de planejamento ✨ Defina o teto de gastos da semana na aba Semana.", {
      icon: <Wallet className="h-4 w-4 text-gold" />,
      duration: 14000,
    });
  }, [budget]);

  return null;
}
