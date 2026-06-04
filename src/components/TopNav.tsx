import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Sun, CalendarDays, ListChecks, Wallet, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import auroraLogo from "@/assets/aurora-logo.png.asset.json";
import { useEffect, useState } from "react";

const tabs = [
  { to: "/", label: "Meu Dia", icon: Sun },
  { to: "/semana", label: "Semana", icon: CalendarDays },
  { to: "/listas", label: "Listas", icon: ListChecks },
  { to: "/financas", label: "Finanças", icon: Wallet },
] as const;

export function TopNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setEmail(s?.user.email ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (pathname === "/auth") return null;

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-6">
        <Link to="/" className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <img src={auroraLogo.url} alt="Aurora" className="h-9 w-9 rounded-lg" />
          Aurora
        </Link>

        <nav className="flex items-center gap-1 rounded-full border border-border bg-surface-elevated/60 p-1">
          {tabs.map((tab) => {
            const active = pathname === tab.to;
            const Icon = tab.icon;
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
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

        <div className="flex items-center gap-3">
          {email && (
            <span className="hidden max-w-[160px] truncate text-xs text-muted-foreground md:inline">
              {email}
            </span>
          )}
          {email && (
            <button
              onClick={handleLogout}
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
              aria-label="Sair"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
