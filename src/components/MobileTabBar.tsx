import { Link, useRouterState } from "@tanstack/react-router";
import { Sun, CalendarDays, ListChecks, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { AuroraIcon } from "@/components/AuroraIcon";
import { openAuroraChat } from "@/lib/chat-bus";

const left = [
  { to: "/", label: "Hoje", icon: Sun },
  { to: "/semana", label: "Semana", icon: CalendarDays },
] as const;

const right = [
  { to: "/listas", label: "Listas", icon: ListChecks },
  { to: "/financas", label: "Finanças", icon: Wallet },
] as const;

export function MobileTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname === "/auth") return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl sm:hidden"
      aria-label="Navegação"
    >
      <ul className="relative mx-auto flex h-16 max-w-md items-end justify-between px-4">
        {left.map((t) => (
          <TabItem key={t.to} {...t} active={pathname === t.to} />
        ))}

        <li className="-mt-8 flex flex-1 justify-center">
          <button
            type="button"
            onClick={openAuroraChat}
            aria-label="Falar com a Aurora"
            className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-gold via-gold to-amber-400 shadow-[0_10px_30px_-8px_rgba(247,197,52,0.7)] ring-4 ring-background transition active:scale-95"
          >
            <AuroraIcon className="h-10 w-10" />
          </button>
        </li>

        {right.map((t) => (
          <TabItem key={t.to} {...t} active={pathname === t.to} />
        ))}
      </ul>
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
    <li className="flex flex-1 justify-center">
      <Link
        to={to}
        className={cn(
          "flex flex-col items-center gap-0.5 px-2 py-2 text-[10px] font-medium transition-colors",
          active ? "text-gold" : "text-muted-foreground",
        )}
      >
        <Icon className={cn("h-5 w-5", active && "drop-shadow-[0_0_6px_rgba(247,197,52,0.5)]")} />
        <span>{label}</span>
      </Link>
    </li>
  );
}
