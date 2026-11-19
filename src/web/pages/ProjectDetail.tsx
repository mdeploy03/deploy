import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { TASK_STATUSES, taskPriorityLabel, taskStatusLabel, type TaskListItem, type TaskStatus } from "../../shared/projects";
import { useUsers } from "../crm/hooks";
import { ProjectForm, ProjectStatusChip, TaskForm, todayIso } from "../projects/forms";
import { useDeleteProject, useMoveTask, useProject, useSaveTask, useSetMembers } from "../projects/hooks";
import { Button, Card, Chip, Dialog, Empty, ErrorText, Input, formatDate } from "../ui";

const day = (iso: string | null) => (iso ? formatDate(new Date(iso).getTime()) : "—");

export function ProjectDetail() {
  const { id = "" } = useParams();
  const query = useProject(id);
  const del = useDeleteProject();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [taskDialog, setTaskDialog] = useState<{ task?: TaskListItem } | null>(null);
  const [view, setView] = useState<"bord" | "lijst">("bord");

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
      <div className="mb-8">
        <div className="kicker border-b border-line pb-2">
          <Link to="/projecten" className="hover:text-brand">
            Projecten
          </Link>{" "}
          · {p.name}
        </div>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-4xl">{p.name}</h1>
              <ProjectStatusChip status={p.status} />
            </div>
            <div className="brand-bar mt-3" />
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Bewerken
            </Button>
            <Button
              variant="danger"
              disabled={del.isPending}
              onClick={() => confirm(`Project “${p.name}” met alle taken verwijderen?`) && del.mutate(p.id, { onSuccess: () => navigate("/projecten") })}
            >
              Verwijderen
            </Button>
          </div>
        </div>
        <ErrorText error={del.error} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
        <div className="grid content-start gap-6">
          <Card accent="brand" title="Gegevens">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted">Klant</dt>
              <dd>
                <Link to={`/klanten/${p.organizationId}`} className="text-brand hover:underline">
                  {p.organizationName}
                </Link>
              </dd>
              {p.dealTitle && (
                <>
                  <dt className="text-muted">Uit kans</dt>
                  <dd>{p.dealTitle}</dd>
                </>
              )}
              <dt className="text-muted">Start</dt>
              <dd>{day(p.startDate)}</dd>
              <dt className="text-muted">Einde</dt>
              <dd>{day(p.endDate)}</dd>
              <dt className="text-muted">Projectleider</dt>
              <dd>{p.leadName ?? "—"}</dd>
              <dt className="text-muted">Voortgang</dt>
              <dd>
                {p.doneCount}/{p.taskCount} taken klaar
                {p.overdueCount > 0 && <span className="font-bold text-magenta"> · {p.overdueCount} te laat</span>}
              </dd>
            </dl>
            {p.description && <p className="mt-4 border-t border-line pt-4 text-sm whitespace-pre-line">{p.description}</p>}
          </Card>
          <Members projectId={p.id} memberIds={p.members.map((m) => m.id)} names={p.members.map((m) => m.name)} />
        </div>

        <Card
          accent="cyan"
          title="Taken"
          actions={
            <div className="flex gap-1 text-sm">
              {(["bord", "lijst"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`border-2 px-3 py-1 font-bold ${view === v ? "border-brand bg-brand text-white" : "border-line text-muted hover:text-brand"}`}
                >
                  {v === "bord" ? "Bord" : "Lijst"}
                </button>
              ))}
            </div>
          }
        >
          <QuickAdd projectId={p.id} />
          {p.tasks.length === 0 ? (
            <Empty>Nog geen taken. Typ hierboven een taak en druk op Enter.</Empty>
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
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="+ Nieuwe taak (Enter om toe te voegen)" disabled={save.isPending} />
      <ErrorText error={save.error} />
    </form>
  );
}

function TaskMeta({ t }: { t: TaskListItem }) {
  const overdue = t.status !== "done" && t.dueDate && t.dueDate < todayIso();
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
      {t.priority === "high" && <Chip tone="magenta">{taskPriorityLabel.high}</Chip>}
      {t.dueDate && <span className={overdue ? "font-bold text-magenta" : ""}>{day(t.dueDate)}</span>}
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
              className={`min-h-40 border-2 border-line ${dragId && target?.status === status ? "bg-subtle" : "bg-white"}`}
            >
              <header className="flex items-baseline justify-between border-b-2 border-line px-3 py-2">
                <h3 className="text-lg">{taskStatusLabel[status]}</h3>
                <span className="text-xs text-muted">{list.length}</span>
              </header>
              <ol className="flex flex-col gap-2 p-2">
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
                    className={`relative cursor-grab border-2 border-line bg-white p-3 text-sm hover:border-brand ${dragId === t.id ? "opacity-40" : ""}`}
                  >
                    {dragId && target?.status === status && target.beforeId === t.id && (
                      <div className="absolute -top-[7px] right-0 left-0 h-[4px] bg-magenta" />
                    )}
                    <div className={`font-bold ${status === "done" ? "text-muted line-through" : "text-ink"}`}>{t.title}</div>
                    <TaskMeta t={t} />
                  </li>
                ))}
                {dragId && target?.status === status && target.beforeId === null && <li className="h-[4px] bg-magenta" />}
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
    <ul className="divide-y divide-line border-2 border-line">
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
            <span className={`font-bold ${t.status === "done" ? "text-muted line-through" : "text-ink"}`}>{t.title}</span>
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
      <Card accent="magenta" title="Team">
        <p className="text-sm text-muted">Teamleden kun je toevoegen zodra collega's inloggen met Microsoft 365.</p>
      </Card>
    );
  }
  return (
    <Card accent="magenta" title="Team">
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
