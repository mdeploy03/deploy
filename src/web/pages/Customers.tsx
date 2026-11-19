import { useDeferredValue, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { contactName, ORG_STATUSES, orgStatusLabel, type ContactListItem } from "../../shared/crm";
import { ContactForm, OrganizationForm } from "../crm/forms";
import { useContacts, useOrganizations } from "../crm/hooks";
import { StatusChip } from "../crm/StatusChip";
import { Button, Dialog, Empty, ErrorText, Input, PageHeader, formatDate } from "../ui";

export function Customers() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "contacten" ? "contacten" : "organisaties";
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const tabClass = (active: boolean) =>
    `border-b-2 px-3 py-2 text-sm font-bold ${active ? "border-magenta text-brand" : "border-transparent text-muted hover:text-brand"}`;

  return (
    <div>
      <PageHeader
        kicker="CRM"
        title="Klanten"
        actions={
          <Button onClick={() => setCreating(true)}>{tab === "contacten" ? "Nieuwe contactpersoon" : "Nieuwe klant"}</Button>
        }
      />
      <div className="mb-6 flex gap-2 border-b-2 border-line">
        <button className={tabClass(tab === "organisaties")} onClick={() => setParams({})}>
          Organisaties
        </button>
        <button className={tabClass(tab === "contacten")} onClick={() => setParams({ tab: "contacten" })}>
          Contactpersonen
        </button>
      </div>

      {tab === "organisaties" ? <OrganizationList /> : <ContactList />}

      <Dialog
        open={creating}
        title={tab === "contacten" ? "Nieuwe contactpersoon" : "Nieuwe klant"}
        onClose={() => setCreating(false)}
      >
        {tab === "contacten" ? (
          <ContactForm onDone={() => setCreating(false)} />
        ) : (
          <OrganizationForm
            onDone={(org) => {
              setCreating(false);
              navigate(`/klanten/${org.id}`);
            }}
          />
        )}
      </Dialog>
    </div>
  );
}

function OrganizationList() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");
  const query = useOrganizations({ q: useDeferredValue(q.trim()), status });
  const navigate = useNavigate();

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-80">
          <Input type="search" placeholder="Zoek op naam, sector of KvK…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          {[["", "Alle"] as const, ...ORG_STATUSES.map((s) => [s, orgStatusLabel[s]] as const)].map(([value, label]) => (
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
        <Empty>{q || status ? "Geen klanten gevonden met deze filters." : "Nog geen klanten. Maak de eerste aan met “Nieuwe klant”."}</Empty>
      ) : (
        <div className="overflow-x-auto border-2 border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-subtle text-muted">
              <tr>
                <th className="px-4 py-3">Naam</th>
                <th className="px-4 py-3">Status</th>
                <th className="hidden px-4 py-3 md:table-cell">Sector</th>
                <th className="hidden px-4 py-3 md:table-cell">Accountmanager</th>
                <th className="px-4 py-3 text-right">Contacten</th>
                <th className="hidden px-4 py-3 sm:table-cell">Laatste contact</th>
              </tr>
            </thead>
            <tbody>
              {query.data?.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => navigate(`/klanten/${o.id}`)}
                  className="cursor-pointer border-t border-line hover:bg-subtle"
                >
                  <td className="px-4 py-3 font-bold text-brand">
                    <Link to={`/klanten/${o.id}`} onClick={(e) => e.stopPropagation()}>
                      {o.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusChip status={o.status} />
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">{o.sector ?? "—"}</td>
                  <td className="hidden px-4 py-3 md:table-cell">{o.accountManagerName ?? "—"}</td>
                  <td className="px-4 py-3 text-right">{o.contactCount}</td>
                  <td className="hidden px-4 py-3 sm:table-cell">{formatDate(o.lastActivityAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ContactList() {
  const [q, setQ] = useState("");
  const query = useContacts({ q: useDeferredValue(q.trim()) });
  const [editing, setEditing] = useState<ContactListItem | null>(null);

  return (
    <div>
      <div className="mb-4 w-full sm:w-80">
        <Input type="search" placeholder="Zoek op naam, e-mail, functie of klant…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ErrorText error={query.error} />
      {query.data && query.data.length === 0 ? (
        <Empty>{q ? "Geen contactpersonen gevonden." : "Nog geen contactpersonen."}</Empty>
      ) : (
        <div className="overflow-x-auto border-2 border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-subtle text-muted">
              <tr>
                <th className="px-4 py-3">Naam</th>
                <th className="hidden px-4 py-3 md:table-cell">Functie</th>
                <th className="px-4 py-3">Klant</th>
                <th className="hidden px-4 py-3 sm:table-cell">E-mail</th>
                <th className="hidden px-4 py-3 lg:table-cell">Telefoon</th>
              </tr>
            </thead>
            <tbody>
              {query.data?.map((c) => (
                <tr key={c.id} onClick={() => setEditing(c)} className="cursor-pointer border-t border-line hover:bg-subtle">
                  <td className="px-4 py-3 font-bold text-brand">{contactName(c)}</td>
                  <td className="hidden px-4 py-3 md:table-cell">{c.jobTitle ?? "—"}</td>
                  <td className="px-4 py-3">
                    {c.organizationId ? (
                      <Link to={`/klanten/${c.organizationId}`} className="text-brand hover:underline" onClick={(e) => e.stopPropagation()}>
                        {c.organizationName}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    {c.email ? (
                      <a href={`mailto:${c.email}`} className="text-brand hover:underline" onClick={(e) => e.stopPropagation()}>
                        {c.email}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">{c.phone ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog open={!!editing} title="Contactpersoon bewerken" onClose={() => setEditing(null)}>
        {editing && <ContactForm contact={editing} onDone={() => setEditing(null)} />}
      </Dialog>
    </div>
  );
}
