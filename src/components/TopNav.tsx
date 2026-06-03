import { Link, useRouterState } from "@tanstack/react-router";
import { Sun, CalendarDays, ListChecks, Wallet, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/", label: "Meu Dia", icon: Sun },
  { to: "/semana", label: "Semana", icon: CalendarDays },
  { to: "/listas", label: "Listas", icon: ListChecks },
  { to: "/financas", label: "Finanças", icon: Wallet },
] as const;

export function TopNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold text-gold-foreground">
            <Sparkles className="h-4 w-4" />
          </span>
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
      </div>
    </header>
  );
}
