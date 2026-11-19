import type { FormEvent } from "react";
import { ORG_STATUSES, orgStatusLabel, type Contact, type Organization } from "../../shared/crm";
import { ApiError } from "../api";
import { History } from "../History";
import { Button, ErrorText, Field, Input, Select, Textarea } from "../ui";
import { useDeleteContact, useOrganizations, useSaveContact, useSaveOrganization, useUsers } from "./hooks";

function formValues(e: FormEvent<HTMLFormElement>) {
  e.preventDefault();
  return Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
}

const fieldErrors = (error: unknown) => (error instanceof ApiError ? error.fields : {});

export function OrganizationForm({ org, onDone }: { org?: Organization; onDone: (saved: Organization) => void }) {
  const save = useSaveOrganization();
  const users = useUsers();
  const errors = fieldErrors(save.error);

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        const v = formValues(e);
        save.mutate(
          {
            id: org?.id,
            data: {
              name: v.name,
              status: v.status as Organization["status"],
              kvk: v.kvk,
              sector: v.sector,
              website: v.website,
              address: v.address,
              accountManagerId: v.accountManagerId, // ontbreekt als er geen gebruikers zijn → ongewijzigd
            },
          },
          { onSuccess: onDone },
        );
      }}
    >
      <Field label="Naam *" error={errors.name}>
        <Input name="name" defaultValue={org?.name} required autoFocus />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Status" error={errors.status}>
          <Select name="status" defaultValue={org?.status ?? "prospect"}>
            {ORG_STATUSES.map((s) => (
              <option key={s} value={s}>
                {orgStatusLabel[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="KvK-nummer" error={errors.kvk}>
          <Input name="kvk" defaultValue={org?.kvk ?? ""} inputMode="numeric" maxLength={8} />
        </Field>
        <Field label="Sector" error={errors.sector}>
          <Input name="sector" defaultValue={org?.sector ?? ""} />
        </Field>
        <Field label="Website" error={errors.website}>
          <Input name="website" defaultValue={org?.website ?? ""} placeholder="www.voorbeeld.nl" />
        </Field>
      </div>
      <Field label="Adres" error={errors.address}>
        <Textarea name="address" defaultValue={org?.address ?? ""} rows={2} />
      </Field>
      {users.data && users.data.length > 0 && (
        <Field label="Accountmanager" error={errors.accountManagerId}>
          <Select name="accountManagerId" defaultValue={org?.accountManagerId ?? ""}>
            <option value="">— Geen —</option>
            {users.data.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {!(save.error instanceof ApiError && Object.keys(errors).length) && <ErrorText error={save.error} />}
      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Opslaan…" : "Opslaan"}
        </Button>
      </div>
    </form>
  );
}

export function ContactForm({
  contact,
  organizationId,
  onDone,
}: {
  contact?: Contact;
  /** Vast gekozen klant (vanaf de klantpagina); anders kiesbaar. */
  organizationId?: string;
  onDone: () => void;
}) {
  const save = useSaveContact();
  const remove = useDeleteContact();
  const orgs = useOrganizations({});
  const errors = fieldErrors(save.error);

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        const v = formValues(e);
        save.mutate(
          {
            id: contact?.id,
            data: {
              organizationId: organizationId ?? (v.organizationId || null),
              firstName: v.firstName,
              lastName: v.lastName,
              jobTitle: v.jobTitle,
              email: v.email,
              phone: v.phone,
              linkedin: v.linkedin,
            },
          },
          { onSuccess: onDone },
        );
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Voornaam *" error={errors.firstName}>
          <Input name="firstName" defaultValue={contact?.firstName} required autoFocus />
        </Field>
        <Field label="Achternaam" error={errors.lastName}>
          <Input name="lastName" defaultValue={contact?.lastName ?? ""} />
        </Field>
        <Field label="Functie" error={errors.jobTitle}>
          <Input name="jobTitle" defaultValue={contact?.jobTitle ?? ""} />
        </Field>
        {!organizationId && (
          <Field label="Klant" error={errors.organizationId}>
            <Select key={orgs.data ? "geladen" : "laden"} name="organizationId" defaultValue={contact?.organizationId ?? ""}>
              <option value="">— Geen —</option>
              {orgs.data?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="E-mail" error={errors.email}>
          <Input name="email" type="email" defaultValue={contact?.email ?? ""} />
        </Field>
        <Field label="Telefoon" error={errors.phone}>
          <Input name="phone" type="tel" defaultValue={contact?.phone ?? ""} />
        </Field>
      </div>
      <Field label="LinkedIn" error={errors.linkedin}>
        <Input name="linkedin" defaultValue={contact?.linkedin ?? ""} placeholder="https://www.linkedin.com/in/…" />
      </Field>
      {!(save.error instanceof ApiError && Object.keys(errors).length) && <ErrorText error={save.error} />}
      <ErrorText error={remove.error} />
      {contact && <History entityType="contact" entityId={contact.id} />}
      <div className="flex justify-between gap-2">
        {contact ? (
          <Button
            variant="danger"
            disabled={remove.isPending}
            onClick={() => confirm("Deze contactpersoon verwijderen?") && remove.mutate(contact.id, { onSuccess: onDone })}
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
