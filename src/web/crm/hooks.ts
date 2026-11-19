import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Activity,
  ActivityInput,
  Contact,
  ContactInput,
  ContactListItem,
  Organization,
  OrganizationDetail,
  OrganizationInput,
  OrganizationListItem,
  UserSummary,
} from "../../shared/crm";
import { api, qs } from "../api";

export const useUsers = () => useQuery({ queryKey: ["users"], queryFn: () => api.get<UserSummary[]>("/users") });

export const useOrganizations = (filters: { q?: string; status?: string }) =>
  useQuery({
    queryKey: ["organizations", filters],
    queryFn: () => api.get<OrganizationListItem[]>(`/organizations${qs(filters)}`),
    placeholderData: (prev) => prev,
  });

export const useOrganization = (id: string) =>
  useQuery({ queryKey: ["organization", id], queryFn: () => api.get<OrganizationDetail>(`/organizations/${id}`) });

export const useContacts = (filters: { q?: string }) =>
  useQuery({
    queryKey: ["contacts", filters],
    queryFn: () => api.get<ContactListItem[]>(`/contacts${qs(filters)}`),
    placeholderData: (prev) => prev,
  });

/** Na elke wijziging de CRM-lijsten en details verversen. */
function useInvalidateCrm() {
  const qc = useQueryClient();
  return () =>
    Promise.all(["organizations", "organization", "contacts"].map((key) => qc.invalidateQueries({ queryKey: [key] })));
}

export function useSaveOrganization() {
  const invalidate = useInvalidateCrm();
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: OrganizationInput }) =>
      id ? api.patch<Organization>(`/organizations/${id}`, data) : api.post<Organization>("/organizations", data),
    onSuccess: invalidate,
  });
}

export function useDeleteOrganization() {
  const invalidate = useInvalidateCrm();
  return useMutation({ mutationFn: (id: string) => api.del(`/organizations/${id}`), onSuccess: invalidate });
}

export function useSaveContact() {
  const invalidate = useInvalidateCrm();
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: ContactInput }) =>
      id ? api.patch<Contact>(`/contacts/${id}`, data) : api.post<Contact>("/contacts", data),
    onSuccess: invalidate,
  });
}

export function useDeleteContact() {
  const invalidate = useInvalidateCrm();
  return useMutation({ mutationFn: (id: string) => api.del(`/contacts/${id}`), onSuccess: invalidate });
}

export function useAddActivity(organizationId: string) {
  const invalidate = useInvalidateCrm();
  return useMutation({
    mutationFn: (data: ActivityInput) => api.post<Activity>(`/organizations/${organizationId}/activities`, data),
    onSuccess: invalidate,
  });
}

export function useDeleteActivity(organizationId: string) {
  const invalidate = useInvalidateCrm();
  return useMutation({
    mutationFn: (activityId: string) => api.del(`/organizations/${organizationId}/activities/${activityId}`),
    onSuccess: invalidate,
  });
}
