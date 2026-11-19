import type { FormEvent } from "react";
import { PROJECT_STATUSES, projectStatusLabel, TASK_PRIORITIES, taskPriorityLabel, TASK_STATUSES, taskStatusLabel, type Project, type Task } from "../../shared/projects";
import { ApiError } from "../api";
import { useOrganizations, useUsers } from "../crm/hooks";
import { Button, Chip, ErrorText, Field, Input, Select, Textarea } from "../ui";
import { useDeleteTask, useSaveProject, useSaveTask } from "./hooks";

const values = (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  return Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
};
const fieldErrors = (error: unknown) => (error instanceof ApiError ? error.fields : {});
const generalError = (error: unknown) => (error instanceof ApiError && Object.keys(error.fields).length ? null : error);

export function ProjectForm({ project, organizationId, onDone }: { project?: Project; organizationId?: string; onDone: (p: Project) => void }) {
  const save = useSaveProject();
  const orgs = useOrganizations({});
  const users = useUsers();
  const errors = fieldErrors(save.error);

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        const v = values(e);
        save.mutate(
          {
            id: project?.id,
            data: {
              name: v.name,
              organizationId: organizationId ?? v.organizationId,
              status: v.status as Project["status"],
              startDate: v.startDate,
              endDate: v.endDate,
              description: v.description,
              ...(v.leadId !== undefined ? { leadId: v.leadId || null } : {}),
            },
          },
          { onSuccess: onDone },
        );
      }}
    >
      <Field label="Naam *" error={errors.name}>
        <Input name="name" defaultValue={project?.name} required autoFocus />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        {!organizationId && (
          <Field label="Klant *" error={errors.organizationId}>
            <Select name="organizationId" defaultValue={project?.organizationId ?? ""} required>
              <option value="">— Kies een klant —</option>
              {orgs.data?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Status" error={errors.status}>
          <Select name="status" defaultValue={project?.status ?? "planned"}>
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {projectStatusLabel[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Startdatum" error={errors.startDate}>
          <Input name="startDate" type="date" defaultValue={project?.startDate ?? ""} />
        </Field>
        <Field label="Einddatum" error={errors.endDate}>
          <Input name="endDate" type="date" defaultValue={project?.endDate ?? ""} />
        </Field>
        {users.data && users.data.length > 0 && (
          <Field label="Projectleider" error={errors.leadId}>
            <Select name="leadId" defaultValue={project?.leadId ?? ""}>
              <option value="">— Geen —</option>
              {users.data.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
      <Field label="Omschrijving" error={errors.description}>
        <Textarea name="description" defaultValue={project?.description ?? ""} rows={4} placeholder="Doel, scope, afspraken met de klant…" />
      </Field>
      <ErrorText error={generalError(save.error)} />
      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Opslaan…" : "Opslaan"}
        </Button>
      </div>
    </form>
  );
}

export function TaskForm({ task, projectId, onDone }: { task?: Task; projectId: string; onDone: () => void }) {
  const save = useSaveTask(projectId);
  const remove = useDeleteTask();
  const users = useUsers();
  const errors = fieldErrors(save.error);

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        const v = values(e);
        save.mutate(
          {
            id: task?.id,
            data: {
              title: v.title,
              description: v.description,
              status: v.status as Task["status"],
              priority: v.priority as Task["priority"],
              dueDate: v.dueDate,
              ...(v.assigneeId !== undefined ? { assigneeId: v.assigneeId || null } : {}),
            },
          },
          { onSuccess: onDone },
        );
      }}
    >
      <Field label="Taak *" error={errors.title}>
        <Input name="title" defaultValue={task?.title} required autoFocus />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Status" error={errors.status}>
          <Select name="status" defaultValue={task?.status ?? "todo"}>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {taskStatusLabel[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Prioriteit" error={errors.priority}>
          <Select name="priority" defaultValue={task?.priority ?? "normal"}>
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {taskPriorityLabel[p]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Deadline" error={errors.dueDate}>
          <Input name="dueDate" type="date" defaultValue={task?.dueDate ?? ""} />
        </Field>
      </div>
      {users.data && users.data.length > 0 && (
        <Field label="Uitvoerder" error={errors.assigneeId}>
          <Select name="assigneeId" defaultValue={task?.assigneeId ?? ""}>
            <option value="">— Niemand —</option>
            {users.data.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="Omschrijving" error={errors.description}>
        <Textarea name="description" defaultValue={task?.description ?? ""} rows={4} />
      </Field>
      <ErrorText error={generalError(save.error)} />
      <ErrorText error={remove.error} />
      <div className="flex justify-between gap-2">
        {task ? (
          <Button variant="danger" disabled={remove.isPending} onClick={() => confirm("Deze taak verwijderen?") && remove.mutate(task.id, { onSuccess: onDone })}>
            Verwijderen
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Opslaan…" : "Opslaan"}
        </Button>
      </div>
    </form>
  );
}

const statusTone = { planned: "muted", active: "brand", on_hold: "magenta", done: "muted" } as const;
export function ProjectStatusChip({ status }: { status: Project["status"] }) {
  return <Chip tone={statusTone[status]}>{projectStatusLabel[status]}</Chip>;
}

export const todayIso = () => new Date().toISOString().slice(0, 10);
