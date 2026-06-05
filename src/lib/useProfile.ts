import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useCurrentUser() {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
      setEmail(data.session?.user.email ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setUserId(s?.user.id ?? null);
      setEmail(s?.user.email ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);
  return { userId, email };
}

export function useProfile() {
  const { userId, email } = useCurrentUser();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,user_id,display_name")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const upsert = useMutation({
    mutationFn: async (display_name: string) => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase
        .from("profiles")
        .upsert({ user_id: userId, display_name }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });

  const displayName = query.data?.display_name?.trim() || email?.split("@")[0] || "";

  return { userId, email, profile: query.data, displayName, upsert };
}
