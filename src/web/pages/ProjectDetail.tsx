import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { TASK_STATUSES, taskPriorityLabel, taskStatusLabel, type TaskListItem, type TaskStatus } from "../../shared/projects";
import { useUsers } from "../crm/hooks";
import { History } from "../History";
import { ProjectForm, ProjectStatusChip, TaskForm, todayIso } from "../projects/forms";
import { useDeleteProject, useMoveTask, useProject, useSaveTask, useSetMembers } from "../projects/hooks";
import { Briefcase, ClipboardList, LayoutGrid, List, Pencil, Plus, Trash2, Users } from "lucide-react";
import { Button, Card, Chip, DetailHeader, Dialog, useDocumentTitle, Empty, ErrorText, InfoList, Input, Progress, Segmented, formatDate } from "../ui";

const day = (iso: string | null) => (iso ? formatDate(new Date(iso).getTime()) : "—");

export function ProjectDetail() {
  const { id = "" } = useParams();
  const query = useProject(id);
  const del = useDeleteProject();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [taskDialog, setTaskDialog] = useState<{ task?: TaskListItem } | null>(null);
  const [view, setView] = useState<"bord" | "lijst">("bord");

  useDocumentTitle(query.data?.name);
  if (query.isPending) return <p className="text-muted">Laden…</p>;
  if (query.error) {
    return (
      <div>
        <ErrorText error={query.error} />
        <Link to="/projecten" className="text-brand hover:underline">
          ← Terug naar projecten
        </Link>
      </div>
    );
  }
  const p = query.data;

  return (
    <div>
      <DetailHeader
        back={{ to: "/projecten", label: "Projecten" }}
        title={p.name}
        meta={<ProjectStatusChip status={p.status} />}
        actions={
          <>
            <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>
              Bewerken
            </Button>
            <Button
              variant="danger"
              icon={Trash2}
              disabled={del.isPending}
              onClick={() => confirm(`Project “${p.name}” met alle taken verwijderen?`) && del.mutate(p.id, { onSuccess: () => navigate("/projecten") })}
            >
              Verwijderen
            </Button>
          </>
        }
      />
      <div className="mb-4">
        <ErrorText error={del.error} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="grid content-start gap-6">
          <Card accent="brand" icon={Briefcase} title="Gegevens">
            <InfoList
              items={[
                [
                  "Klant",
                  <Link to={`/klanten/${p.organizationId}`} className="text-brand hover:underline">
                    {p.organizationName}
                  </Link>,
                ],
                ...(p.dealTitle ? ([["Uit kans", p.dealTitle]] as [string, string][]) : []),
                ["Start", day(p.startDate)],
                ["Einde", day(p.endDate)],
                ["Projectleider", p.leadName],
              ]}
            />
            <div className="mt-4">
              <div className="mb-1.5 flex justify-between text-xs text-muted">
                <span>
                  {p.doneCount}/{p.taskCount} taken klaar
                </span>
                {p.overdueCount > 0 && <span className="font-semibold text-magenta">{p.overdueCount} te laat</span>}
              </div>
              <Progress value={p.taskCount ? (p.doneCount / p.taskCount) * 100 : 0} />
            </div>
            {p.description && <p className="mt-4 border-t border-line pt-4 text-sm whitespace-pre-line">{p.description}</p>}
            <div className="mt-4 border-t border-line pt-3">
              <History entityType="project" entityId={p.id} />
            </div>
          </Card>
          <Members projectId={p.id} memberIds={p.members.map((m) => m.id)} names={p.members.map((m) => m.name)} />
        </div>

        <Card
          accent="cyan"
          icon={ClipboardList}
          title="Taken"
          actions={
            <Segmented
              value={view}
              onChange={setView}
              options={[
                ["bord", <span className="inline-flex items-center gap-1.5"><LayoutGrid size={14} /> Bord</span>],
                ["lijst", <span className="inline-flex items-center gap-1.5"><List size={14} /> Lijst</span>],
              ] as const}
            />
          }
        >
          <QuickAdd projectId={p.id} />
          {p.tasks.length === 0 ? (
            <Empty icon={ClipboardList}>Nog geen taken. Typ hierboven een taak en druk op Enter.</Empty>
          ) : view === "bord" ? (
            <TaskBoard projectId={p.id} tasks={p.tasks} onOpen={(task) => setTaskDialog({ task })} />
          ) : (
            <TaskList projectId={p.id} tasks={p.tasks} onOpen={(task) => setTaskDialog({ task })} />
          )}
        </Card>
      </div>

      <Dialog open={editing} title="Project bewerken" onClose={() => setEditing(false)}>
        {editing && <ProjectForm project={p} onDone={() => setEditing(false)} />}
      </Dialog>
      <Dialog open={!!taskDialog} title={taskDialog?.task ? "Taak bewerken" : "Nieuwe taak"} onClose={() => setTaskDialog(null)}>
        {taskDialog && <TaskForm task={taskDialog.task} projectId={p.id} onDone={() => setTaskDialog(null)} />}
      </Dialog>
    </div>
  );
}

function QuickAdd({ projectId }: { projectId: string }) {
  const save = useSaveTask(projectId);
  const [title, setTitle] = useState("");
  return (
    <form
      className="mb-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        save.mutate({ data: { title } }, { onSuccess: () => setTitle("") });
      }}
    >
      <div className="relative">
        <Plus size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-label" />
        <Input className="pl-9" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nieuwe taak — Enter om toe te voegen" disabled={save.isPending} />
      </div>
      <ErrorText error={save.error} />
    </form>
  );
}

