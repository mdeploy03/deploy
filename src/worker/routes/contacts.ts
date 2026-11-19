import { Hono } from "hono";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { contactInput } from "../../shared/crm";
import { getDb } from "../db";
import { contacts, organizations } from "../db/schema";
import { audit, diff } from "../lib/audit";
import { jsonBody, likePattern } from "../lib/http";
import type { AppEnv } from "../types";

export const contactRoutes = new Hono<AppEnv>();

async function organizationExists(db: ReturnType<typeof getDb>, id: string | null | undefined) {
  if (!id) return true;
  const [org] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, id));
  return Boolean(org);
}

const unknownOrg = { error: "Controleer de invoer", fields: { organizationId: "Onbekende klant" } };

contactRoutes.get("/", async (c) => {
  const db = getDb(c.env);
  const q = c.req.query("q")?.trim();
  const organizationId = c.req.query("organizationId");

  const where: SQL[] = [];
  if (q) {
    const p = likePattern(q);
    where.push(
      sql`(${contacts.firstName} || ' ' || coalesce(${contacts.lastName}, '') like ${p} escape '\\' or ${contacts.email} like ${p} escape '\\' or ${contacts.jobTitle} like ${p} escape '\\' or ${organizations.name} like ${p} escape '\\')`,
    );
  }
  if (organizationId) where.push(eq(contacts.organizationId, organizationId));

  const rows = await db
    .select({
      id: contacts.id,
      organizationId: contacts.organizationId,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      jobTitle: contacts.jobTitle,
      email: contacts.email,
      phone: contacts.phone,
      linkedin: contacts.linkedin,
      createdAt: contacts.createdAt,
      updatedAt: contacts.updatedAt,
      organizationName: organizations.name,
    })
    .from(contacts)
    .leftJoin(organizations, eq(organizations.id, contacts.organizationId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(sql`${contacts.firstName} collate nocase`, sql`${contacts.lastName} collate nocase`)
    .limit(500);
  return c.json(rows);
});

contactRoutes.post("/", jsonBody(contactInput), async (c) => {
  const db = getDb(c.env);
  const data = c.req.valid("json");
  if (!(await organizationExists(db, data.organizationId))) return c.json(unknownOrg, 400);
  const userId = c.get("userId");
  const id = crypto.randomUUID();
  const [[created]] = await db.batch([
    db.insert(contacts).values({ ...data, id, createdBy: userId }).returning(),
    audit(db, { entityType: "contact", entityId: id, action: "create", userId, changes: data }),
  ]);
  return c.json(created, 201);
});

contactRoutes.patch("/:id", jsonBody(contactInput.partial()), async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");
  const data = c.req.valid("json");
  const [before] = await db.select().from(contacts).where(eq(contacts.id, id));
  if (!before) return c.json({ error: "Contactpersoon niet gevonden" }, 404);
  if (!(await organizationExists(db, data.organizationId))) return c.json(unknownOrg, 400);

  const userId = c.get("userId");
  const [[updated]] = await db.batch([
    db.update(contacts).set({ ...data, updatedAt: Date.now() }).where(eq(contacts.id, id)).returning(),
    audit(db, { entityType: "contact", entityId: id, action: "update", userId, changes: diff(before, data) }),
  ]);
  return c.json(updated);
});

contactRoutes.delete("/:id", async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");
  const [before] = await db.select().from(contacts).where(eq(contacts.id, id));
  if (!before) return c.json({ error: "Contactpersoon niet gevonden" }, 404);
  await db.batch([
    db.delete(contacts).where(eq(contacts.id, id)),
    audit(db, { entityType: "contact", entityId: id, action: "delete", userId: c.get("userId"), changes: before }),
  ]);
  return c.body(null, 204);
});
