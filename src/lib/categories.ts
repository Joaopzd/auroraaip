export type CategoryDef = { value: string; emoji: string; label: string };

export const CATEGORIES: CategoryDef[] = [
  { value: "Mercado & Feira",        emoji: "🛒", label: "Mercado & Feira" },
  { value: "Moradia & Contas",       emoji: "🏠", label: "Moradia & Contas" },
  { value: "Alimentação Fora",       emoji: "🍔", label: "Alimentação Fora" },
  { value: "Transporte",             emoji: "🚗", label: "Transporte" },
  { value: "Saúde & Bem-estar",      emoji: "💊", label: "Saúde & Bem-estar" },
  { value: "Lazer & Hobbies",        emoji: "🎉", label: "Lazer & Hobbies" },
  { value: "Investimentos",          emoji: "💰", label: "Investimentos" },
  { value: "Outros / Imprevistos",   emoji: "⚡", label: "Outros / Imprevistos" },
];

const map = new Map(CATEGORIES.map((c) => [c.value, c]));

export function categoryEmoji(name: string | null | undefined): string {
  if (!name) return "";
  return map.get(name)?.emoji ?? "🏷️";
}
