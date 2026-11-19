import { z } from "zod";
import type { DealListItem } from "./deals";
import type { ProjectStatus } from "./projects";

// Gedeeld tussen API (validatie) en app (formulieren, labels).

const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullish();

export const ORG_STATUSES = ["prospect", "client", "former"] as const;
export type OrgStatus = (typeof ORG_STATUSES)[number];
export const orgStatusLabel: Record<OrgStatus, string> = {
  prospect: "Prospect",
  client: "Klant",
  former: "Oud-klant",
};

export const ACTIVITY_TYPES = ["note", "call", "email", "meeting"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];
export const activityTypeLabel: Record<ActivityType, string> = {
  note: "Notitie",
  call: "Telefoongesprek",
  email: "E-mail",
  meeting: "Afspraak",
};

const organizationFields = {
  name: z.string().trim().min(1, "Naam is verplicht").max(200),
  kvk: z
    .string()
    .trim()
    .regex(/^(\d{8})?$/, "KvK-nummer bestaat uit 8 cijfers")
    .transform((v) => (v === "" ? null : v))
    .nullish(),
  sector: optionalText(100),
  website: optionalText(300),
  address: optionalText(500),
  status: z.enum(ORG_STATUSES),
  accountManagerId: optionalText(64),
};

export const organizationInput = z.object({
  ...organizationFields,
  status: organizationFields.status.default("prospect"),
});
export type OrganizationInput = z.input<typeof organizationInput>;
// Bij wijzigen géén standaardwaarden: wat niet is meegestuurd, blijft zoals het was.
export const organizationUpdate = z.object(organizationFields).partial();

export const contactInput = z.object({
  organizationId: optionalText(64),
  firstName: z.string().trim().min(1, "Voornaam is verplicht").max(100),
  lastName: optionalText(100),
  jobTitle: optionalText(150),
  email: z
    .string()
    .trim()
    .max(254)
    .refine((v) => v === "" || z.email().safeParse(v).success, "Ongeldig e-mailadres")
    .transform((v) => (v === "" ? null : v.toLowerCase()))
    .nullish(),
  phone: optionalText(50),
  linkedin: optionalText(300),
});
export type ContactInput = z.input<typeof contactInput>;

export const activityInput = z.object({
  type: z.enum(ACTIVITY_TYPES).default("note"),
  body: z.string().trim().min(1, "Tekst is verplicht").max(10_000),
  contactId: optionalText(64),
  occurredAt: z.number().int().positive().optional(),
});
export type ActivityInput = z.input<typeof activityInput>;

// --- Vorm van API-antwoorden ---

export type UserSummary = { id: string; name: string; email: string };

export type Organization = {
  id: string;
  name: string;
  kvk: string | null;
  sector: string | null;
  website: string | null;
  address: string | null;
  status: OrgStatus;
  accountManagerId: string | null;
  createdAt: number;
  updatedAt: number;
};

export type OrganizationListItem = Organization & {
  accountManagerName: string | null;
  contactCount: number;
  lastActivityAt: number | null;
};

export type Contact = {
  id: string;
  organizationId: string | null;
  firstName: string;
  lastName: string | null;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  createdAt: number;
  updatedAt: number;
};

export type ContactListItem = Contact & { organizationName: string | null };

export type Activity = {
  id: string;
  organizationId: string;
  contactId: string | null;
  type: ActivityType;
  body: string;
  occurredAt: number;
  createdBy: string | null;
  createdAt: number;
  contactName: string | null;
  authorName: string | null;
};

export type OrganizationDetail = Organization & {
  accountManagerName: string | null;
  contacts: Contact[];
  activities: Activity[];
  deals: DealListItem[];
  projects: { id: string; name: string; status: ProjectStatus; startDate: string | null; endDate: string | null }[];
};

export function contactName(c: { firstName: string; lastName: string | null }) {
  return [c.firstName, c.lastName].filter(Boolean).join(" ");
}
