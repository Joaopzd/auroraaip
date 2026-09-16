import { ShoppingBag, ChefHat, StickyNote, type LucideIcon } from "lucide-react";

export type ListKind = "shopping" | "recipe" | "general";

export const DEFAULT_LIST_CATEGORIES: { name: string; kind: ListKind }[] = [
  { name: "Compras", kind: "shopping" },
  { name: "Receita", kind: "recipe" },
  { name: "Geral", kind: "general" },
];

export const KIND_ICON: Record<ListKind, LucideIcon> = {
  shopping: ShoppingBag,
  recipe: ChefHat,
  general: StickyNote,
};

export const KIND_LABEL: Record<ListKind, string> = {
  shopping: "Compras",
  recipe: "Receita",
  general: "Geral",
};

/** New custom categories default to a plain list, since only the three built-ins
 * have a defined special field (price / quantity). */
export const DEFAULT_CUSTOM_KIND: ListKind = "general";
