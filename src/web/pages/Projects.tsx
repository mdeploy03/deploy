import { useDeferredValue, useState } from "react";
import { Link, useNavigate } from "react-router";
import { PROJECT_STATUSES, projectStatusLabel } from "../../shared/projects";
import { ProjectForm, ProjectStatusChip } from "../projects/forms";
import { useProjects } from "../projects/hooks";
import { Button, Dialog, Empty, ErrorText, Input, PageHeader, formatDate } from "../ui";

const day = (iso: string | null) => (iso ? formatDate(new Date(iso).getTime()) : null);

export function Projects() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [creating, setCreating] = useState(false);
  const query = useProjects({ q: useDeferredValue(q.trim()), status });
  const navigate = useNavigate();

  return (
    <div>
      <PageHeader kicker="Uitvoering" title="Projecten" actions={<Button onClick={() => setCreating(true)}>Nieuw project</Button>} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-80">
          <Input type="search" placeholder="Zoek op project of klant…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          {[["", "Alle"] as const, ...PROJECT_STATUSES.map((s) => [s, projectStatusLabel[s]] as const)].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setStatus(value)}
              className={`border-2 px-3 py-1 text-sm font-bold ${status === value ? "border-brand bg-brand text-white" : "border-line text-muted hover:border-brand hover:text-brand"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <ErrorText error={query.error} />

      {query.data && query.data.length === 0 ? (
        <Empty>{q || status ? "Geen projecten gevonden met deze filters." : "Nog geen projecten. Maak er een aan, of maak er een van een gewonnen kans in de pipeline."}</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {query.data?.map((p) => {
            const pct = p.taskCount ? Math.round((p.doneCount / p.taskCount) * 100) : 0;
            const period = [day(p.startDate), day(p.endDate)].filter(Boolean).join(" – ");
            return (
              <article
                key={p.id}
                onClick={() => navigate(`/projecten/${p.id}`)}
                className="cursor-pointer border-2 border-l-[12px] border-line border-l-cyan bg-white p-5 hover:border-brand hover:border-l-cyan"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-xl">
                    <Link to={`/projecten/${p.id}`} onClick={(e) => e.stopPropagation()}>
                      {p.name}
                    </Link>
                  </h2>
                  <ProjectStatusChip status={p.status} />
                </div>
                <div className="mt-1 text-sm text-muted">{p.organizationName}</div>
                {(period || p.leadName) && (
                  <div className="mt-1 text-xs text-muted">
                    {period}
                    {period && p.leadName && " · "}
                    {p.leadName}
                  </div>
                )}
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-muted">
                    <span>
                      {p.doneCount}/{p.taskCount} taken klaar
                    </span>
                    {p.overdueCount > 0 && <span className="font-bold text-magenta">{p.overdueCount} te laat</span>}
                  </div>
                  <div className="mt-1 h-2 bg-subtle">
                    <div className="h-2 bg-brand" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={creating} title="Nieuw project" onClose={() => setCreating(false)}>
        {creating && (
          <ProjectForm
            onDone={(p) => {
              setCreating(false);
              navigate(`/projecten/${p.id}`);
            }}
          />
        )}
      </Dialog>
    </div>
  );
}
