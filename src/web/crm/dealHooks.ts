import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Deal, DealInput, DealListItem, DealMove } from "../../shared/deals";
import type { Contact } from "../../shared/crm";
import { api, qs } from "../api";

export const useDeals = (filters: { q?: string; ownerId?: string } = {}) =>
  useQuery({
    queryKey: ["deals", filters],
    queryFn: () => api.get<DealListItem[]>(`/deals${qs(filters)}`),
    placeholderData: (prev) => prev,
  });

export const useOrgContacts = (organizationId: string | undefined) =>
  useQuery({
    queryKey: ["contacts", { organizationId }],
    queryFn: () => api.get<Contact[]>(`/contacts${qs({ organizationId })}`),
    enabled: !!organizationId,
  });

function useInvalidateDeals() {
  const qc = useQueryClient();
  return () => Promise.all(["deals", "organization", "organizations"].map((key) => qc.invalidateQueries({ queryKey: [key] })));
}

export function useSaveDeal() {
  const invalidate = useInvalidateDeals();
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: Partial<DealInput> }) =>
      id ? api.patch<Deal>(`/deals/${id}`, data) : api.post<Deal>("/deals", data),
    onSuccess: invalidate,
  });
}

export function useDeleteDeal() {
  const invalidate = useInvalidateDeals();
  return useMutation({ mutationFn: (id: string) => api.del(`/deals/${id}`), onSuccess: invalidate });
}

/** Verplaatsen met directe weergave op het bord (optimistisch), daarna verversen. */
export function useMoveDeal() {
  const qc = useQueryClient();
  const invalidate = useInvalidateDeals();
  return useMutation({
    mutationFn: ({ id, move }: { id: string; move: DealMove }) => api.post<Deal>(`/deals/${id}/move`, move),
    onMutate: async ({ id, move }) => {
      await qc.cancelQueries({ queryKey: ["deals"] });
      const snapshots = qc.getQueriesData<DealListItem[]>({ queryKey: ["deals"] });
      for (const [key, list] of snapshots) {
        if (!list) continue;
        const moving = list.find((d) => d.id === id);
        if (!moving) continue;
        const rest = list.filter((d) => d.id !== id);
        const inStage = rest.filter((d) => d.stage === move.stage).sort((a, b) => a.position - b.position);
        const idx = move.beforeId ? inStage.findIndex((d) => d.id === move.beforeId) : -1;
        const position =
          idx === -1
            ? (inStage.at(-1)?.position ?? 0) + 1
            : idx === 0
              ? inStage[0].position - 1
              : (inStage[idx - 1].position + inStage[idx].position) / 2;
        qc.setQueryData(key, [...rest, { ...moving, stage: move.stage, position }]);
      }
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data)),
    onSettled: invalidate,
  });
}

export function useCreateProject() {
  const invalidate = useInvalidateDeals();
  return useMutation({
    mutationFn: (dealId: string) => api.post<{ id: string }>(`/deals/${dealId}/project`, {}),
    onSuccess: invalidate,
  });
}
