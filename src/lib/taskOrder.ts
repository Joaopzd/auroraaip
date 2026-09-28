import type { Tables } from "@/integrations/supabase/types";

export type Task = Tables<"tasks">;

export function orderTasks(tasks: Task[]) {
  return [...tasks].sort((a, b) =>
    Number(b.is_priority) - Number(a.is_priority)
    || (a.sort_order ?? -1) - (b.sort_order ?? -1)
    || a.created_at.localeCompare(b.created_at)
    || a.id.localeCompare(b.id),
  );
}