function TaskMeta({ t }: { t: TaskListItem }) {
  const overdue = t.status !== "done" && t.dueDate && t.dueDate < todayIso();
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
      {t.priority === "high" && <Chip tone="magenta">{taskPriorityLabel.high}</Chip>}
      {t.dueDate && <span className={overdue ? "font-semibold text-magenta" : ""}>{day(t.dueDate)}</span>}
      {t.assigneeName && <span>{t.assigneeName}</span>}
    </div>
  );
}

function TaskBoard({ projectId, tasks, onOpen }: { projectId: string; tasks: TaskListItem[]; onOpen: (t: TaskListItem) => void }) {
  const move = useMoveTask(projectId);
  const [dragId, setDragId] = useState<string | null>(null);
  const [target, setTarget] = useState<{ status: TaskStatus; beforeId: string | null } | null>(null);
  const columns = useMemo(() => {
    const by = { todo: [], doing: [], done: [] } as Record<TaskStatus, TaskListItem[]>;
    for (const t of tasks) by[t.status].push(t);
    for (const s of TASK_STATUSES) by[s].sort((a, b) => a.position - b.position);
    return by;
  }, [tasks]);

  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <ErrorText error={move.error} />
      <div className="grid min-w-[640px] grid-cols-3 gap-3">
        {TASK_STATUSES.map((status) => {
          const list = columns[status];
          return (
            <section
              key={status}
              onDragOver={(e) => {
                e.preventDefault();
                if (target?.status !== status) setTarget({ status, beforeId: null });
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = dragId ?? e.dataTransfer.getData("text/plain");
                const beforeId = target?.status === status ? target.beforeId : null;
                setDragId(null);
                setTarget(null);
                if (id && id !== beforeId) move.mutate({ id, move: { status, beforeId } });
              }}
              className={`min-h-48 rounded-xl transition-colors ${dragId && target?.status === status ? "bg-brand-soft ring-2 ring-brand/30" : "bg-[#eef2f7]"}`}
            >
              <header className="flex items-center justify-between px-3 pt-3 pb-2">
                <h3 className="font-sans text-sm font-semibold">{taskStatusLabel[status]}</h3>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-muted">{list.length}</span>
              </header>
              <ol className="flex flex-col gap-2 px-2 pb-2">
                {list.map((t, idx) => (
                  <li
                    key={t.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", t.id);
                      setDragId(t.id);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setTarget(null);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const r = e.currentTarget.getBoundingClientRect();
                      const beforeId = e.clientY > r.top + r.height / 2 ? (list[idx + 1]?.id ?? null) : t.id;
                      if (target?.status !== status || target.beforeId !== beforeId) setTarget({ status, beforeId });
                    }}
                    onClick={() => onOpen(t)}
                    className={`relative cursor-grab rounded-lg border border-line bg-white p-3 text-sm shadow-card transition-shadow hover:shadow-pop active:cursor-grabbing ${dragId === t.id ? "opacity-40" : ""}`}
                  >
                    {dragId && target?.status === status && target.beforeId === t.id && (
                      <div className="absolute -top-[6px] right-1 left-1 h-[3px] rounded-full bg-magenta" />
                    )}
                    <div className={`font-semibold ${status === "done" ? "text-muted line-through" : "text-ink"}`}>{t.title}</div>
                    <TaskMeta t={t} />
                  </li>
                ))}
                {dragId && target?.status === status && target.beforeId === null && <li className="mx-1 h-[3px] rounded-full bg-magenta" />}
              </ol>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function TaskList({ projectId, tasks, onOpen }: { projectId: string; tasks: TaskListItem[]; onOpen: (t: TaskListItem) => void }) {
  const save = useSaveTask(projectId);
  const sorted = [...tasks].sort(
    (a, b) =>
      Number(a.status === "done") - Number(b.status === "done") ||
      (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") ||
      a.position - b.position,
  );
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
      {sorted.map((t) => (
        <li key={t.id} className="flex items-start gap-3 px-3 py-2 hover:bg-subtle">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-brand"
            checked={t.status === "done"}
            aria-label={`${t.title} afvinken`}
            onChange={(e) => save.mutate({ id: t.id, data: { status: e.target.checked ? "done" : "todo" } })}
          />
          <button className="min-w-0 flex-1 text-left text-sm" onClick={() => onOpen(t)}>
            <span className={`font-semibold ${t.status === "done" ? "text-muted line-through" : "text-ink"}`}>{t.title}</span>
            {t.status === "doing" && <span className="ml-2 text-xs text-brand">Bezig</span>}
            <TaskMeta t={t} />
          </button>
        </li>
      ))}
    </ul>
  );
}

function Members({ projectId, memberIds, names }: { projectId: string; memberIds: string[]; names: string[] }) {
  const users = useUsers();
  const setMembers = useSetMembers(projectId);
  if (!users.data?.length) {
    return (
      <Card accent="magenta" icon={Users} title="Team">
        <p className="text-sm text-muted">Teamleden kun je toevoegen zodra collega's inloggen met Microsoft 365.</p>
      </Card>
    );
  }
  return (
    <Card accent="magenta" icon={Users} title="Team">
      {names.length > 0 && <p className="mb-3 text-sm">{names.join(", ")}</p>}
      <div className="grid gap-1 text-sm">
        {users.data.map((u) => (
          <label key={u.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand"
              checked={memberIds.includes(u.id)}
              onChange={(e) => setMembers.mutate(e.target.checked ? [...memberIds, u.id] : memberIds.filter((m) => m !== u.id))}
            />
            {u.name}
          </label>
        ))}
      </div>
      <ErrorText error={setMembers.error} />
    </Card>
  );
}
