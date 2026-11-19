import { Hono } from "hono";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { activityInput, organizationInput, organizationUpdate, ORG_STATUSES, type OrgStatus } from "../../shared/crm";
import { getDb } from "../db";
import { activities, contacts, deals, organizations, projects, users } from "../db/schema";
import { selectDeals } from "./deals";
import { audit, diff } from "../lib/audit";
import { jsonBody, likePattern } from "../lib/http";
import type { AppEnv } from "../types";

export const organizationRoutes = new Hono<AppEnv>();

async function userExists(db: ReturnType<typeof getDb>, id: string | null | undefined) {
  if (!id) return true;
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, id));
  return Boolean(user);
}

const unknownUser = { error: "Controleer de invoer", fields: { accountManagerId: "Onbekende accountmanager" } };

const listColumns = {
  id: organizations.id,
  name: organizations.name,
  kvk: organizations.kvk,
  sector: organizations.sector,
  website: organizations.website,
  address: organizations.address,
  status: organizations.status,
  accountManagerId: organizations.accountManagerId,
  createdAt: organizations.createdAt,
  updatedAt: organizations.updatedAt,
  accountManagerName: users.name,
};

organizationRoutes.get("/", async (c) => {
  const db = getDb(c.env);
  const q = c.req.query("q")?.trim();
  const status = c.req.query("status");
  const accountManagerId = c.req.query("accountManagerId");

  const where: SQL[] = [];
  if (q) {
    const p = likePattern(q);
    where.push(
      sql`(${organizations.name} like ${p} escape '\\' or ${organizations.sector} like ${p} escape '\\' or ${organizations.kvk} like ${p} escape '\\')`,
    );
  }
  if (status && (ORG_STATUSES as readonly string[]).includes(status)) {
    where.push(eq(organizations.status, status as OrgStatus));
  }
  if (accountManagerId) where.push(eq(organizations.accountManagerId, accountManagerId));

  const rows = await db
    .select({
      ...listColumns,
      contactCount: sql<number>`(select count(*) from ${contacts} where ${contacts.organizationId} = ${organizations.id})`,
      lastActivityAt: sql<number | null>`(select max(${activities.occurredAt}) from ${activities} where ${activities.organizationId} = ${organizations.id})`,
    })
    .from(organizations)
    .leftJoin(users, eq(users.id, organizations.accountManagerId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(sql`${organizations.name} collate nocase`)
    .limit(500);

  return c.json(rows);
});

organizationRoutes.get("/:id", async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");
  const [org] = await db
    .select(listColumns)
    .from(organizations)
    .leftJoin(users, eq(users.id, organizations.accountManagerId))
    .where(eq(organizations.id, id));
  if (!org) return c.json({ error: "Klant niet gevonden" }, 404);

  const [orgContacts, timeline, orgDeals, orgProjects] = await Promise.all([
    db
      .select()
      .from(contacts)
      .where(eq(contacts.organizationId, id))
      .orderBy(sql`${contacts.firstName} collate nocase`, sql`${contacts.lastName} collate nocase`),
    db
      .select({
        id: activities.id,
        organizationId: activities.organizationId,
        contactId: activities.contactId,
        type: activities.type,
        body: activities.body,
        occurredAt: activities.occurredAt,
        createdBy: activities.createdBy,
        createdAt: activities.createdAt,
        contactName: sql<string | null>`trim(${contacts.firstName} || ' ' || coalesce(${contacts.lastName}, ''))`,
        authorName: users.name,
      })
      .from(activities)
      .leftJoin(contacts, eq(contacts.id, activities.contactId))
      .leftJoin(users, eq(users.id, activities.createdBy))
      .where(eq(activities.organizationId, id))
      .orderBy(desc(activities.occurredAt), desc(activities.createdAt))
      .limit(200),
    selectDeals(db).where(eq(deals.organizationId, id)).orderBy(desc(deals.updatedAt)),
    db
      .select({ id: projects.id, name: projects.name, status: projects.status, startDate: projects.startDate, endDate: projects.endDate })
      .from(projects)
      .where(eq(projects.organizationId, id))
      .orderBy(desc(projects.updatedAt)),
  ]);

  return c.json({ ...org, contacts: orgContacts, activities: timeline, deals: orgDeals, projects: orgProjects });
});

organizationRoutes.post("/", jsonBody(organizationInput), async (c) => {
  const db = getDb(c.env);
  const data = c.req.valid("json");
  if (!(await userExists(db, data.accountManagerId))) return c.json(unknownUser, 400);
  const userId = c.get("userId");
  const id = crypto.randomUUID();
  const [[created]] = await db.batch([
    db.insert(organizations).values({ ...data, id, createdBy: userId }).returning(),
    audit(db, { entityType: "organization", entityId: id, action: "create", userId, changes: data }),
  ]);
  return c.json(created, 201);
});

organizationRoutes.patch("/:id", jsonBody(organizationUpdate), async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");
  const data = c.req.valid("json");
  const [before] = await db.select().from(organizations).where(eq(organizations.id, id));
  if (!before) return c.json({ error: "Klant niet gevonden" }, 404);
  if (!(await userExists(db, data.accountManagerId))) return c.json(unknownUser, 400);

  const userId = c.get("userId");
  const [[updated]] = await db.batch([
    db
      .update(organizations)
      .set({ ...data, updatedAt: Date.now() })
      .where(eq(organizations.id, id))
      .returning(),
    audit(db, { entityType: "organization", entityId: id, action: "update", userId, changes: diff(before, data) }),
  ]);
  return c.json(updated);
});

// Let op: zodra er rollen zijn (stap 2), mag alleen de eigenaar verwijderen.
organizationRoutes.delete("/:id", async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");
  const [before] = await db.select().from(organizations).where(eq(organizations.id, id));
  if (!before) return c.json({ error: "Klant niet gevonden" }, 404);
  await db.batch([
    db.delete(organizations).where(eq(organizations.id, id)),
    audit(db, { entityType: "organization", entityId: id, action: "delete", userId: c.get("userId"), changes: before }),
  ]);
  return c.body(null, 204);
});

// --- Tijdlijn ---

organizationRoutes.post("/:id/activities", jsonBody(activityInput), async (c) => {
  const db = getDb(c.env);
  const organizationId = c.req.param("id");
  const data = c.req.valid("json");
  const [org] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, organizationId));
  if (!org) return c.json({ error: "Klant niet gevonden" }, 404);

  if (data.contactId) {
    const [contact] = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(and(eq(contacts.id, data.contactId), eq(contacts.organizationId, organizationId)));
    if (!contact) return c.json({ error: "Controleer de invoer", fields: { contactId: "Onbekende contactpersoon" } }, 400);
  }

  const [created] = await db
    .insert(activities)
    .values({
      organizationId,
      type: data.type,
      body: data.body,
      contactId: data.contactId ?? null,
      occurredAt: data.occurredAt ?? Date.now(),
      createdBy: c.get("userId"),
    })
    .returning();
  return c.json(created, 201);
});

organizationRoutes.delete("/:id/activities/:activityId", async (c) => {
  const db = getDb(c.env);
  const result = await db
    .delete(activities)
    .where(and(eq(activities.id, c.req.param("activityId")), eq(activities.organizationId, c.req.param("id"))))
    .returning({ id: activities.id });
  if (!result.length) return c.json({ error: "Notitie niet gevonden" }, 404);
  return c.body(null, 204);
});
