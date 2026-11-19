import { Hono } from "hono";
import { and, asc, desc, eq, inArray, ne, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import {
  PROJECT_STATUSES,
  projectInput,
  projectMembersInput,
  projectUpdate,
  taskInput,
  taskMove,
  taskUpdate,
  type ProjectStatus,
  type TaskStatus,
} from "../../shared/projects";
import { getDb, type Db } from "../db";
import { deals, organizations, projectMembers, projects, tasks, users } from "../db/schema";
import { audit, diff } from "../lib/audit";
import { jsonBody, likePattern } from "../lib/http";
import { positionBefore } from "../lib/position";
import { nlDate as today } from "../lib/dates";
import type { AppEnv } from "../types";

export const projectRoutes = new Hono<AppEnv>();
export const taskRoutes = new Hono<AppEnv>();

const invalid = (fields: Record<string, string>) => ({ error: "Controleer de invoer", fields });

async function missingRefs(db: Db, data: { organizationId?: string; leadId?: string | null; assigneeId?: string | null }) {
  const fields: Record<string, string> = {};
  if (data.organizationId) {
    const [org] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, data.organizationId));
    if (!org) fields.organizationId = "Onbekende klant";
  }
  for (const key of ["leadId", "assigneeId"] as const) {
    const userId = data[key];
    if (!userId) continue;
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId));
    if (!user) fields[key] = "Onbekende gebruiker";
  }
  return Object.keys(fields).length ? fields : null;
}

const lead = alias(users, "lead");

function selectProjects(db: Db) {
  return db
    .select({
      id: projects.id,
      name: projects.name,
      organizationId: projects.organizationId,
      dealId: projects.dealId,
      status: projects.status,
      startDate: projects.startDate,
      endDate: projects.endDate,
      leadId: projects.leadId,
      description: projects.description,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      organizationName: organizations.name,
      leadName: lead.name,
      taskCount: sql<number>`(select count(*) from ${tasks} where ${tasks.projectId} = ${projects.id})`,
      doneCount: sql<number>`(select count(*) from ${tasks} where ${tasks.projectId} = ${projects.id} and ${tasks.status} = 'done')`,
      overdueCount: sql<number>`(select count(*) from ${tasks} where ${tasks.projectId} = ${projects.id} and ${tasks.status} != 'done' and ${tasks.dueDate} < ${today()})`,
    })
    .from(projects)
    .innerJoin(organizations, eq(organizations.id, projects.organizationId))
    .leftJoin(lead, eq(lead.id, projects.leadId));
}

const assignee = alias(users, "assignee");

export function selectTasks(db: Db) {
  return db
    .select({
      id: tasks.id,
      projectId: tasks.projectId,
      title: tasks.title,
      description: tasks.description,
      assigneeId: tasks.assigneeId,
      dueDate: tasks.dueDate,
      priority: tasks.priority,
      status: tasks.status,
      position: tasks.position,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
      assigneeName: assignee.name,
      projectName: projects.name,
      organizationId: projects.organizationId,
      organizationName: organizations.name,
    })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .innerJoin(organizations, eq(organizations.id, projects.organizationId))
    .leftJoin(assignee, eq(assignee.id, tasks.assigneeId));
}

// --- Projecten ---

projectRoutes.get("/", async (c) => {
  const db = getDb(c.env);
  const where: SQL[] = [];
  const q = c.req.query("q")?.trim();
  if (q) {
    const p = likePattern(q);
    where.push(sql`(${projects.name} like ${p} escape '\\' or ${organizations.name} like ${p} escape '\\')`);
  }
  const status = c.req.query("status");
  if (status && (PROJECT_STATUSES as readonly string[]).includes(status)) where.push(eq(projects.status, status as ProjectStatus));
  const organizationId = c.req.query("organizationId");
  if (organizationId) where.push(eq(projects.organizationId, organizationId));

  const rows = await selectProjects(db)
    .where(where.length ? and(...where) : undefined)
    .orderBy(
      sql`case ${projects.status} when 'active' then 0 when 'planned' then 1 when 'on_hold' then 2 else 3 end`,
      sql`${projects.name} collate nocase`,
    )
    .limit(500);
  return c.json(rows);
});

