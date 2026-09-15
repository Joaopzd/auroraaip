import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Camera, Check, LogOut, Moon, Sun, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { useProfile } from "@/lib/useProfile";
import { useTheme } from "@/components/ThemeProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const RESETTABLE_TABLES = [
  "transactions", "purchases", "card_invoice_payments", "credit_cards", "bills",
  "investments", "weekly_budgets", "list_items", "lists", "routine_blocks", "tasks", "chat_messages",
] as const;

export const Route = createFileRoute("/perfil")({
  component: PerfilPage,
  head: () => ({ meta: [
    { title: "Perfil — Ditto" },
    { name: "description", content: "Atualize seu perfil e as preferências da sua conta Ditto." },
    { property: "og:title", content: "Perfil — Ditto" },
    { property: "og:description", content: "Atualize seu perfil e as preferências da sua conta Ditto." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});

function PerfilPage() {
  const { displayName, email, createdAt, provider, userId, upsert, profile } = useProfile();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    setName(profile?.display_name ?? displayName ?? "");
  }, [profile?.display_name, displayName]);

  useEffect(() => {
    if (!photo) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const reset = useMutation({
    mutationFn: async () => {
      for (const table of RESETTABLE_TABLES) {
        const { error } = await supabase.from(table).delete().not("id", "is", null);
        if (error) throw new Error(`${table}: ${error.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      setConfirmReset(false);
      toast.success("Todos os dados foram resetados.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !userId) return;
    try {
      let avatarPath: string | undefined;
      if (photo) {
        const extension = photo.name.split(".").pop()?.toLowerCase() || "jpg";
        avatarPath = `${userId}/avatar.${extension}`;
        const { error } = await supabase.storage.from("profile-photos").upload(avatarPath, photo, {
          upsert: true,
          contentType: photo.type,
        });
        if (error) throw error;
      }
      await upsert.mutateAsync({ displayName: name.trim(), avatarPath });
      setPhoto(null);
      toast.success("Perfil atualizado!");
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  function choosePhoto(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Escolha uma imagem válida.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A foto deve ter no máximo 5 MB.");
      return;
    }
    setPhoto(file);
  }

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const accountDate = createdAt
    ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(createdAt))
    : "—";

  return (
    <div className="mx-auto max-w-3xl px-1 sm:px-4">
      <header>
        <h1 className="text-2xl font-bold sm:text-3xl">Perfil</h1>
        <p className="mt-1 text-sm text-muted-foreground">Gerencie sua identidade, aparência e conta.</p>
      </header>

      <form onSubmit={saveProfile} className="mt-6 rounded-2xl bg-surface p-5 ring-1 ring-border sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="relative w-fit">
            <Avatar className="h-24 w-24 ring-2 ring-gold/30">
              <AvatarImage src={preview ?? profile?.signedAvatarUrl ?? undefined} alt="Sua foto de perfil" className="object-cover" />
              <AvatarFallback className="text-2xl font-semibold text-gold"><User className="h-8 w-8" /></AvatarFallback>
            </Avatar>
            <Button type="button" size="icon" onClick={() => fileInputRef.current?.click()} className="absolute -bottom-1 -right-1 rounded-full" aria-label="Trocar foto">
              <Camera />
            </Button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => choosePhoto(event.target.files?.[0])} />
          </div>
          <div className="min-w-0 flex-1">
            <label htmlFor="display-name" className="text-xs font-semibold uppercase text-muted-foreground">Nome exibido</label>
            <input id="display-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Como você quer ser chamado" className="mt-2 w-full rounded-xl bg-surface-elevated px-3 py-2.5 text-sm ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-gold/50" />
            <p className="mt-2 text-xs text-muted-foreground">Este nome aparece na saudação e no topo do aplicativo.</p>
          </div>
        </div>
        <Button type="submit" disabled={upsert.isPending} className="mt-5 w-full rounded-xl sm:w-auto">
          <Check /> {upsert.isPending ? "Salvando..." : "Salvar alterações"}
        </Button>
      </form>

      <section className="mt-4 rounded-2xl bg-surface p-5 ring-1 ring-border sm:p-6">
        <h2 className="font-semibold">Dados da conta</h2>
        <dl className="mt-4 divide-y divide-border text-sm">
          <div className="flex items-center justify-between gap-4 py-3"><dt className="text-muted-foreground">E-mail</dt><dd className="truncate font-medium">{email ?? "—"}</dd></div>
          <div className="flex items-center justify-between gap-4 py-3"><dt className="text-muted-foreground">Acesso</dt><dd className="font-medium">{provider === "google" ? "Google" : "E-mail e senha"}</dd></div>
          <div className="flex items-center justify-between gap-4 py-3"><dt className="text-muted-foreground">Conta criada em</dt><dd className="text-right font-medium">{accountDate}</dd></div>
        </dl>
      </section>

      <section className="mt-4 rounded-2xl bg-surface p-5 ring-1 ring-border sm:p-6">
        <h2 className="font-semibold">Aparência</h2>
        <p className="mt-1 text-xs text-muted-foreground">Escolha como a Ditto aparece neste dispositivo.</p>
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-surface-elevated p-1 ring-1 ring-border">
          <Button type="button" variant={theme === "light" ? "default" : "ghost"} onClick={() => setTheme("light")} className="rounded-lg"><Sun /> Claro</Button>
          <Button type="button" variant={theme === "dark" ? "default" : "ghost"} onClick={() => setTheme("dark")} className="rounded-lg"><Moon /> Escuro</Button>
        </div>
      </section>

      <section className="mt-4 rounded-2xl bg-surface p-5 ring-1 ring-border sm:p-6">
        <h2 className="font-semibold">Conta</h2>
        <Button type="button" variant="outline" onClick={logout} className="mt-4 w-full justify-start rounded-xl"><LogOut /> Sair da conta</Button>

        <div className={cn("mt-4 rounded-xl border p-4", confirmReset ? "border-destructive/40 bg-destructive/5" : "border-border")}>
          <div className="flex gap-3">
            <AlertTriangle className={cn("mt-0.5 h-4 w-4 shrink-0", confirmReset ? "text-destructive" : "text-muted-foreground")} />
            <div>
              <p className="text-sm font-medium">Resetar todos os dados</p>
              <p className="mt-1 text-xs text-muted-foreground">Apaga finanças, tarefas, rotina, listas e conversas. Sua conta e seu perfil serão mantidos.</p>
            </div>
          </div>
          {confirmReset ? (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => setConfirmReset(false)} className="flex-1 rounded-xl">Cancelar</Button>
              <Button type="button" variant="destructive" onClick={() => reset.mutate()} disabled={reset.isPending} className="flex-1 rounded-xl">
                <Trash2 /> {reset.isPending ? "Apagando..." : "Confirmar e apagar"}
              </Button>
            </div>
          ) : (
            <Button type="button" variant="ghost" onClick={() => setConfirmReset(true)} className="mt-3 w-full rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"><Trash2 /> Resetar dados</Button>
          )}
        </div>
      </section>
    </div>
  );
}