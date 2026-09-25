import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const registerPushDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ token: z.string().min(20) }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("push_devices").upsert(
      {
        user_id: context.userId,
        token: data.token,
        platform: "web",
        enabled: true,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "user_id,token" },
    );
    if (error) throw error;
    return { ok: true };
  });

export const disablePushDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ token: z.string().min(20) }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("push_devices")
      .update({ enabled: false })
      .eq("user_id", context.userId)
      .eq("token", data.token);
    if (error) throw error;
    return { ok: true };
  });

export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: device, error } = await context.supabase
      .from("push_devices")
      .select("token")
      .eq("user_id", context.userId)
      .eq("enabled", true)
      .eq("platform", "web")
      .order("last_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!device) throw new Error("Ative as notificações neste aparelho antes de enviar o teste.");

    const lovableKey = process.env['LOVABLE_API_KEY'];
    const connectionKey = process.env['FIREBASE_MESSAGING_API_KEY'];
    if (!lovableKey || !connectionKey) throw new Error("A conexão de notificações não está disponível.");
    const response = await fetch("https://connector-gateway.lovable.dev/firebase_messaging/v1/projects/_/messages:send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": connectionKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: {
        token: device.token,
        notification: { title: "Ditto · Teste de alerta", body: "As notificações deste aparelho estão funcionando." },
        data: { path: "/alertas" },
      } }),
    });
    if (!response.ok) {
      const body = await response.text();
      console.error(`Firebase test failed [${response.status}]: ${body}`);
      throw new Error(`Não foi possível entregar o teste [${response.status}]: ${body}`);
    }
    return { ok: true };
  });