projectRoutes.get("/:id", async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");
  const [project] = await selectProjects(db).where(eq(projects.id, id));
  if (!project) return c.json({ error: "Project niet gevonden" }, 404);

  const [deal, members, projectTasks] = await Promise.all([
    project.dealId ? db.select({ title: deals.title }).from(deals).where(eq(deals.id, project.dealId)) : Promise.resolve([]),
    db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(projectMembers)
      .innerJoin(users, eq(users.id, projectMembers.userId))
      .where(eq(projectMembers.projectId, id))
      .orderBy(sql`${users.name} collate nocase`),
    selectTasks(db).where(eq(tasks.projectId, id)).orderBy(asc(tasks.position)),
  ]);
  return c.json({ ...project, dealTitle: deal[0]?.title ?? null, members, tasks: projectTasks });
});

projectRoutes.post("/", jsonBody(projectInput), async (c) => {
  const db = getDb(c.env);
  const data = c.req.valid("json");
  const refErrors = await missingRefs(db, data);
  if (refErrors) return c.json(invalid(refErrors), 400);
  const userId = c.get("userId");
  const id = crypto.randomUUID();
  const [[created]] = await db.batch([
    db.insert(projects).values({ ...data, id, createdBy: userId }).returning(),
    audit(db, { entityType: "project", entityId: id, action: "create", userId, changes: data }),
  ]);
  return c.json(created, 201);
});

projectRoutes.patch("/:id", jsonBody(projectUpdate), async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");
  const data = c.req.valid("json");
  const [before] = await db.select().from(projects).where(eq(projects.id, id));
  if (!before) return c.json({ error: "Project niet gevonden" }, 404);
  const refErrors = await missingRefs(db, data);
  if (refErrors) return c.json(invalid(refErrors), 400);
  const start = data.startDate !== undefined ? data.startDate : before.startDate;
  const end = data.endDate !== undefined ? data.endDate : before.endDate;
  if (start && end && end < start) return c.json(invalid({ endDate: "Einddatum ligt vóór de startdatum" }), 400);

  const userId = c.get("userId");
  const [[updated]] = await db.batch([
    db.update(projects).set({ ...data, updatedAt: Date.now() }).where(eq(projects.id, id)).returning(),
    audit(db, { entityType: "project", entityId: id, action: "update", userId, changes: diff(before, data) }),
  ]);
  return c.json(updated);
});

projectRoutes.delete("/:id", async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");
  const [before] = await db.select().from(projects).where(eq(projects.id, id));
  if (!before) return c.json({ error: "Project niet gevonden" }, 404);
  await db.batch([
    db.delete(projects).where(eq(projects.id, id)),
    audit(db, { entityType: "project", entityId: id, action: "delete", userId: c.get("userId"), changes: before }),
  ]);
  return c.body(null, 204);
});

projectRoutes.put("/:id/members", jsonBody(projectMembersInput), async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");
  const userIds = [...new Set(c.req.valid("json").userIds)];
  const [project] = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, id));
  if (!project) return c.json({ error: "Project niet gevonden" }, 404);
  if (userIds.length) {
    const found = await db.select({ id: users.id }).from(users).where(inArray(users.id, userIds));
    if (found.length !== userIds.length) return c.json(invalid({ userIds: "Onbekende gebruiker" }), 400);
  }
  await db.batch([
    db.delete(projectMembers).where(eq(projectMembers.projectId, id)),
    ...userIds.map((userId) => db.insert(projectMembers).values({ projectId: id, userId })),
  ]);
  return c.body(null, 204);
});

// --- Taken binnen een project ---

