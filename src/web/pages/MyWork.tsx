import { useState } from "react";
import { Link } from "react-router";
import { taskPriorityLabel, type TaskListItem } from "../../shared/projects";
import { useUsers } from "../crm/hooks";
import { useMyTasks, useSaveTask } from "../projects/hooks";
import { Chip, Empty, ErrorText, PageHeader, Select, formatDate } from "../ui";

function isoDay(d: Date) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

/** Groepen: te laat, vandaag, deze week (t/m zondag), later, zonder deadline. */
function group(tasks: TaskListItem[]) {
  const now = new Date();
  const today = isoDay(now);
  const sunday = new Date(now);
  sunday.setDate(now.getDate() + ((7 - now.getDay()) % 7));
  const endOfWeek = isoDay(sunday);
  const groups: { key: string; title: string; tone: string; items: TaskListItem[] }[] = [
    { key: "overdue", title: "Te laat", tone: "border-l-magenta", items: [] },
    { key: "today", title: "Vandaag", tone: "border-l-brand", items: [] },
    { key: "week", title: "Deze week", tone: "border-l-cyan", items: [] },
    { key: "later", title: "Later", tone: "border-l-line", items: [] },
    { key: "none", title: "Zonder deadline", tone: "border-l-line", items: [] },
  ];
  for (const t of tasks) {
    const g = !t.dueDate ? 4 : t.dueDate < today ? 0 : t.dueDate === today ? 1 : t.dueDate <= endOfWeek ? 2 : 3;
    groups[g].items.push(t);
  }
  return groups.filter((g) => g.items.length);
}

export function MyWork() {
  const users = useUsers();
  // Zonder Microsoft-login is er nog geen "ik": kies een persoon, of bekijk niet-toegewezen taken.
  const [assigneeId, setAssigneeId] = useState("none");
  const tasks = useMyTasks(assigneeId);
  const save = useSaveTask();

  return (
    <div>
      <PageHeader kicker="Overzicht" title="Mijn werk" />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted">Taken van</span>
        <div className="w-64">
          <Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            <option value="none">Niet toegewezen</option>
            {users.data?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </div>
        {!users.data?.length && <span className="text-xs text-muted">Na de Microsoft-login zie je hier standaard je eigen taken.</span>}
      </div>
      <ErrorText error={tasks.error ?? save.error} />

      {tasks.data && tasks.data.length === 0 ? (
        <Empty>Geen openstaande taken. Mooi zo.</Empty>
      ) : (
        <div className="grid gap-6">
          {group(tasks.data ?? []).map((g) => (
            <section key={g.key} className={`border-2 border-l-[12px] border-line ${g.tone} bg-white`}>
              <h2 className="border-b-2 border-line px-4 py-2 text-xl">
                {g.title} <span className="font-sans text-sm text-muted">({g.items.length})</span>
              </h2>
              <ul className="divide-y divide-line">
                {g.items.map((t) => (
                  <li key={t.id} className="flex items-start gap-3 px-4 py-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-brand"
                      aria-label={`${t.title} afvinken`}
                      onChange={() => save.mutate({ id: t.id, data: { status: "done" } })}
                    />
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-ink">{t.title}</span>
                        {t.priority === "high" && <Chip tone="magenta">{taskPriorityLabel.high}</Chip>}
                        {t.status === "doing" && <Chip>Bezig</Chip>}
                      </div>
                      <div className="mt-1 text-xs text-muted">
                        <Link to={`/projecten/${t.projectId}`} className="text-brand hover:underline">
                          {t.projectName}
                        </Link>{" "}
                        · {t.organizationName}
                        {t.dueDate && <> · {formatDate(new Date(t.dueDate).getTime())}</>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
