
-- Tasks
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  scheduled_date date NOT NULL DEFAULT CURRENT_DATE,
  is_priority boolean NOT NULL DEFAULT false,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO anon, authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all tasks" ON public.tasks FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Routine blocks
CREATE TABLE public.routine_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  time_label text NOT NULL DEFAULT '',
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.routine_blocks TO anon, authenticated;
GRANT ALL ON public.routine_blocks TO service_role;
ALTER TABLE public.routine_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all routine_blocks" ON public.routine_blocks FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Lists
CREATE TABLE public.lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'shopping' CHECK (type IN ('shopping','notes')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lists TO anon, authenticated;
GRANT ALL ON public.lists TO service_role;
ALTER TABLE public.lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all lists" ON public.lists FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- List items
CREATE TABLE public.list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  content text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.list_items TO anon, authenticated;
GRANT ALL ON public.list_items TO service_role;
ALTER TABLE public.list_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all list_items" ON public.list_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Chat messages (single conversation)
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO anon, authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all chat_messages" ON public.chat_messages FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
