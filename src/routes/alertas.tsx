import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Wallet, Calendar, Trash2, ChevronLeft, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/alertas")({
  component: AlertasPage,
});

type Delivery = {
  id: string;
  notification_kind: "event" | "bill";
  source_id: string;
  occurrence_key: string;
  reminder_minutes: number;
  sent_at: string;
};

type Bill = {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  is_paid: boolean;
};

type RoutineBlock = {
  id: string;
  title: string;
  time_label: string;
};

function AlertasPage() {
  const queryClient = useQueryClient();

  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ["notification_deliveries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_deliveries")
        .select("*")
        .order("sent_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as Delivery[];
    },
  });

  const { data: bills = {} } = useQuery({
    queryKey: ["alert_bills", deliveries.map(d => d.source_id).filter(id => id)],
    enabled: deliveries.some(d => d.notification_kind === "bill"),
    queryFn: async () => {
      const billIds = deliveries
        .filter(d => d.notification_kind === "bill")
        .map(d => d.source_id);
      if (billIds.length === 0) return {};
      const { data, error } = await supabase
        .from("bills")
        .select("id, description, amount, due_date, is_paid")
        .in("id", billIds);
      if (error) throw error;
      return (data as Bill[]).reduce((acc, b) => ({ ...acc, [b.id]: b }), {} as Record<string, Bill>);
    },
  });

  const { data: routines = {} } = useQuery({
    queryKey: ["alert_routines", deliveries.map(d => d.source_id).filter(id => id)],
    enabled: deliveries.some(d => d.notification_kind === "event"),
    queryFn: async () => {
      const eventIds = deliveries
        .filter(d => d.notification_kind === "event")
        .map(d => d.source_id);
      if (eventIds.length === 0) return {};
      const { data, error } = await supabase
        .from("routine_blocks")
        .select("id, title, time_label")
        .in("id", eventIds);
      if (error) throw error;
      return (data as RoutineBlock[]).reduce((acc, r) => ({ ...acc, [r.id]: r }), {} as Record<string, RoutineBlock>);
    },
  });

  const clearAll = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from("notification_deliveries")
        .delete()
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification_deliveries"] });
    },
  });

  const deleteOne = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notification_deliveries")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification_deliveries"] });
    },
  });

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8 pb-24 sm:pb-8">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="rounded-full p-2 hover:bg-surface-elevated transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6 text-gold" />
            Alertas
          </h1>
        </div>
        {deliveries.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => clearAll.mutate()}
            disabled={clearAll.isPending}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Limpar tudo
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface-elevated" />
          ))}
        </div>
      ) : deliveries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-elevated">
            <Bell className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">Nenhum alerta pendente</h3>
          <p className="text-muted-foreground">Você receberá notificações aqui conforme necessário.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {deliveries.map((delivery) => {
            const isBill = delivery.notification_kind === "bill";
            const item = isBill ? bills[delivery.source_id] : routines[delivery.source_id];
            
            if (!item) return null;

            return (
              <div
                key={delivery.id}
                className="group relative flex items-start gap-4 rounded-2xl border border-border bg-surface p-4 transition-all hover:bg-surface-elevated"
              >
                <div className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                  isBill ? "bg-rose-500/10 text-rose-500" : "bg-gold/10 text-gold"
                )}>
                  {isBill ? <Wallet className="h-5 w-5" /> : <Calendar className="h-5 w-5" />}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-foreground truncate">
                      {isBill ? (item as Bill).description : (item as RoutineBlock).title}
                    </p>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {format(new Date(delivery.sent_at), "HH:mm, dd/MM", { locale: ptBR })}
                    </span>
                  </div>
                  
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                    {isBill ? (
                      <>
                        Vencimento: {format(new Date((item as Bill).due_date + "T12:00:00Z"), "dd 'de' MMMM", { locale: ptBR })}
                        {(item as Bill).is_paid && (
                          <span className="ml-2 inline-flex items-center gap-1 text-emerald-500">
                            <CheckCircle2 className="h-3 w-3" /> Pago
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        Evento agendado para {(item as RoutineBlock).time_label}
                      </>
                    )}
                  </p>
                </div>

                <button
                  onClick={() => deleteOne.mutate(delivery.id)}
                  className="ml-2 rounded-full p-2 text-muted-foreground opacity-0 transition-opacity hover:bg-background group-hover:opacity-100"
                  aria-label="Remover alerta"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-12 rounded-2xl border border-dashed border-border p-6 text-center">
        <h4 className="mb-2 font-medium flex items-center justify-center gap-2">
          <AlertCircle className="h-4 w-4 text-gold" />
          Configurações de Notificação
        </h4>
        <p className="text-sm text-muted-foreground mb-4">
          Para receber alertas em tempo real no seu dispositivo, verifique as permissões de notificação do seu navegador.
        </p>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => {
            if ("Notification" in window) {
              Notification.requestPermission();
            }
          }}
        >
          Ativar notificações push
        </Button>
      </div>
    </div>
  );
}
