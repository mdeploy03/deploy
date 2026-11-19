import { Hono } from "hono";
import { and, asc, eq, ne, sql, type SQL } from "drizzle-orm";
import { dealInput, dealMove, dealUpdate, defaultProbability, type DealStage } from "../../shared/deals";
import { getDb, type Db } from "../db";
import { contacts, deals, organizations, projects, users } from "../db/schema";
import { audit, diff } from "../lib/audit";
import { jsonBody, likePattern } from "../lib/http";
import type { AppEnv } from "../types";

export const dealRoutes = new Hono<AppEnv>();

const invalid = (fields: Record<string, string>) => ({ error: "Controleer de invoer", fields });

/** Controleert of klant, contactpersoon (bij die klant) en eigenaar bestaan. */
async function checkRefs(
  db: Db,
  data: { organizationId?: string; contactId?: string | null; ownerId?: string | null },
  current?: { organizationId: string },
) {
  const fields: Record<string, string> = {};
  const orgId = data.organizationId ?? current?.organizationId;
  if (data.organizationId) {
    const [org] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, data.organizationId));
    if (!org) fields.organizationId = "Onbekende klant";
  }
  if (data.contactId && orgId) {
    const [contact] = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(and(eq(contacts.id, data.contactId), eq(contacts.organizationId, orgId)));
    if (!contact) fields.contactId = "Contactpersoon hoort niet bij deze klant";
  }
  if (data.ownerId) {
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, data.ownerId));
    if (!user) fields.ownerId = "Onbekende eigenaar";
  }
  return Object.keys(fields).length ? fields : null;
}

async function nextPosition(db: Db, stage: DealStage, excludeId?: string) {
  const [row] = await db
    .select({ max: sql<number | null>`max(${deals.position})` })
    .from(deals)
    .where(excludeId ? and(eq(deals.stage, stage), ne(deals.id, excludeId)) : eq(deals.stage, stage));
  return (row?.max ?? 0) + 1;
}

/** Fase-afhankelijke velden: standaardkans en reden verloren alleen bij "lost". */
function stageFields(stage: DealStage, probability: number | undefined, lostReason: string | null | undefined) {
  return {
    probability: probability ?? defaultProbability[stage],
    lostReason: stage === "lost" ? (lostReason ?? null) : null,
  };
}

const listColumns = {
  id: deals.id,
  title: deals.title,
  organizationId: deals.organizationId,
  contactId: deals.contactId,
  stage: deals.stage,
  valueCents: deals.valueCents,
  probability: deals.probability,
  expectedCloseDate: deals.expectedCloseDate,
  lostReason: deals.lostReason,
  ownerId: deals.ownerId,
  position: deals.position,
  createdAt: deals.createdAt,
  updatedAt: deals.updatedAt,
  organizationName: organizations.name,
  contactName: sql<string | null>`case when ${contacts.id} is null then null else trim(${contacts.firstName} || ' ' || coalesce(${contacts.lastName}, '')) end`,
  ownerName: users.name,
  projectId: sql<string | null>`(select ${projects.id} from ${projects} where ${projects.dealId} = ${deals.id} limit 1)`,
};

export function selectDeals(db: Db) {
  return db
    .select(listColumns)
    .from(deals)
    .innerJoin(organizations, eq(organizations.id, deals.organizationId))
    .leftJoin(contacts, eq(contacts.id, deals.contactId))
    .leftJoin(users, eq(users.id, deals.ownerId));
}

dealRoutes.get("/", async (c) => {
  const db = getDb(c.env);
  const q = c.req.query("q")?.trim();
  const where: SQL[] = [];
  if (q) {
    const p = likePattern(q);
    where.push(sql`(${deals.title} like ${p} escape '\\' or ${organizations.name} like ${p} escape '\\')`);
  }
  const organizationId = c.req.query("organizationId");
  if (organizationId) where.push(eq(deals.organizationId, organizationId));
  const ownerId = c.req.query("ownerId");
  if (ownerId) where.push(eq(deals.ownerId, ownerId));

  const rows = await selectDeals(db)
    .where(where.length ? and(...where) : undefined)
    .orderBy(asc(deals.stage), asc(deals.position))
    .limit(1000);
  return c.json(rows);
});

dealRoutes.get("/:id", async (c) => {
  const [deal] = await selectDeals(getDb(c.env)).where(eq(deals.id, c.req.param("id")));
  if (!deal) return c.json({ error: "Kans niet gevonden" }, 404);
  return c.json(deal);
});

dealRoutes.post("/", jsonBody(dealInput), async (c) => {
  const db = getDb(c.env);
  const data = c.req.valid("json");
  const refErrors = await checkRefs(db, data);
  if (refErrors) return c.json(invalid(refErrors), 400);

  const userId = c.get("userId");
  const id = crypto.randomUUID();
  const values = {
    ...data,
    ...stageFields(data.stage, data.probability, data.lostReason),
    id,
    position: await nextPosition(db, data.stage),
    createdBy: userId,
  };
  const [[created]] = await db.batch([
    db.insert(deals).values(values).returning(),
    audit(db, { entityType: "deal", entityId: id, action: "create", userId, changes: data }),
  ]);
  return c.json(created, 201);
});

