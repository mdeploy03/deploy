import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import app from "../src/worker/index";

const ctx = { waitUntil() {}, passThroughOnException() {}, props: {} } as unknown as ExecutionContext;

function call(path: string, overrides: Record<string, unknown> = {}, init?: RequestInit) {
  return app.fetch(new Request(`https://werkruimte.test${path}`, init), { ...env, ...overrides }, ctx);
}

describe("health", () => {
  it("meldt dat de database bereikbaar is", async () => {
    const res = await call("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, db: true, environment: "local" });
  });

  it("alle tabellen uit de migratie bestaan", async () => {
    const { results } = await env.DB.prepare(
      "select name from sqlite_master where type = 'table' and name not like '\\_%' escape '\\' and name not like 'd1_%' and name not like 'sqlite_%' order by name",
    ).all<{ name: string }>();
    expect(results.map((r) => r.name)).toEqual([
      "activities",
      "audit_log",
      "contacts",
      "deals",
      "organizations",
      "project_members",
      "projects",
      "sessions",
      "tasks",
      "users",
    ]);
  });

  it("onbekende API-route geeft 404 JSON", async () => {
    const res = await call("/api/bestaat-niet");
    expect(res.status).toBe(404);
  });
});

describe("tijdelijke afscherming", () => {
  it("weigert staging zonder ingesteld wachtwoord", async () => {
    const res = await call("/api/health", { ENVIRONMENT: "staging", BASIC_AUTH_PASSWORD: undefined });
    expect(res.status).toBe(503);
  });

  it("vraagt om inloggen zonder of met verkeerde gegevens", async () => {
    const res = await call("/api/health", { ENVIRONMENT: "staging", BASIC_AUTH_PASSWORD: "geheim" });
    expect(res.status).toBe(401);
    const wrong = await call(
      "/api/health",
      { ENVIRONMENT: "staging", BASIC_AUTH_PASSWORD: "geheim" },
      { headers: { Authorization: `Basic ${btoa("deploy:fout")}` } },
    );
    expect(wrong.status).toBe(401);
  });

  it("laat door met het juiste wachtwoord", async () => {
    const res = await call(
      "/api/health",
      { ENVIRONMENT: "staging", BASIC_AUTH_PASSWORD: "geheim" },
      { headers: { Authorization: `Basic ${btoa("deploy:geheim")}` } },
    );
    expect(res.status).toBe(200);
  });
});
