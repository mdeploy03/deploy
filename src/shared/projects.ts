import { z } from "zod";

export const PROJECT_STATUSES = ["planned", "active", "on_hold", "done"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export const projectStatusLabel: Record<ProjectStatus, string> = {
  planned: "Gepland",
  active: "Actief",
  on_hold: "On hold",
  done: "Afgerond",
};

export const TASK_STATUSES = ["todo", "doing", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const taskStatusLabel: Record<TaskStatus, string> = { todo: "To do", doing: "Bezig", done: "Klaar" };

export const TASK_PRIORITIES = ["low", "normal", "high"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export const taskPriorityLabel: Record<TaskPriority, string> = { low: "Laag", normal: "Normaal", high: "Hoog" };

const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullish();

const optionalDate = z
  .string()
  .regex(/^(\d{4}-\d{2}-\d{2})?$/, "Ongeldige datum")
  .transform((v) => (v === "" ? null : v))
  .nullish();

// Velden zonder standaardwaarden; aanmaken voegt ze toe, wijzigen niet
// (anders zou een gedeeltelijke wijziging velden terugzetten).
const projectFields = {
  name: z.string().trim().min(1, "Naam is verplicht").max(200),
  organizationId: z.string().min(1, "Kies een klant"),
  status: z.enum(PROJECT_STATUSES),
  startDate: optionalDate,
  endDate: optionalDate,
  leadId: optionalText(64),
  description: optionalText(5000),
};

const endAfterStart = (p: { startDate?: string | null; endDate?: string | null }) =>
  !p.startDate || !p.endDate || p.endDate >= p.startDate;
const endAfterStartIssue = { message: "Einddatum ligt vóór de startdatum", path: ["endDate"] };

export const projectInput = z
  .object({ ...projectFields, status: projectFields.status.default("planned") })
  .refine(endAfterStart, endAfterStartIssue);
export type ProjectInput = z.input<typeof projectInput>;
export const projectUpdate = z.object(projectFields).partial().refine(endAfterStart, endAfterStartIssue);

export const projectMembersInput = z.object({ userIds: z.array(z.string()).max(50) });

const taskFields = {
  title: z.string().trim().min(1, "Titel is verplicht").max(300),
  description: optionalText(10_000),
  assigneeId: optionalText(64),
  dueDate: optionalDate,
  priority: z.enum(TASK_PRIORITIES),
  status: z.enum(TASK_STATUSES),
};
export const taskInput = z.object({
  ...taskFields,
  priority: taskFields.priority.default("normal"),
  status: taskFields.status.default("todo"),
});
export type TaskInput = z.input<typeof taskInput>;
export const taskUpdate = z.object(taskFields).partial();

export const taskMove = z.object({ status: z.enum(TASK_STATUSES), beforeId: z.string().nullish() });
export type TaskMove = z.input<typeof taskMove>;

export type Project = {
  id: string;
  name: string;
  organizationId: string;
  dealId: string | null;
  status: ProjectStatus;
  startDate: string | null;
  endDate: string | null;
  leadId: string | null;
  description: string | null;
  createdAt: number;
  updatedAt: number;
};

export type ProjectListItem = Project & {
  organizationName: string;
  leadName: string | null;
  taskCount: number;
  doneCount: number;
  overdueCount: number;
};

export type Task = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  assigneeId: string | null;
  dueDate: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  position: number;
  createdAt: number;
  updatedAt: number;
};

export type TaskListItem = Task & {
  assigneeName: string | null;
  projectName: string;
  organizationId: string;
  organizationName: string;
};

export type ProjectDetail = ProjectListItem & {
  dealTitle: string | null;
  members: { id: string; name: string; email: string }[];
  tasks: TaskListItem[];
};
