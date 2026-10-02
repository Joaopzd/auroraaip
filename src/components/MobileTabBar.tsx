import { Link, useRouterState } from "@tanstack/react-router";
import { Sun, CalendarDays, ListChecks, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { AuroraIcon } from "@/components/AuroraIcon";
import { openAuroraChat } from "@/lib/chat-bus";
import { Button } from "@/components/ui/button";

const tabs = [
  { to: "/", label: "Meu Dia", icon: Sun },
  { to: "/semana", label: "Semana", icon: CalendarDays },
  { to: "/listas", label: "Listas", icon: ListChecks },
  { to: "/financas", label: "Finanças", icon: Wallet },
] as const;

export function MobileTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname === "/auth") return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-[calc(12px+env(safe-area-inset-bottom))] z-40 mx-auto flex w-full max-w-md items-center gap-3 px-3 sm:hidden"
      aria-label="Navegação"
    >
      <ul className="flex h-16 min-w-0 flex-1 items-center justify-around rounded-full border border-border bg-surface px-1 shadow-[var(--shadow-card)]">
        {tabs.map((t) => (
          <TabItem key={t.to} {...t} active={pathname === t.to} />
        ))}
      </ul>
      <Button
        type="button"
        onClick={openAuroraChat}
        aria-label="Falar com a Ditto"
        title="Falar com a Ditto"
        className="h-16 w-16 shrink-0 rounded-full border border-gold/40 bg-surface p-0 shadow-[var(--shadow-gold)] ring-2 ring-gold/20 transition-transform active:scale-95 hover:ring-gold/40"
      >
        <AuroraIcon className="h-11 w-11 rounded-full" />
      </Button>
    </nav>
  );
}

function TabItem({
  to,
  label,
  icon: Icon,
  active,
}: {
  to: string;
  label: string;
  icon: typeof Sun;
  active: boolean;
}) {
  return (
    <li className="flex min-w-0 flex-1 justify-center">
      <Link
        to={to}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        title={label}
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active ? "bg-surface-elevated text-gold" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Icon className="h-6 w-6" aria-hidden="true" />
      </Link>
    </li>
  );
}
