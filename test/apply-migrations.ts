import { beforeEach } from "vitest";
import { applyD1Migrations, env, type D1Migration } from "cloudflare:test";

declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

// Elke test begint met een lege database (kindtabellen eerst).
const TABLES = [
  "audit_log",
  "tasks",
  "project_members",
  "projects",
  "activities",
  "deals",
  "contacts",
  "organizations",
  "sessions",
  "users",
];

beforeEach(async () => {
  await env.DB.batch(TABLES.map((t) => env.DB.prepare(`delete from ${t}`)));
});
