import { useDeferredValue, useState } from "react";
import { Link, useNavigate } from "react-router";
import { PROJECT_STATUSES, projectStatusLabel } from "../../shared/projects";
import { ProjectForm, ProjectStatusChip } from "../projects/forms";
import { useProjects } from "../projects/hooks";
import { AlertCircle, Briefcase, CalendarDays, Plus } from "lucide-react";
import { Button, Dialog, Empty, ErrorText, PageHeader, Progress, SearchInput, Segmented, cardClass, formatDate } from "../ui";

const day = (iso: string | null) => (iso ? formatDate(new Date(iso).getTime()) : null);

export function Projects() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [creating, setCreating] = useState(false);
  const query = useProjects({ q: useDeferredValue(q.trim()), status });
  const navigate = useNavigate();

  return (
    <div>
      <PageHeader kicker="Uitvoering" title="Projecten" actions={<Button icon={Plus} onClick={() => setCreating(true)}>Nieuw project</Button>} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-80">
          <SearchInput placeholder="Zoek op project of klant…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Segmented
          value={status}
          onChange={setStatus}
          options={[["", "Alle"] as const, ...PROJECT_STATUSES.map((s) => [s, projectStatusLabel[s]] as const)]}
        />
      </div>
      <ErrorText error={query.error} />

      {query.data && query.data.length === 0 ? (
        <Empty icon={Briefcase}>{q || status ? "Geen projecten gevonden met deze filters." : "Nog geen projecten. Maak er een aan, of maak er een van een gewonnen kans in de pipeline."}</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {query.data?.map((p) => {
            const pct = p.taskCount ? Math.round((p.doneCount / p.taskCount) * 100) : 0;
            const period = [day(p.startDate), day(p.endDate)].filter(Boolean).join(" – ");
            return (
              <article
                key={p.id}
                onClick={() => navigate(`/projecten/${p.id}`)}
                className={`${cardClass} group cursor-pointer p-5 transition-shadow hover:shadow-pop`}
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-xl leading-tight group-hover:text-brand">
                    <Link to={`/projecten/${p.id}`} onClick={(e) => e.stopPropagation()}>
                      {p.name}
                    </Link>
                  </h2>
                  <ProjectStatusChip status={p.status} />
                </div>
                <div className="mt-1 text-sm text-muted">{p.organizationName}</div>
                {(period || p.leadName) && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                    <CalendarDays size={12} />
                    {period}
                    {period && p.leadName && " · "}
                    {p.leadName}
                  </div>
                )}
                <div className="mt-5">
                  <div className="mb-1.5 flex justify-between text-xs text-muted">
                    <span>
                      {p.doneCount}/{p.taskCount} taken klaar
                    </span>
                    {p.overdueCount > 0 && (
                      <span className="inline-flex items-center gap-1 font-semibold text-magenta">
                        <AlertCircle size={12} /> {p.overdueCount} te laat
                      </span>
                    )}
                  </div>
                  <Progress value={pct} />
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
