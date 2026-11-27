import { queryOptions, useQuery } from "@tanstack/react-query";

/** Sem login: o sistema roda só na rede da empresa. */
export const euQuery = queryOptions({
  queryKey: ["eu"],
  queryFn: async () => ({ id: "local", email: "", isAdmin: true, isMembro: true }),
  staleTime: Infinity,
});

export function useEu() {
  return useQuery(euQuery);
}
