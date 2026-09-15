import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import dittoLogo from "@/assets/ditto-logo.jpg.asset.json";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({ meta: [
    { title: "Entrar — Ditto" },
    { name: "description", content: "Entre na Ditto para acessar sua rotina pessoal em qualquer dispositivo." },
    { property: "og:title", content: "Entrar — Ditto" },
    { property: "og:description", content: "Entre na Ditto para acessar sua rotina pessoal em qualquer dispositivo." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Conta criada! Verifique seu email para confirmar.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/", replace: true });
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Falha ao entrar com Google");
        return;
      }
      if (!result.redirected) navigate({ to: "/", replace: true });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 sm:px-6">
      <div className="w-full max-w-sm rounded-3xl bg-surface p-6 ring-1 ring-border sm:p-8">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <img src={dittoLogo.url} alt="Ditto" className="h-36 w-36 rounded-3xl object-contain sm:h-40 sm:w-40" />
          <span className="text-lg font-semibold tracking-tight">Ditto · Assistente Pessoal</span>
        </div>

        <h1 className="text-2xl font-bold">
          {mode === "signin" ? "Bem-vindo de volta" : "Crie sua conta"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "signin"
            ? "Entre para acessar seu dia em qualquer dispositivo."
            : "Cadastre-se para sincronizar suas rotinas."}
        </p>

        <button
          onClick={handleGoogle}
          disabled={loading}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-surface-elevated py-2.5 text-sm font-medium ring-1 ring-border transition hover:bg-surface-elevated/70 disabled:opacity-60"
        >
          <GoogleIcon /> Continuar com Google
        </button>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          ou
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-xl bg-surface-elevated px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha (mín. 6 caracteres)"
            className="w-full rounded-xl bg-surface-elevated px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gold py-2.5 text-sm font-semibold text-gold-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "..." : mode === "signin" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-5 w-full text-center text-xs text-muted-foreground hover:text-foreground"
        >
          {mode === "signin"
            ? "Não tem conta? Criar uma agora."
            : "Já tem conta? Entrar."}
        </button>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.11A6.6 6.6 0 0 1 5.48 12c0-.73.13-1.44.36-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.95l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
    </svg>
  );
}
