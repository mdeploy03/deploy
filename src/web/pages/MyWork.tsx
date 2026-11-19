import { useState } from "react";
import { Link } from "react-router";
import { taskPriorityLabel, type TaskListItem } from "../../shared/projects";
import { useUsers } from "../crm/hooks";
import { useMyTasks, useSaveTask } from "../projects/hooks";
import { CheckCircle2 } from "lucide-react";
import { Chip, Empty, ErrorText, PageHeader, Select, cardClass, formatDate } from "../ui";

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
    { key: "overdue", title: "Te laat", tone: "bg-magenta", items: [] },
    { key: "today", title: "Vandaag", tone: "bg-brand", items: [] },
    { key: "week", title: "Deze week", tone: "bg-cyan", items: [] },
    { key: "later", title: "Later", tone: "bg-label", items: [] },
    { key: "none", title: "Zonder deadline", tone: "bg-line", items: [] },
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
        <Empty icon={CheckCircle2}>Geen openstaande taken. Mooi zo.</Empty>
      ) : (
        <div className="grid gap-6">
          {group(tasks.data ?? []).map((g) => (
            <section key={g.key} className={`${cardClass} overflow-hidden`}>
              <h2 className="flex items-center gap-2 border-b border-line px-4 py-3 font-sans text-sm font-semibold">
                <span className={`h-2 w-2 rounded-full ${g.tone}`} />
                {g.title} <span className="rounded-full bg-subtle px-2 py-0.5 text-xs text-muted">{g.items.length}</span>
              </h2>
              <ul className="divide-y divide-line">
                {g.items.map((t) => (
                  <li key={t.id} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-subtle/60">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-brand"
                      aria-label={`${t.title} afvinken`}
                      onChange={() => save.mutate({ id: t.id, data: { status: "done" } })}
                    />
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-ink">{t.title}</span>
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