async function nextTaskPosition(db: Db, projectId: string, status: TaskStatus, excludeId?: string) {
  const conds = [eq(tasks.projectId, projectId), eq(tasks.status, status)];
  if (excludeId) conds.push(ne(tasks.id, excludeId));
  const [row] = await db.select({ max: sql<number | null>`max(${tasks.position})` }).from(tasks).where(and(...conds));
  return (row?.max ?? 0) + 1;
}

projectRoutes.post("/:id/tasks", jsonBody(taskInput), async (c) => {
  const db = getDb(c.env);
  const projectId = c.req.param("id");
  const data = c.req.valid("json");
  const [project] = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, projectId));
  if (!project) return c.json({ error: "Project niet gevonden" }, 404);
  const refErrors = await missingRefs(db, data);
  if (refErrors) return c.json(invalid(refErrors), 400);

  const [created] = await db
    .insert(tasks)
    .values({
      ...data,
      projectId,
      position: await nextTaskPosition(db, projectId, data.status),
      createdBy: c.get("userId"),
    })
    .returning();
  return c.json(created, 201);
});

// --- Taken los (wijzigen, verplaatsen, verwijderen, "mijn werk") ---

taskRoutes.get("/", async (c) => {
  const db = getDb(c.env);
  const where: SQL[] = [];
  const assigneeId = c.req.query("assigneeId");
  if (assigneeId === "none") where.push(sql`${tasks.assigneeId} is null`);
  else if (assigneeId) where.push(eq(tasks.assigneeId, assigneeId));
  if (c.req.query("open") === "1") where.push(ne(tasks.status, "done"));
  // Taken van afgeronde projecten horen niet in "mijn werk".
  if (c.req.query("activeProjects") === "1") where.push(ne(projects.status, "done"));

  const rows = await selectTasks(db)
    .where(where.length ? and(...where) : undefined)
    .orderBy(sql`${tasks.dueDate} is null`, asc(tasks.dueDate), desc(sql`${tasks.priority} = 'high'`), asc(tasks.createdAt))
    .limit(500);
  return c.json(rows);
});

taskRoutes.patch("/:id", jsonBody(taskUpdate), async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");
  const data = c.req.valid("json");
  const [before] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!before) return c.json({ error: "Taak niet gevonden" }, 404);
  const refErrors = await missingRefs(db, data);
  if (refErrors) return c.json(invalid(refErrors), 400);

  const statusChanged = data.status !== undefined && data.status !== before.status;
  const [updated] = await db
    .update(tasks)
    .set({
      ...data,
      ...(statusChanged ? { position: await nextTaskPosition(db, before.projectId, data.status!, id) } : {}),
      updatedAt: Date.now(),
    })
    .where(eq(tasks.id, id))
    .returning();
  return c.json(updated);
});

taskRoutes.post("/:id/move", jsonBody(taskMove), async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");
  const { status, beforeId } = c.req.valid("json");
  const [before] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!before) return c.json({ error: "Taak niet gevonden" }, 404);

  const column = await db
    .select({ id: tasks.id, position: tasks.position })
    .from(tasks)
    .where(and(eq(tasks.projectId, before.projectId), eq(tasks.status, status), ne(tasks.id, id)))
    .orderBy(asc(tasks.position));
  const position = positionBefore(column, beforeId);
  if (position === null) return c.json(invalid({ beforeId: "Taak niet gevonden in deze kolom" }), 400);

  const [updated] = await db.update(tasks).set({ status, position, updatedAt: Date.now() }).where(eq(tasks.id, id)).returning();
  return c.json(updated);
});

taskRoutes.delete("/:id", async (c) => {
  const db = getDb(c.env);
  const result = await db.delete(tasks).where(eq(tasks.id, c.req.param("id"))).returning({ id: tasks.id });
  if (!result.length) return c.json({ error: "Taak niet gevonden" }, 404);
  return c.body(null, 204);
});
