import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import auroraLogo from "../assets/aurora-logo.png.asset.json";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { TopNav } from "@/components/TopNav";
import { ChatFAB } from "@/components/ChatFAB";
import { MobileTabBar } from "@/components/MobileTabBar";
import { RoutineReminders } from "@/components/RoutineReminders";
import { BillReminders } from "@/components/BillReminders";
import { AuthGate } from "@/components/AuthGate";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider, useTheme } from "@/components/ThemeProvider";
import { useRouterState } from "@tanstack/react-router";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Página não encontrada</h2>
        <Link
          to="/"
          className="mt-6 inline-flex rounded-full bg-gold px-5 py-2 text-sm font-semibold text-gold-foreground"
        >
          Voltar
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Algo deu errado</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 rounded-full bg-gold px-5 py-2 text-sm font-semibold text-gold-foreground"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#1D2344" },
      { title: "Aurora — Assistente Pessoal" },
      { name: "description", content: "Organize seu dia, sua semana e suas listas com a ajuda de um assistente de IA." },
      { property: "og:title", content: "Aurora — Assistente Pessoal" },
      { name: "twitter:title", content: "Aurora — Assistente Pessoal" },
      { property: "og:description", content: "Organize seu dia, sua semana e suas listas com a ajuda de um assistente de IA." },
      { name: "twitter:description", content: "Organize seu dia, sua semana e suas listas com a ajuda de um assistente de IA." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/33358f7d-17b8-42ef-9e3a-2b5dc782b2f4/id-preview-ae061195--9ad9aee9-b7ed-4205-9e3f-41f5cea66797.lovable.app-1780924065500.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/33358f7d-17b8-42ef-9e3a-2b5dc782b2f4/id-preview-ae061195--9ad9aee9-b7ed-4205-9e3f-41f5cea66797.lovable.app-1780924065500.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: auroraLogo.url },
      { rel: "apple-touch-icon", href: auroraLogo.url },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Sora:wght@500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthGate>
          <AppShell />
        </AuthGate>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { theme } = useTheme();
  const isAuth = pathname === "/auth";

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-background">
      {!isAuth && <TopNav />}
      <main
        className={
          isAuth
            ? "flex-1"
            : "mx-auto w-full max-w-6xl flex-1 px-3 pb-24 pt-6 sm:px-4 sm:pb-8 sm:pt-8"
        }
      >
        <Outlet />
      </main>
      {!isAuth && <ChatFAB />}
      {!isAuth && <MobileTabBar />}
      {!isAuth && <RoutineReminders />}
      {!isAuth && <BillReminders />}
      <Toaster theme={theme} position="top-center" />
    </div>
  );
}
