import type { ActivityType } from "./crm";
import type { DealStage } from "./deals";
import type { ProjectStatus, TaskPriority, TaskStatus } from "./projects";

export type Dashboard = {
  pipeline: {
    openCount: number;
    openValueCents: number;
    weightedValueCents: number;
    byStage: { stage: DealStage; count: number; valueCents: number }[];
    wonThisQuarter: { count: number; valueCents: number };
    /** Open kansen met een sluitdatum in het verleden of binnen 14 dagen. */
    closingSoon: { id: string; title: string; organizationName: string; valueCents: number; expectedCloseDate: string; stage: DealStage }[];
  };
  projects: {
    activeCount: number;
    active: { id: string; name: string; organizationName: string; status: ProjectStatus; endDate: string | null; taskCount: number; doneCount: number; overdueCount: number }[];
  };
  tasks: {
    overdueCount: number;
    /** Open taken met een deadline t/m komende zondag (inclusief te laat). */
    dueThisWeek: { id: string; title: string; dueDate: string; priority: TaskPriority; status: TaskStatus; projectId: string; projectName: string; assigneeName: string | null }[];
  };
  recentActivities: { id: string; type: ActivityType; body: string; occurredAt: number; organizationId: string; organizationName: string }[];
};

export type AuditEntry = {
  id: string;
  entityType: string;
  entityId: string;
  action: "create" | "update" | "delete";
  changes: unknown;
  userName: string | null;
  createdAt: number;
};

/** Leesbare namen voor velden in de geschiedenis. */
export const fieldLabel: Record<string, string> = {
  name: "naam",
  title: "titel",
  kvk: "KvK-nummer",
  sector: "sector",
  website: "website",
  address: "adres",
  status: "status",
  stage: "fase",
  accountManagerId: "accountmanager",
  organizationId: "klant",
  contactId: "contactpersoon",
  valueCents: "waarde",
  probability: "slagingskans",
  expectedCloseDate: "sluitdatum",
  lostReason: "reden verloren",
  ownerId: "eigenaar",
  position: "volgorde",
  startDate: "startdatum",
  endDate: "einddatum",
  leadId: "projectleider",
  description: "omschrijving",
  firstName: "voornaam",
  lastName: "achternaam",
  jobTitle: "functie",
  email: "e-mail",
  phone: "telefoon",
  linkedin: "LinkedIn",
};
