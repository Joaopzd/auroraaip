import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Sun, CalendarDays, ListChecks, Wallet, LogOut, Moon, User, Settings } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import auroraLogo from "@/assets/aurora-logo.png.asset.json";
import { useProfile } from "@/lib/useProfile";
import { useTheme } from "@/components/ThemeProvider";
import { SettingsModal } from "@/components/SettingsModal";

const tabs = [
  { to: "/", label: "Meu Dia", icon: Sun },
  { to: "/semana", label: "Semana", icon: CalendarDays },
  { to: "/listas", label: "Listas", icon: ListChecks },
  { to: "/financas", label: "Finanças", icon: Wallet },
] as const;

export function TopNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { displayName, userId } = useProfile();
  const { theme, toggle } = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (pathname === "/auth") return null;

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2.5 text-base font-semibold tracking-tight">
          <img src={auroraLogo.url} alt="Aurora" className="h-12 w-12 rounded-xl object-contain sm:h-14 sm:w-14" />
          <span className="hidden sm:inline">Aurora</span>
        </Link>

        <nav className="flex items-center gap-1 overflow-x-auto rounded-full border border-border bg-surface-elevated/60 p-1">
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
          <button
            onClick={toggle}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
            aria-label="Alternar tema"
            title={theme === "dark" ? "Tema claro" : "Tema escuro"}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          {userId && (
            <Link
              to="/perfil"
              className="hidden items-center gap-2 rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:bg-surface-elevated hover:text-foreground md:flex"
              title="Editar perfil"
            >
              <User className="h-3.5 w-3.5" />
              <span className="max-w-[120px] truncate">{displayName || "Perfil"}</span>
            </Link>
          )}
          {userId && (
            <Link
              to="/perfil"
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground md:hidden"
              aria-label="Perfil"
            >
              <User className="h-4 w-4" />
            </Link>
          )}
          {userId && (
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
