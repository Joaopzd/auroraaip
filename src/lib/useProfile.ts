import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useCurrentUser() {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
      setEmail(data.session?.user.email ?? null);
      setCreatedAt(data.session?.user.created_at ?? null);
      setProvider(data.session?.user.app_metadata.provider ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setUserId(s?.user.id ?? null);
      setEmail(s?.user.email ?? null);
      setCreatedAt(s?.user.created_at ?? null);
      setProvider(s?.user.app_metadata.provider ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);
  return { userId, email, createdAt, provider };
}

export function useProfile() {
  const { userId, email, createdAt, provider } = useCurrentUser();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,user_id,display_name,avatar_url")
        .eq("user_id", userId ?? "")
        .maybeSingle();
      if (error) throw error;
      if (!data?.avatar_url) return { ...data, signedAvatarUrl: null };
      const { data: signed } = await supabase.storage
        .from("profile-photos")
        .createSignedUrl(data.avatar_url, 3600);
      return { ...data, signedAvatarUrl: signed?.signedUrl ?? null };
    },
  });

  const upsert = useMutation({
    mutationFn: async ({ displayName, avatarPath }: { displayName: string; avatarPath?: string }) => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase
        .from("profiles")
        .upsert(
          { user_id: userId, display_name: displayName, ...(avatarPath ? { avatar_url: avatarPath } : {}) },
          { onConflict: "user_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });

  const displayName = query.data?.display_name?.trim() || email?.split("@")[0] || "";

  return { userId, email, createdAt, provider, profile: query.data, displayName, upsert };
}
