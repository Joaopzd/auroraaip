import { Link, useRouterState } from "@tanstack/react-router";
import { Sun, CalendarDays, ListChecks, Wallet, User, Bell } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import dittoLogo from "@/assets/ditto-logo.jpg.asset.json";
import { useProfile } from "@/lib/useProfile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const tabs = [
  { to: "/", label: "Meu Dia", icon: Sun },
  { to: "/semana", label: "Semana", icon: CalendarDays },
  { to: "/listas", label: "Listas", icon: ListChecks },
  { to: "/financas", label: "Finanças", icon: Wallet },
] as const;

export function TopNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { displayName, userId, profile } = useProfile();
  const today = new Date().toISOString().slice(0, 10);
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = tomorrowDate.toISOString().slice(0, 10);
  const { data: alertCount = 0 } = useQuery({
    queryKey: ["alert_count", today, tomorrow],
    enabled: !!userId,
    queryFn: async () => {
      const [{ count: billCount, error: billError }, { count: deliveryCount, error: deliveryError }] = await Promise.all([
        supabase.from("bills").select("id", { count: "exact", head: true }).eq("is_paid", false).lte("due_date", tomorrow),
        supabase.from("notification_deliveries").select("id", { count: "exact", head: true }).gte("occurrence_key", today).lte("occurrence_key", tomorrow),
      ]);
      if (billError) throw billError;
      if (deliveryError) throw deliveryError;
      return (billCount ?? 0) + (deliveryCount ?? 0);
    },
  });

  if (pathname === "/auth") return null;


  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2.5 text-base font-semibold tracking-tight">
          <img src={dittoLogo.url} alt="Ditto" className="h-10 w-10 rounded-xl object-contain sm:h-12 sm:w-12" />
          <span className="hidden sm:inline">Ditto</span>
        </Link>

        <nav className="hidden items-center gap-1 overflow-x-auto rounded-full border border-border bg-surface-elevated/60 p-1 sm:flex">
          {tabs.map((tab) => {
            const active = pathname === tab.to;
            const Icon = tab.icon;
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors sm:px-4",
                  active
                    ? "bg-gold text-gold-foreground shadow-[var(--shadow-gold)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1">
          {userId && (
            <Link
              to="/alertas"
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
              aria-label={alertCount ? `${alertCount} alertas próximos` : "Alertas"}
            >
              <Bell className="h-5 w-5" />
              {alertCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[9px] font-bold text-gold-foreground">
                  {alertCount > 9 ? "9+" : alertCount}
                </span>
              )}
            </Link>
          )}
          {userId && (
            <Link
              to="/perfil"
              className="hidden items-center gap-2 rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:bg-surface-elevated hover:text-foreground md:flex"
              title="Editar perfil"
            >
              <Avatar className="h-7 w-7 ring-1 ring-border">
                <AvatarImage src={profile?.signedAvatarUrl ?? undefined} alt="Foto de perfil" className="object-cover" />
                <AvatarFallback><User className="h-3.5 w-3.5" /></AvatarFallback>
              </Avatar>
              <span className="max-w-[120px] truncate">{displayName || "Perfil"}</span>
            </Link>
          )}
          {userId && (
            <Link
              to="/perfil"
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground md:hidden"
              aria-label="Perfil"
            >
              <Avatar className="h-8 w-8 ring-1 ring-border">
                <AvatarImage src={profile?.signedAvatarUrl ?? undefined} alt="Foto de perfil" className="object-cover" />
                <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
              </Avatar>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
