import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { activityTypeLabel } from "../../shared/crm";
import type { Dashboard as DashboardData } from "../../shared/dashboard";
import { dealStageLabel, formatEuro, OPEN_STAGES } from "../../shared/deals";
import { taskPriorityLabel } from "../../shared/projects";
import { api } from "../api";
import { AlarmClock, Briefcase, CalendarClock, MessageSquareText, Scale, Target, TrendingUp, Trophy, type LucideIcon } from "lucide-react";
import { Card, Chip, ErrorText, PageHeader, Progress, Stat as StatTile, cardClass, formatDate, formatDateTime, useDocumentTitle, type Accent } from "../ui";

const day = (iso: string | null) => (iso ? formatDate(new Date(iso).getTime()) : "—");
const todayIso = () => new Date().toLocaleDateString("sv-SE");

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Goedemorgen" : h < 18 ? "Goedemiddag" : "Goedenavond";
}

export function Dashboard() {
  const query = useQuery({ queryKey: ["dashboard"], queryFn: () => api.get<DashboardData>("/dashboard"), staleTime: 0 });
  const d = query.data;
  const today = todayIso();
  useDocumentTitle("Dashboard");

  return (
    <div>
      <PageHeader kicker={new Date().toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" })} title={greeting()} />
      <ErrorText error={query.error} />
      {!d ? (
        !query.error && <p className="text-muted">Laden…</p>
      ) : (
        <div className="grid gap-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat to="/pipeline" icon={Target} label="Open kansen" value={String(d.pipeline.openCount)} sub={`${formatEuro(d.pipeline.openValueCents)} totaal`} accent="cyan" />
            <Stat to="/pipeline" icon={Scale} label="Gewogen pipeline" value={formatEuro(d.pipeline.weightedValueCents)} sub="waarde × slagingskans" accent="cyan" />
            <Stat
              to="/pipeline"
              icon={Trophy}
              label="Gewonnen dit kwartaal"
              value={formatEuro(d.pipeline.wonThisQuarter.valueCents)}
              sub={`${d.pipeline.wonThisQuarter.count} ${d.pipeline.wonThisQuarter.count === 1 ? "kans" : "kansen"}`}
              accent="brand"
            />
            <Stat
              to="/mijn-werk"
              icon={AlarmClock}
              label="Taken te laat"
              value={String(d.tasks.overdueCount)}
              sub={`${d.projects.activeCount} actieve ${d.projects.activeCount === 1 ? "project" : "projecten"}`}
              accent="magenta"
              alert={d.tasks.overdueCount > 0}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card accent="cyan" icon={TrendingUp} title="Pipeline per fase">
              <PipelineBars data={d} />
            </Card>

            <Card accent="magenta" icon={CalendarClock} title="Deadlines t/m zondag">
              {d.tasks.dueThisWeek.length === 0 ? (
                <p className="text-sm text-muted">Geen taken met een deadline deze week.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {d.tasks.dueThisWeek.map((t) => (
                    <li key={t.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                      <div className="min-w-0">
                        <span className="font-semibold text-ink">{t.title}</span>
                        {t.priority === "high" && (
                          <span className="ml-2">
                            <Chip tone="magenta">{taskPriorityLabel.high}</Chip>
                          </span>
                        )}
                        <div className="text-xs text-muted">
                          <Link to={`/projecten/${t.projectId}`} className="text-brand hover:underline">
                            {t.projectName}
                          </Link>
                          {t.assigneeName && <> · {t.assigneeName}</>}
                        </div>
                      </div>
                      <span className={`shrink-0 text-xs ${t.dueDate < today ? "font-semibold text-magenta" : "text-muted"}`}>
                        {t.dueDate < today ? "te laat · " : t.dueDate === today ? "vandaag · " : ""}
                        {day(t.dueDate)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card accent="brand" icon={Briefcase} title="Actieve projecten">
              {d.projects.active.length === 0 ? (
                <p className="text-sm text-muted">Geen actieve projecten.</p>
              ) : (
                <ul className="grid gap-4">
                  {d.projects.active.map((p) => {
                    const pct = p.taskCount ? Math.round((p.doneCount / p.taskCount) * 100) : 0;
                    return (
                      <li key={p.id} className="text-sm">
                        <div className="flex items-baseline justify-between gap-3">
                          <Link to={`/projecten/${p.id}`} className="font-semibold text-brand hover:underline">
                            {p.name}
                          </Link>
                          <span className="shrink-0 text-xs text-muted">
                            {p.overdueCount > 0 && <span className="font-semibold text-magenta">{p.overdueCount} te laat · </span>}
                            {p.endDate ? `t/m ${day(p.endDate)}` : ""}
                          </span>
                        </div>
                        <div className="text-xs text-muted">{p.organizationName}</div>
                        <div className="mt-1.5" title={`${p.doneCount}/${p.taskCount} taken klaar`}>
                          <Progress value={pct} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card accent="cyan" icon={Target} title="Kansen om op te volgen">
              {d.pipeline.closingSoon.length === 0 ? (
                <p className="text-sm text-muted">Geen open kansen met een sluitdatum in de komende twee weken.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {d.pipeline.closingSoon.map((k) => (
                    <li key={k.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                      <div className="min-w-0">
                        <div className="font-semibold text-ink">{k.title}</div>
                        <div className="text-xs text-muted">
                          {k.organizationName} · {dealStageLabel[k.stage]} · {formatEuro(k.valueCents)}
                        </div>
                      </div>
                      <span className={`shrink-0 text-xs ${k.expectedCloseDate < today ? "font-semibold text-magenta" : "text-muted"}`}>
                        {k.expectedCloseDate < today ? "verlopen · " : ""}
                        {day(k.expectedCloseDate)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card accent="magenta" icon={MessageSquareText} title="Laatste klantcontact">
            {d.recentActivities.length === 0 ? (
              <p className="text-sm text-muted">Nog niets vastgelegd op een tijdlijn.</p>
            ) : (
              <ul className="grid gap-3">
                {d.recentActivities.map((a) => (
                  <li key={a.id} className="border-l-2 border-cyan/60 pl-3 text-sm">
                    <div className="text-xs text-muted">
                      <Link to={`/klanten/${a.organizationId}`} className="font-semibold text-brand hover:underline">
                        {a.organizationName}
                      </Link>{" "}
                      · {activityTypeLabel[a.type]} · {formatDateTime(a.occurredAt)}
                    </div>
                    <p className="line-clamp-2 whitespace-pre-line">{a.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function Stat({ to, icon, label, value, sub, accent, alert }: { to: string; icon: LucideIcon; label: string; value: string; sub: string; accent: Accent; alert?: boolean }) {
  return (
    <Link to={to} className={`${cardClass} block p-5 transition-shadow hover:shadow-pop`}>
      <StatTile icon={icon} label={label} value={value} sub={sub} accent={accent} alert={alert} />
    </Link>
  );
}

function PipelineBars({ data }: { data: DashboardData }) {
  const rows = OPEN_STAGES.map((stage) => data.pipeline.byStage.find((s) => s.stage === stage) ?? { stage, count: 0, valueCents: 0 });
  const max = Math.max(1, ...rows.map((r) => r.valueCents));
  if (rows.every((r) => r.count === 0)) return <p className="text-sm text-muted">Nog geen open kansen.</p>;
  return (
    <dl className="grid gap-3 text-sm">
      {rows.map((r) => (
        <div key={r.stage}>
          <div className="flex justify-between gap-2">
            <dt className="text-ink">
              {dealStageLabel[r.stage]} <span className="text-xs text-muted">({r.count})</span>
            </dt>
            <dd className="font-semibold text-brand">{formatEuro(r.valueCents)}</dd>
          </div>
          <div className="mt-1.5">
            <Progress value={(r.valueCents / max) * 100} tone="cyan" />
          </div>
        </div>
      ))}
    </dl>
  );
}
