import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const euQuery = queryOptions({
  queryKey: ["eu"],
  queryFn: async () => {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return null;
    const { data: papeis } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const roles = (papeis ?? []).map((p) => p.role);
    return {
      id: user.id,
      email: user.email ?? "",
      isAdmin: roles.includes("admin"),
      isMembro: roles.length > 0,
    };
  },
  staleTime: 60_000,
});

export function useEu() {
  return useQuery(euQuery);
}
