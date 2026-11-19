import { useDeferredValue, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { contactName, ORG_STATUSES, orgStatusLabel, type ContactListItem } from "../../shared/crm";
import { ContactForm, OrganizationForm } from "../crm/forms";
import { useContacts, useOrganizations } from "../crm/hooks";
import { StatusChip } from "../crm/StatusChip";
import { Building2, Plus, Users } from "lucide-react";
import { Button, Dialog, Empty, ErrorText, PageHeader, SearchInput, Segmented, formatDate, table } from "../ui";

export function Customers() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "contacten" ? "contacten" : "organisaties";
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const tabClass = (active: boolean) =>
    `-mb-px inline-flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${active ? "border-magenta text-ink" : "border-transparent text-muted hover:text-ink"}`;

  return (
    <div>
      <PageHeader
        kicker="CRM"
        title="Klanten"
        actions={
          <Button icon={Plus} onClick={() => setCreating(true)}>{tab === "contacten" ? "Nieuwe contactpersoon" : "Nieuwe klant"}</Button>
        }
      />
      <div className="mb-6 flex gap-6 border-b border-line">
        <button className={tabClass(tab === "organisaties")} onClick={() => setParams({})}>
          <Building2 size={16} /> Organisaties
        </button>
        <button className={tabClass(tab === "contacten")} onClick={() => setParams({ tab: "contacten" })}>
          <Users size={16} /> Contactpersonen
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
          <SearchInput placeholder="Zoek op naam, sector of KvK…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Segmented
          value={status}
          onChange={setStatus}
          options={[["", "Alle"] as const, ...ORG_STATUSES.map((s) => [s, orgStatusLabel[s]] as const)]}
        />
      </div>

      <ErrorText error={query.error} />
      {query.data && query.data.length === 0 ? (
        <Empty icon={Building2}>{q || status ? "Geen klanten gevonden met deze filters." : "Nog geen klanten. Maak de eerste aan met “Nieuwe klant”."}</Empty>
      ) : (
        <div className={table.wrap}>
          <table className={table.table}>
            <thead className={table.head}>
              <tr>
                <th className={`${table.th}`}>Naam</th>
                <th className={`${table.th}`}>Status</th>
                <th className="hidden px-4 py-3 md:table-cell">Sector</th>
                <th className="hidden px-4 py-3 md:table-cell">Accountmanager</th>
                <th className={`${table.th} text-right`}>Contacten</th>
                <th className="hidden px-4 py-3 sm:table-cell">Laatste contact</th>
              </tr>
            </thead>
            <tbody>
              {query.data?.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => navigate(`/klanten/${o.id}`)}
                  className={table.row}
                >
                  <td className={`${table.td} font-semibold text-ink`}>
                    <Link to={`/klanten/${o.id}`} onClick={(e) => e.stopPropagation()}>
                      {o.name}
                    </Link>
                  </td>
                  <td className={`${table.td}`}>
                    <StatusChip status={o.status} />
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">{o.sector ?? "—"}</td>
                  <td className="hidden px-4 py-3 md:table-cell">{o.accountManagerName ?? "—"}</td>
                  <td className={`${table.td} text-right`}>{o.contactCount}</td>
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
        <SearchInput placeholder="Zoek op naam, e-mail, functie of klant…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ErrorText error={query.error} />
      {query.data && query.data.length === 0 ? (
        <Empty icon={Users}>{q ? "Geen contactpersonen gevonden." : "Nog geen contactpersonen."}</Empty>
      ) : (
        <div className={table.wrap}>
          <table className={table.table}>
            <thead className={table.head}>
              <tr>
                <th className={`${table.th}`}>Naam</th>
                <th className="hidden px-4 py-3 md:table-cell">Functie</th>
                <th className={`${table.th}`}>Klant</th>
                <th className="hidden px-4 py-3 sm:table-cell">E-mail</th>
                <th className="hidden px-4 py-3 lg:table-cell">Telefoon</th>
              </tr>
            </thead>
            <tbody>
              {query.data?.map((c) => (
                <tr key={c.id} onClick={() => setEditing(c)} className={table.row}>
                  <td className={`${table.td} font-semibold text-ink`}>{contactName(c)}</td>
                  <td className="hidden px-4 py-3 md:table-cell">{c.jobTitle ?? "—"}</td>
                  <td className={`${table.td}`}>
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
