import { useQuery, useQueryClient } from "@tanstack/react-query";
import { COVER_CONFIGURED, COVER_QUERY_SCOPE } from "@/lib/genlayer/config";
import {
  readClaim,
  readClaims,
  readConfig,
  readOverview,
  readPolicies,
  readPolicy,
} from "@/lib/genlayer/reads";

export function useCoverConfig() {
  return useQuery({
    queryKey: [...COVER_QUERY_SCOPE, "config"],
    queryFn: readConfig,
    enabled: COVER_CONFIGURED,
    staleTime: 60_000,
  });
}

export function usePolicyExplorer() {
  return useQuery({
    queryKey: [...COVER_QUERY_SCOPE, "policies"],
    queryFn: () => readPolicies(),
    enabled: COVER_CONFIGURED,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

export function useClaimExplorer() {
  return useQuery({
    queryKey: [...COVER_QUERY_SCOPE, "claims"],
    queryFn: () => readClaims(),
    enabled: COVER_CONFIGURED,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

export function useCoverOverview() {
  return useQuery({
    queryKey: [...COVER_QUERY_SCOPE, "overview"],
    queryFn: readOverview,
    enabled: COVER_CONFIGURED,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

export function usePolicy(id: string) {
  return useQuery({
    queryKey: [...COVER_QUERY_SCOPE, "policy", id],
    queryFn: () => readPolicy(id),
    enabled: COVER_CONFIGURED && /^\d+$/.test(id) && id !== "0",
    staleTime: 8_000,
  });
}

export function useClaim(id: string) {
  return useQuery({
    queryKey: [...COVER_QUERY_SCOPE, "claim", id],
    queryFn: () => readClaim(id),
    enabled: COVER_CONFIGURED && /^\d+$/.test(id) && id !== "0",
    staleTime: 8_000,
  });
}

export function useCoverRefresh() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      queryKey: COVER_QUERY_SCOPE,
      refetchType: "active",
    });
}
