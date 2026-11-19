import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { users } from "../db/schema";
import type { AppEnv } from "../types";

export const userRoutes = new Hono<AppEnv>();

// Actieve gebruikers, bijvoorbeeld voor de keuze "accountmanager".
userRoutes.get("/", async (c) => {
  const rows = await getDb(c.env)
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.active, true))
    .orderBy(sql`${users.name} collate nocase`);
  return c.json(rows);
});
