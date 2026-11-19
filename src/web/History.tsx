import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { orgStatusLabel } from "../shared/crm";
import { fieldLabel, type AuditEntry } from "../shared/dashboard";
import { dealStageLabel, formatEuro } from "../shared/deals";
import { projectStatusLabel } from "../shared/projects";
import { api, qs } from "./api";
import { ErrorText, formatDateTime } from "./ui";

type EntityType = "organization" | "contact" | "deal" | "project";

const hidden = new Set(["position", "updatedAt", "createdAt", "id", "createdBy", "fromDeal"]);

function show(key: string, value: unknown, entityType: EntityType): string {
  if (value === null || value === undefined || value === "") return "leeg";
  if (key === "valueCents" && typeof value === "number") return formatEuro(value);
  if (key === "probability" && typeof value === "number") return `${Math.round(value * 100)}%`;
  if (key === "stage") return dealStageLabel[value as keyof typeof dealStageLabel] ?? String(value);
  if (key === "status") {
    const labels: Record<string, string> = entityType === "project" ? projectStatusLabel : orgStatusLabel;
    return labels[String(value)] ?? String(value);
  }
  if (/Id$/.test(key)) return "gewijzigd"; // verwijzingen: id's zeggen een gebruiker niets
  const s = String(value);
  return s.length > 80 ? `${s.slice(0, 80)}…` : s;
}

function describe(e: AuditEntry, entityType: EntityType): string[] {
  if (e.action === "create") {
    const fromDeal = (e.changes as Record<string, unknown> | null)?.fromDeal;
    return [fromDeal ? "aangemaakt vanuit een gewonnen kans" : "aangemaakt"];
  }
  if (e.action === "delete") return ["verwijderd"];
  const changes = (e.changes ?? {}) as Record<string, { from: unknown; to: unknown }>;
  const lines = Object.entries(changes)
    .filter(([k]) => !hidden.has(k))
    .map(([k, { from, to }]) =>
      /Id$/.test(k) ? `${fieldLabel[k] ?? k} gewijzigd` : `${fieldLabel[k] ?? k}: ${show(k, from, entityType)} → ${show(k, to, entityType)}`,
    );
  return lines.length ? lines : [];
}

/** Inklapbare geschiedenis van één klant, contactpersoon, kans of project. */
export function History({ entityType, entityId }: { entityType: EntityType; entityId: string }) {
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ["audit", entityType, entityId],
    queryFn: () => api.get<AuditEntry[]>(`/audit${qs({ entityType, entityId })}`),
    enabled: open,
    staleTime: 0,
  });
  const entries = (query.data ?? [])
    .map((e) => ({ e, lines: describe(e, entityType) }))
    .filter((x) => x.lines.length);

  return (
    <div className="text-sm">
      <button className="font-bold text-brand hover:underline" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? "▾" : "▸"} Geschiedenis
      </button>
      {open && (
        <div className="mt-3">
          <ErrorText error={query.error} />
          {query.isPending ? (
            <p className="text-muted">Laden…</p>
          ) : entries.length === 0 ? (
            <p className="text-muted">Nog geen wijzigingen vastgelegd.</p>
          ) : (
            <ol className="grid gap-2">
              {entries.map(({ e, lines }) => (
                <li key={e.id} className="border-l-2 border-line pl-3">
                  <div className="text-xs text-muted">
                    {formatDateTime(e.createdAt)} · {e.userName ?? "onbekend"}
                  </div>
                  {lines.map((l) => (
                    <div key={l}>{l}</div>
                  ))}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
