import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ACTIVITY_TYPES, activityTypeLabel, contactName, type ActivityType, type Contact } from "../../shared/crm";
import { ApiError } from "../api";
import { ContactForm, OrganizationForm } from "../crm/forms";
import { DealForm } from "../crm/DealForm";
import { ProjectForm, ProjectStatusChip } from "../projects/forms";
import { dealStageLabel, formatEuro, type DealListItem } from "../../shared/deals";
import { useAddActivity, useDeleteActivity, useDeleteOrganization, useOrganization } from "../crm/hooks";
import { StatusChip } from "../crm/StatusChip";
import { History } from "../History";
import { Button, Card, Chip, Dialog, useDocumentTitle, Empty, ErrorText, Field, Input, Select, Textarea, formatDateTime } from "../ui";

export function CustomerDetail() {
  const { id = "" } = useParams();
  const query = useOrganization(id);
  const del = useDeleteOrganization();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [contactDialog, setContactDialog] = useState<{ contact?: Contact } | null>(null);
  const [dealDialog, setDealDialog] = useState<{ deal?: DealListItem } | null>(null);
  const [newProject, setNewProject] = useState(false);

  useDocumentTitle(query.data?.name);
  if (query.isPending) return <p className="text-muted">Laden…</p>;
  if (query.error) {
    return (
      <div>
        <ErrorText error={query.error} />
        <Link to="/klanten" className="text-brand hover:underline">
          ← Terug naar klanten
        </Link>
      </div>
    );
  }
  const org = query.data;

  const website = org.website && (org.website.startsWith("http") ? org.website : `https://${org.website}`);

  return (
    <div>
      <div className="mb-8">
        <div className="kicker border-b border-line pb-2">
          <Link to="/klanten" className="hover:text-brand">
            Klanten
          </Link>{" "}
          · {org.name}
        </div>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-4xl">{org.name}</h1>
              <StatusChip status={org.status} />
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
              onClick={() => {
                if (confirm(`“${org.name}” verwijderen? De tijdlijn wordt ook verwijderd; contactpersonen blijven bestaan zonder klant.`)) {
                  del.mutate(org.id, { onSuccess: () => navigate("/klanten") });
                }
              }}
            >
              Verwijderen
            </Button>
          </div>
        </div>
        <ErrorText error={del.error} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="grid content-start gap-6">
          <Card accent="brand" title="Gegevens">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted">KvK</dt>
              <dd>{org.kvk ?? "—"}</dd>
              <dt className="text-muted">Sector</dt>
              <dd>{org.sector ?? "—"}</dd>
              <dt className="text-muted">Website</dt>
              <dd className="break-all">
                {website ? (
                  <a href={website} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                    {org.website}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
              <dt className="text-muted">Adres</dt>
              <dd className="whitespace-pre-line">{org.address ?? "—"}</dd>
              <dt className="text-muted">Accountmanager</dt>
              <dd>{org.accountManagerName ?? "—"}</dd>
            </dl>
            <div className="mt-4 border-t border-line pt-3">
              <History entityType="organization" entityId={org.id} />
            </div>
          </Card>

          <Card
            accent="cyan"
            title={`Contactpersonen (${org.contacts.length})`}
            actions={
              <Button variant="link" onClick={() => setContactDialog({})}>
                + Toevoegen
              </Button>
            }
          >
            {org.contacts.length === 0 ? (
              <p className="text-sm text-muted">Nog geen contactpersonen.</p>
            ) : (
              <ul className="divide-y divide-line">
                {org.contacts.map((c) => (
                  <li key={c.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0 text-sm">
                      <div className="font-bold text-ink">{contactName(c)}</div>
                      {c.jobTitle && <div className="text-muted">{c.jobTitle}</div>}
                      <div className="mt-1 flex flex-wrap gap-x-3">
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="break-all text-brand hover:underline">
                            {c.email}
                          </a>
                        )}
                        {c.phone && (
                          <a href={`tel:${c.phone}`} className="text-brand hover:underline">
                            {c.phone}
                          </a>
                        )}
                        {c.linkedin && (
                          <a href={c.linkedin} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                            LinkedIn
                          </a>
                        )}
                      </div>
                    </div>
                    <Button variant="link" onClick={() => setContactDialog({ contact: c })}>
                      Bewerken
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="grid content-start gap-6">
        <Card
          accent="brand"
          title={`Kansen (${org.deals.length})`}
          actions={
            <Button variant="link" onClick={() => setDealDialog({})}>
              + Nieuwe kans
            </Button>
          }
        >
          {org.deals.length === 0 ? (
            <p className="text-sm text-muted">Nog geen kansen voor deze klant.</p>
          ) : (
            <ul className="divide-y divide-line">
              {org.deals.map((d) => (
                <li key={d.id}>
                  <button
                    className="flex w-full items-center justify-between gap-3 py-2 text-left text-sm hover:bg-subtle"
                    onClick={() => setDealDialog({ deal: d })}
                  >
                    <span className="min-w-0">
                      <span className="block font-bold text-ink">{d.title}</span>
                      <span className="text-muted">{d.contactName ?? ""}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="font-bold text-brand">{formatEuro(d.valueCents)}</span>
                      <Chip tone={d.stage === "won" ? "brand" : d.stage === "lost" ? "muted" : "magenta"}>{dealStageLabel[d.stage]}</Chip>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          accent="cyan"
          title={`Projecten (${org.projects.length})`}
          actions={
            <Button variant="link" onClick={() => setNewProject(true)}>
              + Nieuw project
            </Button>
          }
        >
          {org.projects.length === 0 ? (
            <p className="text-sm text-muted">Nog geen projecten voor deze klant.</p>
          ) : (
            <ul className="divide-y divide-line">
              {org.projects.map((pr) => (
                <li key={pr.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <Link to={`/projecten/${pr.id}`} className="font-bold text-brand hover:underline">
                    {pr.name}
                  </Link>
                  <ProjectStatusChip status={pr.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card accent="magenta" title="Tijdlijn">
          <ActivityForm organizationId={org.id} contacts={org.contacts} />
          <Timeline organizationId={org.id} activities={org.activities} />
        </Card>
        </div>
      </div>

      <Dialog open={!!dealDialog} title={dealDialog?.deal ? "Kans bewerken" : "Nieuwe kans"} onClose={() => setDealDialog(null)}>
        {dealDialog && <DealForm deal={dealDialog.deal} organizationId={org.id} onDone={() => setDealDialog(null)} />}
      </Dialog>
      <Dialog open={newProject} title="Nieuw project" onClose={() => setNewProject(false)}>
        {newProject && <ProjectForm organizationId={org.id} onDone={(pr) => navigate(`/projecten/${pr.id}`)} />}
      </Dialog>
      <Dialog open={editing} title="Klant bewerken" onClose={() => setEditing(false)}>
        <OrganizationForm org={org} onDone={() => setEditing(false)} />
      </Dialog>
      <Dialog
        open={!!contactDialog}
        title={contactDialog?.contact ? "Contactpersoon bewerken" : "Nieuwe contactpersoon"}
        onClose={() => setContactDialog(null)}
      >
        {contactDialog && (
          <ContactForm contact={contactDialog.contact} organizationId={org.id} onDone={() => setContactDialog(null)} />
        )}
      </Dialog>
    </div>
  );
}

function toLocalInput(ms: number) {
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 16);
}

function ActivityForm({ organizationId, contacts }: { organizationId: string; contacts: Contact[] }) {
  const add = useAddActivity(organizationId);
  const [type, setType] = useState<ActivityType>("note");
  const [body, setBody] = useState("");
  const [contactId, setContactId] = useState("");
  const [when, setWhen] = useState(() => toLocalInput(Date.now()));
  const errors = add.error instanceof ApiError ? add.error.fields : {};

  return (
    <form
      className="mb-6 grid gap-3 border-b-2 border-line pb-6"
      onSubmit={(e) => {
        e.preventDefault();
        add.mutate(
          { type, body, contactId: contactId || null, occurredAt: new Date(when).getTime() },
          {
            onSuccess: () => {
              setBody("");
              setWhen(toLocalInput(Date.now()));
            },
          },
        );
      }}
    >
      <div className="flex flex-wrap gap-2">
        {ACTIVITY_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`border-2 px-3 py-1 text-sm font-bold ${type === t ? "border-magenta text-magenta" : "border-line text-muted hover:text-brand"}`}
          >
            {activityTypeLabel[t]}
          </button>
        ))}
      </div>
      <Field label={type === "note" ? "Notitie" : "Verslag"} error={errors.body}>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Wat is er besproken of afgesproken?" required />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Datum en tijd">
          <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required />
        </Field>
        {contacts.length > 0 && (
          <Field label="Met" error={errors.contactId}>
            <Select value={contactId} onChange={(e) => setContactId(e.target.value)}>
              <option value="">— Niemand specifiek —</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {contactName(c)}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
      {!Object.keys(errors).length && <ErrorText error={add.error} />}
      <div>
        <Button type="submit" disabled={add.isPending || !body.trim()}>
          {add.isPending ? "Opslaan…" : "Toevoegen aan tijdlijn"}
        </Button>
      </div>
    </form>
  );
}

const typeTone: Record<ActivityType, "brand" | "magenta" | "muted"> = {
  note: "muted",
  call: "brand",
  email: "brand",
  meeting: "magenta",
};

function Timeline({ organizationId, activities }: { organizationId: string; activities: { id: string; type: ActivityType; body: string; occurredAt: number; contactName: string | null; authorName: string | null }[] }) {
  const del = useDeleteActivity(organizationId);
  if (activities.length === 0) return <Empty>Nog niets op de tijdlijn.</Empty>;
  return (
    <ol className="grid gap-5">
      {activities.map((a) => (
        <li key={a.id} className="border-l-2 border-cyan pl-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <Chip tone={typeTone[a.type]}>{activityTypeLabel[a.type]}</Chip>
            <span>{formatDateTime(a.occurredAt)}</span>
            {a.contactName && <span>· met {a.contactName}</span>}
            {a.authorName && <span>· door {a.authorName}</span>}
            <button
              className="ml-auto text-muted hover:text-magenta"
              onClick={() => confirm("Dit item van de tijdlijn verwijderen?") && del.mutate(a.id)}
            >
              Verwijderen
            </button>
          </div>
          <p className="mt-2 whitespace-pre-line text-sm text-ink">{a.body}</p>
        </li>
      ))}
    </ol>
  );
}
