import { createFileRoute } from "@tanstack/react-router";
import { occursOn } from "@/lib/eventRecurrence";

type EventRow = {
  id: string;
  user_id: string;
  title: string;
  event_date: string | null;
  time_label: string;
  recurrence: string;
  day_of_week: number;
  reminders: number[];
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";
const SAO_PAULO_OFFSET = "-03:00";

function localDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function sendPush(token: string, title: string, body: string, path: string) {
  const lovableKey = process.env['LOVABLE_API_KEY'];
  const connectionKey = process.env['FIREBASE_MESSAGING_API_KEY'];
  if (!lovableKey || !connectionKey) throw new Error("Firebase Messaging não está configurado.");
  const response = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connectionKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message: { token, notification: { title, body }, data: { path } } }),
  });
  const responseBody = await response.text();
  if (!response.ok) throw new Error(`FCM send failed [${response.status}]: ${responseBody}`);
}

export const Route = createFileRoute("/api/public/process-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = request.headers.get("x-ditto-cron-secret") ?? "";
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: valid, error: validationError } = await supabaseAdmin.rpc(
          "verify_notification_scheduler_secret",
          { candidate: secret },
        );
        if (validationError || !valid) return new Response("Unauthorized", { status: 401 });

        const now = new Date();
        const today = localDateParts(now);
        const candidateDates = [today, addDays(today, 1)];
        const { data: devices, error: deviceError } = await supabaseAdmin
          .from("push_devices")
          .select("id,user_id,token")
          .eq("enabled", true);
        if (deviceError) throw deviceError;
        if (!devices?.length) return Response.json({ sent: 0 });

        const userIds = [...new Set(devices.map((device) => device.user_id))];
        const [{ data: events, error: eventError }, { data: bills, error: billError }] = await Promise.all([
          supabaseAdmin.from("routine_blocks").select("id,user_id,title,event_date,time_label,recurrence,day_of_week,reminders").in("user_id", userIds),
          supabaseAdmin.from("bills").select("id,user_id,description,amount,due_date,is_paid").in("user_id", userIds).eq("is_paid", false),
        ]);
        if (eventError) throw eventError;
        if (billError) throw billError;

        const due: Array<{ userId: string; kind: "event" | "bill"; sourceId: string; occurrence: string; reminder: number; title: string; body: string; path: string }> = [];
        for (const event of (events ?? []) as EventRow[]) {
          if (!/^\d{1,2}:\d{2}$/.test(event.time_label || "")) continue;
          for (const occurrence of candidateDates) {
            if (!occursOn(event, occurrence)) continue;
            const eventAt = new Date(`${occurrence}T${event.time_label}:00${SAO_PAULO_OFFSET}`).getTime();
            for (const reminder of event.reminders ?? []) {
              const delta = Math.abs(now.getTime() - (eventAt - reminder * 60_000));
              if (delta < 60_000) due.push({
                userId: event.user_id, kind: "event", sourceId: event.id, occurrence,
                reminder, title: "Ditto · Lembrete", body: reminder ? `${event.title} em ${reminder >= 60 ? reminder / 60 + " h" : reminder + " min"}` : `${event.title} agora`, path: "/semana",
              });
            }
          }
        }
        for (const bill of bills ?? []) {
          const reminder = bill.due_date === today ? 0 : bill.due_date === addDays(today, 1) ? 1440 : -1;
          if (reminder < 0) continue;
          due.push({
            userId: bill.user_id, kind: "bill", sourceId: bill.id, occurrence: bill.due_date,
            reminder, title: reminder === 0 ? "Conta vence hoje" : "Conta vence amanhã",
            body: `${bill.description} · ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(bill.amount))}`,
            path: "/financas",
          });
        }

        let sent = 0;
        for (const notification of due) {
          const { data: delivered } = await supabaseAdmin
            .from("notification_deliveries")
            .select("id")
            .eq("user_id", notification.userId)
            .eq("notification_kind", notification.kind)
            .eq("source_id", notification.sourceId)
            .eq("occurrence_key", notification.occurrence)
            .eq("reminder_minutes", notification.reminder)
            .maybeSingle();
          if (delivered) continue;

          let deliveredToDevice = false;
          for (const device of devices.filter((item) => item.user_id === notification.userId)) {
            try {
              await sendPush(device.token, notification.title, notification.body, notification.path);
              deliveredToDevice = true;
              sent += 1;
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              console.error(message);
              if (message.includes("UNREGISTERED") || message.includes("INVALID_ARGUMENT")) {
                await supabaseAdmin.from("push_devices").delete().eq("id", device.id);
              }
            }
          }
          if (deliveredToDevice) {
            await supabaseAdmin.from("notification_deliveries").insert({
              user_id: notification.userId,
              notification_kind: notification.kind,
              source_id: notification.sourceId,
              occurrence_key: notification.occurrence,
              reminder_minutes: notification.reminder,
            });
          }
        }
        return Response.json({ sent });
      },
    },
  },
});