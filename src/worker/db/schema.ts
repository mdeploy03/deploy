import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real, index, primaryKey } from "drizzle-orm/sqlite-core";

// Gemeenschappelijke kolommen: tijden in milliseconden sinds epoch.
const timestamps = {
  createdAt: integer("created_at").notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at").notNull().default(sql`(unixepoch() * 1000)`),
};
const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const createdBy = () => text("created_by").references(() => users.id);

export const users = sqliteTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role", { enum: ["owner", "member"] }).notNull().default("member"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(), // hash van het sessietoken
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at").notNull(),
    createdAt: timestamps.createdAt,
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const organizations = sqliteTable(
  "organizations",
  {
    id: id(),
    name: text("name").notNull(),
    kvk: text("kvk"),
    sector: text("sector"),
    website: text("website"),
    address: text("address"),
    status: text("status", { enum: ["prospect", "client", "former"] }).notNull().default("prospect"),
    accountManagerId: text("account_manager_id").references(() => users.id),
    createdBy: createdBy(),
    ...timestamps,
  },
  (t) => [index("organizations_name_idx").on(t.name)],
);

export const contacts = sqliteTable(
  "contacts",
  {
    id: id(),
    organizationId: text("organization_id").references(() => organizations.id, { onDelete: "set null" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name"),
    jobTitle: text("job_title"),
    email: text("email"),
    phone: text("phone"),
    linkedin: text("linkedin"),
    createdBy: createdBy(),
    ...timestamps,
  },
  (t) => [index("contacts_org_idx").on(t.organizationId)],
);

// Notities en contactmomenten op de tijdlijn van een organisatie.
export const activities = sqliteTable(
  "activities",
  {
    id: id(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    contactId: text("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    dealId: text("deal_id").references(() => deals.id, { onDelete: "set null" }),
    type: text("type", { enum: ["note", "call", "email", "meeting"] }).notNull().default("note"),
    body: text("body").notNull(),
    occurredAt: integer("occurred_at").notNull(),
    createdBy: createdBy(),
    ...timestamps,
  },
  (t) => [index("activities_org_idx").on(t.organizationId, t.occurredAt)],
);

export const deals = sqliteTable(
  "deals",
  {
    id: id(),
    title: text("title").notNull(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    contactId: text("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    stage: text("stage", {
      enum: ["lead", "qualified", "proposal", "negotiation", "won", "lost"],
    })
      .notNull()
      .default("lead"),
    valueCents: integer("value_cents").notNull().default(0),
    probability: real("probability").notNull().default(0.1),
    expectedCloseDate: text("expected_close_date"), // YYYY-MM-DD
    lostReason: text("lost_reason"),
    ownerId: text("owner_id").references(() => users.id),
    position: real("position").notNull().default(0), // volgorde binnen een fase op het bord
    createdBy: createdBy(),
    ...timestamps,
  },
  (t) => [index("deals_stage_idx").on(t.stage, t.position), index("deals_org_idx").on(t.organizationId)],
);

export const projects = sqliteTable(
  "projects",
  {
    id: id(),
    name: text("name").notNull(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    dealId: text("deal_id").references(() => deals.id, { onDelete: "set null" }),
    status: text("status", { enum: ["planned", "active", "on_hold", "done"] }).notNull().default("planned"),
    startDate: text("start_date"),
    endDate: text("end_date"),
    leadId: text("lead_id").references(() => users.id),
    description: text("description"),
    createdBy: createdBy(),
    ...timestamps,
  },
  (t) => [index("projects_org_idx").on(t.organizationId), index("projects_status_idx").on(t.status)],
);

export const projectMembers = sqliteTable(
  "project_members",
  {
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.userId] })],
);

export const tasks = sqliteTable(
  "tasks",
  {
    id: id(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    assigneeId: text("assignee_id").references(() => users.id),
    dueDate: text("due_date"),
    priority: text("priority", { enum: ["low", "normal", "high"] }).notNull().default("normal"),
    status: text("status", { enum: ["todo", "doing", "done"] }).notNull().default("todo"),
    position: real("position").notNull().default(0),
    createdBy: createdBy(),
    ...timestamps,
  },
  (t) => [
    index("tasks_project_idx").on(t.projectId, t.status, t.position),
    index("tasks_assignee_idx").on(t.assigneeId, t.dueDate),
  ],
);

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: id(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action", { enum: ["create", "update", "delete"] }).notNull(),
    changes: text("changes", { mode: "json" }),
    userId: text("user_id").references(() => users.id),
    createdAt: timestamps.createdAt,
  },
  (t) => [index("audit_entity_idx").on(t.entityType, t.entityId, t.createdAt)],
);