dealRoutes.patch("/:id", jsonBody(dealUpdate), async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");
  const data = c.req.valid("json");
  const [before] = await db.select().from(deals).where(eq(deals.id, id));
  if (!before) return c.json({ error: "Kans niet gevonden" }, 404);
  const refErrors = await checkRefs(db, data, before);
  if (refErrors) return c.json(invalid(refErrors), 400);

  const stage = data.stage ?? before.stage;
  const stageChanged = stage !== before.stage;
  const changes = {
    ...data,
    ...(stageChanged || data.lostReason !== undefined || data.probability !== undefined
      ? stageFields(stage, data.probability ?? (stageChanged ? undefined : before.probability), data.lostReason ?? before.lostReason)
      : {}),
    ...(stageChanged ? { position: await nextPosition(db, stage, id) } : {}),
    // Andere klant: contactpersoon van de oude klant loskoppelen.
    ...(data.organizationId && data.organizationId !== before.organizationId && data.contactId === undefined ? { contactId: null } : {}),
  };
  const userId = c.get("userId");
  const [[updated]] = await db.batch([
    db.update(deals).set({ ...changes, updatedAt: Date.now() }).where(eq(deals.id, id)).returning(),
    audit(db, { entityType: "deal", entityId: id, action: "update", userId, changes: diff(before, changes) }),
  ]);
  return c.json(updated);
});

// Slepen op het bord: naar een fase, optioneel vóór een andere kaart.
dealRoutes.post("/:id/move", jsonBody(dealMove), async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");
  const { stage, beforeId, lostReason } = c.req.valid("json");
  const [before] = await db.select().from(deals).where(eq(deals.id, id));
  if (!before) return c.json({ error: "Kans niet gevonden" }, 404);

  let position: number;
  if (beforeId) {
    const column = await db
      .select({ id: deals.id, position: deals.position })
      .from(deals)
      .where(and(eq(deals.stage, stage), ne(deals.id, id)))
      .orderBy(asc(deals.position));
    const index = column.findIndex((d) => d.id === beforeId);
    if (index === -1) return c.json(invalid({ beforeId: "Kaart niet gevonden in deze fase" }), 400);
    const next = column[index].position;
    position = index === 0 ? next - 1 : (column[index - 1].position + next) / 2;
  } else {
    position = await nextPosition(db, stage, id);
  }

  const stageChanged = stage !== before.stage;
  const changes = {
    stage,
    position,
    ...(stageChanged || lostReason !== undefined
      ? stageFields(stage, stageChanged ? undefined : before.probability, lostReason ?? (stageChanged ? null : before.lostReason))
      : {}),
  };
  const userId = c.get("userId");
  const statements = [db.update(deals).set({ ...changes, updatedAt: Date.now() }).where(eq(deals.id, id)).returning()] as const;
  const [[updated]] = stageChanged
    ? await db.batch([
        ...statements,
        audit(db, { entityType: "deal", entityId: id, action: "update", userId, changes: diff(before, changes) }),
      ])
    : await db.batch(statements);
  return c.json(updated);
});

dealRoutes.delete("/:id", async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");
  const [before] = await db.select().from(deals).where(eq(deals.id, id));
  if (!before) return c.json({ error: "Kans niet gevonden" }, 404);
  await db.batch([
    db.delete(deals).where(eq(deals.id, id)),
    audit(db, { entityType: "deal", entityId: id, action: "delete", userId: c.get("userId"), changes: before }),
  ]);
  return c.body(null, 204);
});

// Gewonnen kans → project (één project per kans).
dealRoutes.post("/:id/project", async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");
  const [deal] = await db.select().from(deals).where(eq(deals.id, id));
  if (!deal) return c.json({ error: "Kans niet gevonden" }, 404);
  if (deal.stage !== "won") return c.json({ error: "Alleen van een gewonnen kans kun je een project maken" }, 400);

  const [existing] = await db.select({ id: projects.id }).from(projects).where(eq(projects.dealId, id));
  if (existing) return c.json({ error: "Deze kans heeft al een project", projectId: existing.id }, 409);

  const userId = c.get("userId");
  const projectId = crypto.randomUUID();
  const [[project]] = await db.batch([
    db
      .insert(projects)
      .values({
        id: projectId,
        name: deal.title,
        organizationId: deal.organizationId,
        dealId: deal.id,
        status: "planned",
        leadId: deal.ownerId,
        createdBy: userId,
      })
      .returning(),
    audit(db, { entityType: "project", entityId: projectId, action: "create", userId, changes: { fromDeal: deal.id } }),
  ]);
  return c.json(project, 201);
});
