import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Project,
  ProjectDetail,
  ProjectInput,
  ProjectListItem,
  Task,
  TaskInput,
  TaskListItem,
  TaskMove,
} from "../../shared/projects";
import { api, qs } from "../api";

export const useProjects = (filters: { q?: string; status?: string } = {}) =>
  useQuery({
    queryKey: ["projects", filters],
    queryFn: () => api.get<ProjectListItem[]>(`/projects${qs(filters)}`),
    placeholderData: (prev) => prev,
  });

export const useProject = (id: string) =>
  useQuery({ queryKey: ["project", id], queryFn: () => api.get<ProjectDetail>(`/projects/${id}`) });

export const useMyTasks = (assigneeId: string) =>
  useQuery({
    queryKey: ["tasks", { assigneeId }],
    queryFn: () => api.get<TaskListItem[]>(`/tasks${qs({ assigneeId, open: "1", activeProjects: "1" })}`),
  });

function useInvalidate() {
  const qc = useQueryClient();
  return () =>
    Promise.all(
      ["projects", "project", "tasks", "organization", "deals"].map((key) => qc.invalidateQueries({ queryKey: [key] })),
    );
}

export function useSaveProject() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: Partial<ProjectInput> }) =>
      id ? api.patch<Project>(`/projects/${id}`, data) : api.post<Project>("/projects", data),
    onSuccess: invalidate,
  });
}

export function useDeleteProject() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => api.del(`/projects/${id}`), onSuccess: invalidate });
}

export function useSetMembers(projectId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (userIds: string[]) => api.put(`/projects/${projectId}/members`, { userIds }),
    onSuccess: invalidate,
  });
}

export function useSaveTask(projectId?: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: Partial<TaskInput> }) =>
      id ? api.patch<Task>(`/tasks/${id}`, data) : api.post<Task>(`/projects/${projectId}/tasks`, data),
    onSuccess: invalidate,
  });
}

export function useDeleteTask() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => api.del(`/tasks/${id}`), onSuccess: invalidate });
}

/** Verplaatsen op het takenbord, direct zichtbaar (optimistisch). */
export function useMoveTask(projectId: string) {
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, move }: { id: string; move: TaskMove }) => api.post<Task>(`/tasks/${id}/move`, move),
    onMutate: async ({ id, move }) => {
      const key = ["project", projectId];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<ProjectDetail>(key);
      if (previous) {
        const moving = previous.tasks.find((t) => t.id === id);
        if (moving) {
          const rest = previous.tasks.filter((t) => t.id !== id);
          const column = rest.filter((t) => t.status === move.status).sort((a, b) => a.position - b.position);
          const idx = move.beforeId ? column.findIndex((t) => t.id === move.beforeId) : -1;
          const position =
            idx === -1 ? (column.at(-1)?.position ?? 0) + 1 : idx === 0 ? column[0].position - 1 : (column[idx - 1].position + column[idx].position) / 2;
          qc.setQueryData(key, { ...previous, tasks: [...rest, { ...moving, status: move.status, position }] });
        }
      }
      return { previous };
    },
    onError: (_e, _v, ctx) => ctx?.previous && qc.setQueryData(["project", projectId], ctx.previous),
    onSettled: invalidate,
  });
}
