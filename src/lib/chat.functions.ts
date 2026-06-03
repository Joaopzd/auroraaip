import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ChatInput = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(40),
});

export const sendChatMessage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ChatInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateText, tool, stepCountIs } = await import("ai");

    const gateway = createLovableAiGatewayProvider(apiKey);

    const todayISO = new Date().toISOString().slice(0, 10);
    const DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

    const tools = {
      add_task: tool({
        description:
          "Adiciona uma nova tarefa para um dia específico (padrão: hoje). Use quando o usuário pedir para criar/adicionar uma tarefa ou lembrete.",
        inputSchema: z.object({
          title: z.string().min(1).max(200),
          scheduled_date: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional()
            .describe("Data ISO YYYY-MM-DD. Padrão: hoje."),
          is_priority: z.boolean().optional(),
        }),
        execute: async ({ title, scheduled_date, is_priority }) => {
          const { error } = await supabaseAdmin.from("tasks").insert({
            title,
            scheduled_date: scheduled_date ?? todayISO,
            is_priority: is_priority ?? false,
          });
          if (error) return { ok: false, error: error.message };
          return { ok: true, title, date: scheduled_date ?? todayISO };
        },
      }),
      list_tasks: tool({
        description: "Lista as tarefas do dia (padrão: hoje).",
        inputSchema: z.object({
          scheduled_date: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
        }),
        execute: async ({ scheduled_date }) => {
          const { data, error } = await supabaseAdmin
            .from("tasks")
            .select("id, title, completed, is_priority, scheduled_date")
            .eq("scheduled_date", scheduled_date ?? todayISO);
          if (error) return { ok: false, error: error.message };
          return { ok: true, tasks: data };
        },
      }),
      add_routine_block: tool({
        description:
          "Adiciona um bloco de rotina em um dia da semana. day_of_week: 0=Domingo, 1=Segunda, ..., 6=Sábado.",
        inputSchema: z.object({
          day_of_week: z.number().int().min(0).max(6),
          time_label: z
            .string()
            .max(10)
            .optional()
            .describe("Horário HH:MM, ex: '08:30'."),
          title: z.string().min(1).max(200),
        }),
        execute: async ({ day_of_week, time_label, title }) => {
          const { error } = await supabaseAdmin.from("routine_blocks").insert({
            day_of_week,
            time_label: time_label ?? "",
            title,
          });
          if (error) return { ok: false, error: error.message };
          return { ok: true, day: DAYS[day_of_week], time: time_label, title };
        },
      }),
      list_week: tool({
        description: "Lista todos os blocos de rotina da semana.",
        inputSchema: z.object({}),
        execute: async () => {
          const { data, error } = await supabaseAdmin
            .from("routine_blocks")
            .select("id, day_of_week, time_label, title")
            .order("day_of_week")
            .order("time_label");
          if (error) return { ok: false, error: error.message };
          return { ok: true, blocks: data };
        },
      }),
      list_lists: tool({
        description: "Lista todas as listas (compras e notas) do usuário.",
        inputSchema: z.object({}),
        execute: async () => {
          const { data, error } = await supabaseAdmin
            .from("lists")
            .select("id, name, type");
          if (error) return { ok: false, error: error.message };
          return { ok: true, lists: data };
        },
      }),
      create_list: tool({
        description: "Cria uma nova lista de compras ou de notas.",
        inputSchema: z.object({
          name: z.string().min(1).max(100),
          type: z.enum(["shopping", "notes"]).optional(),
        }),
        execute: async ({ name, type }) => {
          const { data, error } = await supabaseAdmin
            .from("lists")
            .insert({ name, type: type ?? "shopping" })
            .select("id, name, type")
            .single();
          if (error) return { ok: false, error: error.message };
          return { ok: true, list: data };
        },
      }),
      add_list_item: tool({
        description:
          "Adiciona um item a uma lista existente. Se não souber o list_id, chame list_lists antes. Se a lista não existir, crie com create_list.",
        inputSchema: z.object({
          list_id: z.string().uuid().optional(),
          list_name: z
            .string()
            .optional()
            .describe("Nome da lista para buscar/criar caso list_id não seja informado."),
          content: z.string().min(1).max(300),
        }),
        execute: async ({ list_id, list_name, content }) => {
          let targetId = list_id;
          if (!targetId && list_name) {
            const { data: existing } = await supabaseAdmin
              .from("lists")
              .select("id")
              .ilike("name", list_name)
              .maybeSingle();
            if (existing) {
              targetId = existing.id;
            } else {
              const { data: created, error: ce } = await supabaseAdmin
                .from("lists")
                .insert({ name: list_name, type: "shopping" })
                .select("id")
                .single();
              if (ce) return { ok: false, error: ce.message };
              targetId = created.id;
            }
          }
          if (!targetId) return { ok: false, error: "list_id ou list_name é obrigatório" };
          const { error } = await supabaseAdmin
            .from("list_items")
            .insert({ list_id: targetId, content });
          if (error) return { ok: false, error: error.message };
          return { ok: true, list_id: targetId, content };
        },
      }),
    };

    const { text } = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      tools,
      stopWhen: stepCountIs(8),
      system: `Você é a Aurora, assistente pessoal carinhosa e direta. Ajuda o usuário a organizar tarefas do dia, rotina semanal e listas (compras/notas).

Hoje é ${new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })} (ISO: ${todayISO}). Dia da semana atual: ${new Date().getDay()} (${DAYS[new Date().getDay()]}).

Você tem ferramentas para CRIAR e LISTAR tarefas, blocos de rotina e itens de lista. Quando o usuário pedir para adicionar/criar algo, USE a ferramenta apropriada em vez de só responder em texto. Depois confirme brevemente o que foi feito, em português do Brasil, de forma curta e motivadora.`,
      messages: data.messages.map((m) => ({ role: m.role, content: m.content })),
    });

    return { reply: text || "Pronto! ✨" };
  });
