import { Hono } from "hono";
import { and, asc, desc, eq, inArray, isNotNull, lte, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { OPEN_STAGES } from "../../shared/deals";
import { getDb } from "../db";
import { activities, auditLog, deals, organizations, projects, tasks, users } from "../db/schema";
import { addDays, endOfWeek, nlDate, quarterStartMs } from "../lib/dates";
import type { AppEnv } from "../types";

export const dashboardRoutes = new Hono<AppEnv>();
export const auditRoutes = new Hono<AppEnv>();

dashboardRoutes.get("/", async (c) => {
  const db = getDb(c.env);
  const today = nlDate();
  const weekEnd = endOfWeek(today);
  const soon = addDays(today, 14);
  const openStages = [...OPEN_STAGES];
  const assignee = alias(users, "assignee");

  // Gewonnen dit kwartaal: op basis van het logboek (moment van winnen), alleen kansen die nu nog gewonnen zijn.
  const wonAt = sql`(${auditLog.action} = 'update' and json_extract(${auditLog.changes}, '$.stage.to') = 'won')
    or (${auditLog.action} = 'create' and json_extract(${auditLog.changes}, '$.stage') = 'won')`;

  const [byStage, wonThisQuarter, closingSoon, activeProjects, overdue, dueThisWeek, recentActivities] = await Promise.all([
    db
      .select({
        stage: deals.stage,
        count: sql<number>`count(*)`,
        valueCents: sql<number>`coalesce(sum(${deals.valueCents}), 0)`,
        weightedCents: sql<number>`coalesce(sum(${deals.valueCents} * ${deals.probability}), 0)`,
      })
      .from(deals)
      .groupBy(deals.stage),
    db
      .select({ count: sql<number>`count(*)`, valueCents: sql<number>`coalesce(sum(${deals.valueCents}), 0)` })
      .from(deals)
      .where(
        and(
          eq(deals.stage, "won"),
          sql`exists (select 1 from ${auditLog} where ${auditLog.entityType} = 'deal' and ${auditLog.entityId} = ${deals.id}
            and ${auditLog.createdAt} >= ${quarterStartMs(today)} and (${wonAt}))`,
        ),
      ),
    db
      .select({
        id: deals.id,
        title: deals.title,
        organizationName: organizations.name,
        valueCents: deals.valueCents,
        expectedCloseDate: sql<string>`${deals.expectedCloseDate}`,
        stage: deals.stage,
      })
      .from(deals)
      .innerJoin(organizations, eq(organizations.id, deals.organizationId))
      .where(and(inArray(deals.stage, openStages), isNotNull(deals.expectedCloseDate), lte(deals.expectedCloseDate, soon)))
      .orderBy(asc(deals.expectedCloseDate))
      .limit(10),
    db
      .select({
        id: projects.id,
        name: projects.name,
        organizationName: organizations.name,
        status: projects.status,
        endDate: projects.endDate,
        taskCount: sql<number>`(select count(*) from ${tasks} where ${tasks.projectId} = ${projects.id})`,
        doneCount: sql<number>`(select count(*) from ${tasks} where ${tasks.projectId} = ${projects.id} and ${tasks.status} = 'done')`,
        overdueCount: sql<number>`(select count(*) from ${tasks} where ${tasks.projectId} = ${projects.id} and ${tasks.status} != 'done' and ${tasks.dueDate} < ${today})`,
      })
      .from(projects)
      .innerJoin(organizations, eq(organizations.id, projects.organizationId))
      .where(eq(projects.status, "active"))
      .orderBy(sql`${projects.endDate} is null`, asc(projects.endDate)),
    db
      .select({ n: sql<number>`count(*)` })
      .from(tasks)
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .where(and(ne(tasks.status, "done"), ne(projects.status, "done"), sql`${tasks.dueDate} < ${today}`)),
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        dueDate: sql<string>`${tasks.dueDate}`,
        priority: tasks.priority,
        status: tasks.status,
        projectId: tasks.projectId,
        projectName: projects.name,
        assigneeName: assignee.name,
      })
      .from(tasks)
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .leftJoin(assignee, eq(assignee.id, tasks.assigneeId))
      .where(and(ne(tasks.status, "done"), ne(projects.status, "done"), isNotNull(tasks.dueDate), lte(tasks.dueDate, weekEnd)))
      .orderBy(asc(tasks.dueDate), desc(sql`${tasks.priority} = 'high'`))
      .limit(15),
    db
      .select({
        id: activities.id,
        type: activities.type,
        body: activities.body,
        occurredAt: activities.occurredAt,
        organizationId: activities.organizationId,
        organizationName: organizations.name,
      })
      .from(activities)
      .innerJoin(organizations, eq(organizations.id, activities.organizationId))
      .orderBy(desc(activities.occurredAt))
      .limit(8),
  ]);

  const open = byStage.filter((s) => (openStages as string[]).includes(s.stage));
  return c.json({
    pipeline: {
      openCount: open.reduce((n, s) => n + s.count, 0),
      openValueCents: open.reduce((n, s) => n + s.valueCents, 0),
      weightedValueCents: Math.round(open.reduce((n, s) => n + s.weightedCents, 0)),
      byStage: byStage.map(({ stage, count, valueCents }) => ({ stage, count, valueCents })),
      wonThisQuarter: wonThisQuarter[0] ?? { count: 0, valueCents: 0 },
      closingSoon,
    },
    projects: { activeCount: activeProjects.length, active: activeProjects.slice(0, 8) },
    tasks: { overdueCount: overdue[0]?.n ?? 0, dueThisWeek },
    recentActivities,
  });
});

// Geschiedenis van één klant, kans, contactpersoon of project.
auditRoutes.get("/", async (c) => {
  const entityType = c.req.query("entityType");
  const entityId = c.req.query("entityId");
  if (!entityType || !entityId) return c.json({ error: "entityType en entityId zijn verplicht" }, 400);
  const db = getDb(c.env);
  const rows = await db
    .select({
      id: auditLog.id,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      action: auditLog.action,
      changes: auditLog.changes,
      userName: users.name,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.userId))
    .where(and(eq(auditLog.entityType, entityType), eq(auditLog.entityId, entityId)))
    .orderBy(desc(auditLog.createdAt), desc(sql`"audit_log".rowid`))
    .limit(100);
  return c.json(rows);
});
