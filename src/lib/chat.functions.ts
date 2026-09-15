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
    const monthISO = todayISO.slice(0, 7);
    const DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    const sundayISO = (() => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - d.getDay());
      return d.toISOString().slice(0, 10);
    })();
    const saturdayISO = (() => {
      const d = new Date(sundayISO + "T00:00:00");
      d.setDate(d.getDate() + 6);
      return d.toISOString().slice(0, 10);
    })();

    // Pre-load context snapshot for the AI
    const [
      { data: todayTasks },
      { data: weekBlocks },
      { data: allLists },
      { data: monthTxs },
      { data: cards },
      { data: openBills },
      { data: weeklyBudget },
      { data: weekTxs },
    ] = await Promise.all([
      supabaseAdmin.from("tasks").select("id,title,completed,is_priority").eq("scheduled_date", todayISO),
      supabaseAdmin.from("routine_blocks").select("id,day_of_week,time_label,title,completed"),
      supabaseAdmin.from("lists").select("id,name,type,is_fixed"),
      supabaseAdmin.from("transactions").select("type,amount,credit_card_id").gte("occurred_on", monthISO + "-01"),
      supabaseAdmin.from("credit_cards").select("id,name,limit_amount,is_benefit"),
      supabaseAdmin.from("bills").select("id,description,amount,due_date,recurrence,is_paid").eq("is_paid", false).order("due_date"),
      supabaseAdmin.from("weekly_budgets").select("amount").eq("week_start", sundayISO).maybeSingle(),
      supabaseAdmin.from("transactions").select("amount,type").eq("type", "expense").gte("occurred_on", sundayISO).lte("occurred_on", saturdayISO),
    ]);

    let income = 0;
    let expense = 0;
    const cardSpend = new Map<string, number>();
    for (const t of monthTxs ?? []) {
      const amt = Number(t.amount);
      if (t.type === "income") income += amt;
      else {
        expense += amt;
        if (t.credit_card_id) cardSpend.set(t.credit_card_id, (cardSpend.get(t.credit_card_id) ?? 0) + amt);
      }
    }
    const cardSummary = (cards ?? [])
      .map((c) => {
        const used = cardSpend.get(c.id) ?? 0;
        return `${c.name}: fatura R$${used.toFixed(2)} / limite R$${Number(c.limit_amount).toFixed(2)}`;
      })
      .join(" | ");
    const listSummary = (allLists ?? []).map((l) => `${l.name} (${l.type})`).join(", ");

    const tools = {
      // ---------- TASKS ----------
      add_task: tool({
        description: "Adiciona nova tarefa para um dia (padrão hoje).",
        inputSchema: z.object({
          title: z.string().min(1).max(200),
          scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          is_priority: z.boolean().optional(),
        }),
        execute: async ({ title, scheduled_date, is_priority }) => {
          const { error } = await supabaseAdmin.from("tasks").insert({
            title, scheduled_date: scheduled_date ?? todayISO, is_priority: is_priority ?? false,
          });
          return error ? { ok: false, error: error.message } : { ok: true };
        },
      }),
      list_tasks: tool({
        description: "Lista tarefas de um dia.",
        inputSchema: z.object({ scheduled_date: z.string().optional() }),
        execute: async ({ scheduled_date }) => {
          const { data, error } = await supabaseAdmin.from("tasks").select("id,title,completed,is_priority,scheduled_date")
            .eq("scheduled_date", scheduled_date ?? todayISO);
          return error ? { ok: false, error: error.message } : { ok: true, tasks: data };
        },
      }),
      remove_task: tool({
        description: "Remove tarefa por id ou por título (fuzzy match).",
        inputSchema: z.object({ id: z.string().uuid().optional(), title: z.string().optional() }),
        execute: async ({ id, title }) => {
          let targetId = id;
          if (!targetId && title) {
            const { data } = await supabaseAdmin.from("tasks").select("id").ilike("title", `%${title}%`).limit(1).maybeSingle();
            targetId = data?.id;
          }
          if (!targetId) return { ok: false, error: "tarefa não encontrada" };
          const { error } = await supabaseAdmin.from("tasks").delete().eq("id", targetId);
          return error ? { ok: false, error: error.message } : { ok: true };
        },
      }),
      complete_task: tool({
        description: "Marca tarefa como concluída.",
        inputSchema: z.object({ title: z.string() }),
        execute: async ({ title }) => {
          const { data } = await supabaseAdmin.from("tasks").select("id").ilike("title", `%${title}%`).limit(1).maybeSingle();
          if (!data) return { ok: false, error: "tarefa não encontrada" };
          await supabaseAdmin.from("tasks").update({ completed: true }).eq("id", data.id);
          return { ok: true };
        },
      }),

      // ---------- ROUTINE ----------
      add_routine_block: tool({
        description: "Adiciona bloco de rotina (day_of_week: 0=Dom..6=Sáb).",
        inputSchema: z.object({
          day_of_week: z.number().int().min(0).max(6),
          time_label: z.string().max(10).optional(),
          title: z.string().min(1).max(200),
        }),
        execute: async ({ day_of_week, time_label, title }) => {
          const { error } = await supabaseAdmin.from("routine_blocks").insert({
            day_of_week, time_label: time_label ?? "", title,
          });
          return error ? { ok: false, error: error.message } : { ok: true };
        },
      }),
      list_week: tool({
        description: "Lista todos blocos de rotina.",
        inputSchema: z.object({}),
        execute: async () => {
          const { data, error } = await supabaseAdmin.from("routine_blocks")
            .select("id,day_of_week,time_label,title,completed").order("day_of_week").order("time_label");
          return error ? { ok: false, error: error.message } : { ok: true, blocks: data };
        },
      }),
      remove_routine_block: tool({
        description: "Remove bloco de rotina por título.",
        inputSchema: z.object({ title: z.string() }),
        execute: async ({ title }) => {
          const { data } = await supabaseAdmin.from("routine_blocks").select("id").ilike("title", `%${title}%`).limit(1).maybeSingle();
          if (!data) return { ok: false, error: "bloco não encontrado" };
          await supabaseAdmin.from("routine_blocks").delete().eq("id", data.id);
          return { ok: true };
        },
      }),

      // ---------- LISTS ----------
      list_lists: tool({
        description: "Lista todas as listas.",
        inputSchema: z.object({}),
        execute: async () => {
          const { data, error } = await supabaseAdmin.from("lists").select("id,name,type,is_fixed");
          return error ? { ok: false, error: error.message } : { ok: true, lists: data };
        },
      }),
      create_list: tool({
        description: "Cria nova lista.",
        inputSchema: z.object({ name: z.string().min(1).max(100), type: z.enum(["shopping", "notes"]).optional() }),
        execute: async ({ name, type }) => {
          const { data, error } = await supabaseAdmin.from("lists").insert({ name, type: type ?? "shopping" }).select("id").single();
          return error ? { ok: false, error: error.message } : { ok: true, id: data.id };
        },
      }),
      add_list_item: tool({
        description:
          "Adiciona item a uma lista. Se for item de compra do mês e o usuário não especificar lista, omita list_name — o item será adicionado automaticamente à lista fixa 'Compras do Mês'.",
        inputSchema: z.object({
          list_id: z.string().uuid().optional(),
          list_name: z.string().optional(),
          content: z.string().min(1).max(300),
          price: z.number().nonnegative().optional(),
        }),
        execute: async ({ list_id, list_name, content, price }) => {
          let targetId = list_id;
          if (!targetId) {
            const lookupName = list_name ?? "Compras do Mês";
            const { data: existing } = await supabaseAdmin.from("lists").select("id").ilike("name", lookupName).maybeSingle();
            if (existing) targetId = existing.id;
            else {
              const { data: created, error } = await supabaseAdmin.from("lists")
                .insert({ name: lookupName, type: "shopping" }).select("id").single();
              if (error) return { ok: false, error: error.message };
              targetId = created.id;
            }
          }
          const { error } = await supabaseAdmin.from("list_items").insert({ list_id: targetId, content, price: price ?? null });
          return error ? { ok: false, error: error.message } : { ok: true };
        },
      }),
      remove_list_item: tool({
        description: "Remove item de lista por conteúdo (fuzzy).",
        inputSchema: z.object({ content: z.string() }),
        execute: async ({ content }) => {
          const { data } = await supabaseAdmin.from("list_items").select("id").ilike("content", `%${content}%`).limit(1).maybeSingle();
          if (!data) return { ok: false, error: "item não encontrado" };
          await supabaseAdmin.from("list_items").delete().eq("id", data.id);
          return { ok: true };
        },
      }),

      // ---------- FINANCE ----------
      list_credit_cards: tool({
        description: "Lista cartões com limite, fatura do mês e disponível.",
        inputSchema: z.object({}),
        execute: async () => {
          const { data: cs } = await supabaseAdmin.from("credit_cards").select("id,name,limit_amount,is_benefit,color");
          const { data: tx } = await supabaseAdmin.from("transactions")
            .select("amount,credit_card_id").eq("type", "expense").gte("occurred_on", monthISO + "-01");
          const spend = new Map<string, number>();
          for (const t of tx ?? []) if (t.credit_card_id) spend.set(t.credit_card_id, (spend.get(t.credit_card_id) ?? 0) + Number(t.amount));
          return {
            ok: true,
            cards: (cs ?? []).map((c) => ({
              ...c, fatura: spend.get(c.id) ?? 0, disponivel: Number(c.limit_amount) - (spend.get(c.id) ?? 0),
            })),
          };
        },
      }),
      add_transaction: tool({
        description: "Registra receita ou despesa. Para vincular a um cartão, passe card_name (ex: 'Santander', 'Nubank', 'EVA').",
        inputSchema: z.object({
          type: z.enum(["income", "expense"]),
          amount: z.number().positive(),
          description: z.string().min(1).max(200),
          category: z.string().optional(),
          occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          card_name: z.string().optional(),
        }),
        execute: async ({ type, amount, description, category, occurred_on, card_name }) => {
          let credit_card_id: string | null = null;
          if (type === "expense" && card_name) {
            const { data: c } = await supabaseAdmin.from("credit_cards").select("id").ilike("name", card_name).maybeSingle();
            credit_card_id = c?.id ?? null;
          }
          const { error } = await supabaseAdmin.from("transactions").insert({
            type, amount, description, category: category ?? null,
            occurred_on: occurred_on ?? todayISO, credit_card_id,
          });
          return error ? { ok: false, error: error.message } : { ok: true };
        },
      }),
      list_transactions: tool({
        description: "Lista movimentações (default: mês atual).",
        inputSchema: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() }),
        execute: async ({ month }) => {
          const m = month ?? monthISO;
          const { data, error } = await supabaseAdmin.from("transactions")
            .select("id,type,amount,description,category,occurred_on,credit_card_id")
            .gte("occurred_on", m + "-01").lte("occurred_on", m + "-31")
            .order("occurred_on", { ascending: false });
          return error ? { ok: false, error: error.message } : { ok: true, transactions: data };
        },
      }),
      remove_transaction: tool({
        description: "Remove movimentação por descrição.",
        inputSchema: z.object({ description: z.string() }),
        execute: async ({ description }) => {
          const { data } = await supabaseAdmin.from("transactions").select("id").ilike("description", `%${description}%`).limit(1).maybeSingle();
          if (!data) return { ok: false, error: "movimentação não encontrada" };
          await supabaseAdmin.from("transactions").delete().eq("id", data.id);
          return { ok: true };
        },
      }),

      // ---------- BILLS (Contas a pagar) ----------
      add_bill: tool({
        description: "Cria conta a pagar (vencimento futuro). recurrence: once|monthly|weekly|yearly.",
        inputSchema: z.object({
          description: z.string().min(1).max(200),
          amount: z.number().positive(),
          due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          recurrence: z.enum(["once", "monthly", "weekly", "yearly"]).optional(),
          category: z.string().optional(),
        }),
        execute: async ({ description, amount, due_date, recurrence, category }) => {
          const { error } = await supabaseAdmin.from("bills").insert({
            description, amount, due_date, recurrence: recurrence ?? "once", category: category ?? null,
          });
          return error ? { ok: false, error: error.message } : { ok: true };
        },
      }),
      list_bills: tool({
        description: "Lista contas a pagar pendentes.",
        inputSchema: z.object({ include_paid: z.boolean().optional() }),
        execute: async ({ include_paid }) => {
          let q = supabaseAdmin.from("bills").select("id,description,amount,due_date,recurrence,is_paid,category").order("due_date");
          if (!include_paid) q = q.eq("is_paid", false);
          const { data, error } = await q;
          return error ? { ok: false, error: error.message } : { ok: true, bills: data };
        },
      }),
      mark_bill_paid: tool({
        description: "Marca conta como paga (e, se recorrente, agenda o próximo vencimento).",
        inputSchema: z.object({ description: z.string() }),
        execute: async ({ description }) => {
          const { data: b } = await supabaseAdmin.from("bills")
            .select("*").ilike("description", `%${description}%`).eq("is_paid", false).limit(1).maybeSingle();
          if (!b) return { ok: false, error: "conta não encontrada" };
          await supabaseAdmin.from("bills").update({ is_paid: true, paid_on: todayISO }).eq("id", b.id);
          if (b.recurrence !== "once") {
            const d = new Date(b.due_date + "T00:00:00");
            if (b.recurrence === "monthly") d.setMonth(d.getMonth() + 1);
            if (b.recurrence === "weekly") d.setDate(d.getDate() + 7);
            if (b.recurrence === "yearly") d.setFullYear(d.getFullYear() + 1);
            await supabaseAdmin.from("bills").insert({
              description: b.description, amount: b.amount, due_date: d.toISOString().slice(0, 10),
              recurrence: b.recurrence, category: b.category, credit_card_id: b.credit_card_id,
            });
          }
          return { ok: true };
        },
      }),
      remove_bill: tool({
        description: "Remove conta por descrição.",
        inputSchema: z.object({ description: z.string() }),
        execute: async ({ description }) => {
          const { data } = await supabaseAdmin.from("bills").select("id").ilike("description", `%${description}%`).limit(1).maybeSingle();
          if (!data) return { ok: false, error: "conta não encontrada" };
          await supabaseAdmin.from("bills").delete().eq("id", data.id);
          return { ok: true };
        },
      }),

      // ---------- WEEKLY BUDGET (Teto semanal) ----------
      set_weekly_budget: tool({
        description: "Define teto de gastos para a semana atual (começa no domingo).",
        inputSchema: z.object({ amount: z.number().positive() }),
        execute: async ({ amount }) => {
          const { error } = await supabaseAdmin.from("weekly_budgets")
            .upsert({ week_start: sundayISO, amount }, { onConflict: "week_start" });
          return error ? { ok: false, error: error.message } : { ok: true };
        },
      }),
      get_weekly_budget: tool({
        description: "Retorna teto e gasto da semana atual.",
        inputSchema: z.object({}),
        execute: async () => {
          const spent = (weekTxs ?? []).reduce((s, t) => s + Number(t.amount), 0);
          return {
            ok: true, week_start: sundayISO, week_end: saturdayISO,
            budget: weeklyBudget ? Number(weeklyBudget.amount) : null, spent,
          };
        },
      }),
    };

    const weekSpent = (weekTxs ?? []).reduce((s, t) => s + Number(t.amount), 0);
    const budgetLine = weeklyBudget
      ? `R$${weekSpent.toFixed(2)} / R$${Number(weeklyBudget.amount).toFixed(2)}${weekSpent > Number(weeklyBudget.amount) ? " (ESTOUROU)" : ""}`
      : "sem teto definido para esta semana";
    const billsLine = (openBills ?? []).slice(0, 6).map((b) =>
      `${b.description} R$${Number(b.amount).toFixed(2)} vence ${b.due_date}${b.recurrence !== "once" ? ` (${b.recurrence})` : ""}`,
    ).join(" | ") || "nenhuma pendente";

    const contextSnapshot = `
CONTEXTO ATUAL (somente leitura, use para responder):
- Tarefas de hoje (${todayTasks?.length ?? 0}): ${(todayTasks ?? []).map((t) => `${t.completed ? "✓" : "○"} ${t.title}`).join(" | ") || "nenhuma"}
- Rotina semanal (${weekBlocks?.length ?? 0} blocos): ${(weekBlocks ?? []).map((b) => `${DAYS[b.day_of_week].slice(0,3)} ${b.time_label} ${b.title}`).join(" | ") || "vazia"}
- Listas: ${listSummary || "nenhuma"}
- Finanças (${monthISO}): receitas R$${income.toFixed(2)} | despesas R$${expense.toFixed(2)} | saldo R$${(income - expense).toFixed(2)}
- Cartões: ${cardSummary || "nenhum"}
- Contas a pagar (pendentes): ${billsLine}
- Teto da semana (${sundayISO}→${saturdayISO}): ${budgetLine}
`.trim();

    const { text } = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      tools,
      stopWhen: stepCountIs(10),
      system: `Você é a Ditto, assistente pessoal carinhosa e direta. Você organiza tarefas do dia, rotina semanal, listas e finanças do usuário.

Hoje é ${new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })} (ISO: ${todayISO}). Dia da semana: ${new Date().getDay()} (${DAYS[new Date().getDay()]}).

${contextSnapshot}

Regras importantes:
- Use as ferramentas para CRIAR, ATUALIZAR ou REMOVER. Não invente confirmações sem usar a ferramenta.
- Para itens de compras (ex: "adicione leite", "preciso comprar arroz"), use add_list_item SEM list_name — vai automaticamente para "Compras do Mês".
- Para despesas no cartão, sempre pergunte ou identifique o cartão (Santander, Nubank, EVA) e use card_name em add_transaction.
- Para contas futuras/recorrentes (aluguel, internet, assinaturas), use add_bill com recurrence apropriada. O usuário será lembrado 1 dia antes e no dia do vencimento automaticamente.
- Se for domingo e ainda não houver teto semanal, sugira definir com set_weekly_budget. Avise se o gasto da semana estiver perto/acima do teto.
- Responda em português do Brasil, curto e motivador.`,
      messages: data.messages.map((m) => ({ role: m.role, content: m.content })),
    });

    return { reply: text || "Pronto! ✨" };
  });
