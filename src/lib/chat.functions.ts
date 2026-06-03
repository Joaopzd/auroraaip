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
    const { generateText } = await import("ai");

    const gateway = createLovableAiGatewayProvider(apiKey);
    const { text } = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      system:
        "Você é um assistente pessoal carinhoso e direto, focado em ajudar a organizar a rotina, tarefas e listas do usuário. Responda sempre em português do Brasil, de forma curta, prática e motivadora. Use markdown simples quando ajudar a clareza.",
      messages: data.messages.map((m) => ({ role: m.role, content: m.content })),
    });

    return { reply: text };
  });
