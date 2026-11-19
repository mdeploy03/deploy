import { useState } from "react";
import { Link } from "react-router";
import { contactName } from "../../shared/crm";
import { DEAL_STAGES, dealStageLabel, defaultProbability, formatEuro, parseEuro, type DealListItem, type DealStage } from "../../shared/deals";
import { ApiError } from "../api";
import { History } from "../History";
import { Button, ErrorText, Field, Input, Select, Textarea } from "../ui";
import { useCreateProject, useDeleteDeal, useOrgContacts, useSaveDeal } from "./dealHooks";
import { useOrganizations, useUsers } from "./hooks";

type Props = {
  deal?: DealListItem;
  /** Vaste klant (vanaf de klantpagina). */
  organizationId?: string;
  onDone: () => void;
};

const centsToInput = (cents: number) => (cents ? (cents / 100).toLocaleString("nl-NL", { maximumFractionDigits: 2 }) : "");

export function DealForm({ deal, organizationId, onDone }: Props) {
  const save = useSaveDeal();
  const remove = useDeleteDeal();
  const createProject = useCreateProject();
  const orgs = useOrganizations({});
  const users = useUsers();

  const [orgId, setOrgId] = useState(deal?.organizationId ?? organizationId ?? "");
  const [stage, setStage] = useState<DealStage>(deal?.stage ?? "lead");
  const [value, setValue] = useState(centsToInput(deal?.valueCents ?? 0));
  // Leeg = standaardkans van de fase.
  const [probability, setProbability] = useState(
    deal && deal.probability !== defaultProbability[deal.stage] ? String(Math.round(deal.probability * 100)) : "",
  );
  const contacts = useOrgContacts(orgId || undefined);
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const errors = { ...(save.error instanceof ApiError ? save.error.fields : {}), ...localErrors };
  const valueCents = parseEuro(value);

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const v = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
        const local: Record<string, string> = {};
        if (valueCents === null) local.valueCents = "Ongeldig bedrag, bijvoorbeeld 12.500 of 12.500,50";
        const pct = probability.trim() === "" ? undefined : Number(probability.replace(",", "."));
        if (pct !== undefined && !(pct >= 0 && pct <= 100)) local.probability = "Kies een percentage tussen 0 en 100";
        setLocalErrors(local);
        if (Object.keys(local).length) return;
        save.mutate(
          {
            id: deal?.id,
            data: {
              title: v.title,
              organizationId: orgId,
              contactId: v.contactId || null,
              stage,
              valueCents: valueCents ?? 0,
              probability: pct === undefined ? defaultProbability[stage] : pct / 100,
              expectedCloseDate: v.expectedCloseDate,
              lostReason: stage === "lost" ? v.lostReason : null,
              ...(v.ownerId !== undefined ? { ownerId: v.ownerId || null } : {}),
            },
          },
          { onSuccess: onDone },
        );
      }}
    >
      <Field label="Titel *" error={errors.title}>
        <Input name="title" defaultValue={deal?.title} required autoFocus placeholder="Bijv. Green Belt-traject productieteam" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        {!organizationId && (
          <Field label="Klant *" error={errors.organizationId}>
            <Select value={orgId} onChange={(e) => setOrgId(e.target.value)} required>
              <option value="">— Kies een klant —</option>
              {orgs.data?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Contactpersoon" error={errors.contactId}>
          <Select name="contactId" key={`${orgId}-${contacts.data ? "geladen" : "laden"}`} defaultValue={deal?.organizationId === orgId ? (deal?.contactId ?? "") : ""} disabled={!orgId}>
            <option value="">— Geen —</option>
            {contacts.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {contactName(c)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Fase" error={errors.stage}>
          <Select value={stage} onChange={(e) => setStage(e.target.value as DealStage)}>
            {DEAL_STAGES.map((s) => (
              <option key={s} value={s}>
                {dealStageLabel[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Waarde (€)" error={errors.valueCents}>
          <Input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder="12.500" />
        </Field>
        <Field label="Slagingskans (%)" error={errors.probability}>
          <Input
            value={probability}
            onChange={(e) => setProbability(e.target.value)}
            inputMode="numeric"
            placeholder={`Standaard ${Math.round(defaultProbability[stage] * 100)}%`}
          />
        </Field>
        <Field label="Verwachte sluitdatum" error={errors.expectedCloseDate}>
          <Input name="expectedCloseDate" type="date" defaultValue={deal?.expectedCloseDate ?? ""} />
        </Field>
        {users.data && users.data.length > 0 && (
          <Field label="Eigenaar" error={errors.ownerId}>
            <Select name="ownerId" defaultValue={deal?.ownerId ?? ""}>
              <option value="">— Geen —</option>
              {users.data.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
      {stage === "lost" && (
        <Field label="Reden verloren" error={errors.lostReason}>
          <Textarea name="lostReason" defaultValue={deal?.lostReason ?? ""} rows={2} placeholder="Bijv. te duur, andere aanbieder gekozen, geen budget" />
        </Field>
      )}
      {valueCents !== null && valueCents > 0 && (
        <p className="text-sm text-muted">
          Gewogen waarde:{" "}
          {formatEuro(Math.round(valueCents * (probability.trim() === "" ? defaultProbability[stage] : Number(probability.replace(",", ".")) / 100 || 0)))}
        </p>
      )}

      {deal?.stage === "won" && (
        <div className="rounded-xl bg-brand-soft p-4 text-sm">
          {deal.projectId || createProject.data ? (
            <Link to={`/projecten/${deal.projectId ?? createProject.data?.id}`} className="font-semibold text-brand hover:underline">
              {createProject.data ? "Project aangemaakt — openen →" : "Naar het project →"}
            </Link>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>Deze kans is gewonnen. Maak er direct een project van.</span>
              <Button variant="secondary" disabled={createProject.isPending} onClick={() => createProject.mutate(deal.id)}>
                {createProject.isPending ? "Bezig…" : "Project aanmaken"}
              </Button>
            </div>
          )}
          <ErrorText error={createProject.error} />
        </div>
      )}

      {!(save.error instanceof ApiError && Object.keys(save.error.fields).length) && <ErrorText error={save.error} />}
      <ErrorText error={remove.error} />
      {deal && <History entityType="deal" entityId={deal.id} />}
      <div className="flex justify-between gap-2">
        {deal ? (
          <Button
            variant="danger"
            disabled={remove.isPending}
            onClick={() => confirm(`Kans “${deal.title}” verwijderen?`) && remove.mutate(deal.id, { onSuccess: onDone })}
          >
            Verwijderen
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Opslaan…" : "Opslaan"}
        </Button>
      </div>
    </form>
  );
}
