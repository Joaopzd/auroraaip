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