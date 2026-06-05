import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useProfile } from "@/lib/useProfile";

export const Route = createFileRoute("/perfil")({
  component: PerfilPage,
  head: () => ({ meta: [{ title: "Perfil — Aurora" }] }),
});

function PerfilPage() {
  const { displayName, email, upsert, profile } = useProfile();
  const [name, setName] = useState("");

  useEffect(() => {
    setName(profile?.display_name ?? displayName ?? "");
  }, [profile?.display_name, displayName]);

  return (
    <div className="mx-auto max-w-lg px-4 sm:px-6">
      <h1 className="text-2xl font-bold">Perfil</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Configure como você aparece no aplicativo.
      </p>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          try {
            await upsert.mutateAsync(name.trim());
            toast.success("Nome atualizado!");
          } catch (err) {
            toast.error((err as Error).message);
          }
        }}
        className="mt-6 space-y-4 rounded-2xl bg-surface p-5 ring-1 ring-border"
      >
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">
            Nome de exibição
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Como você quer ser chamado"
            className="mt-2 w-full rounded-xl bg-surface-elevated px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Email</label>
          <p className="mt-2 text-sm text-muted-foreground">{email}</p>
        </div>
        <button
          type="submit"
          disabled={upsert.isPending}
          className="w-full rounded-xl bg-gold py-2.5 text-sm font-semibold text-gold-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {upsert.isPending ? "Salvando..." : "Salvar"}
        </button>
      </form>
    </div>
  );
}
