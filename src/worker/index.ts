import { Hono } from "hono";
import { basicAuth } from "hono/basic-auth";
import { secureHeaders } from "hono/secure-headers";
import { sql } from "drizzle-orm";
import { getDb } from "./db";

export type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
  ENVIRONMENT: "local" | "staging" | "production";
  /** Tijdelijke afscherming tot de Microsoft-login er is (wrangler secret). */
  BASIC_AUTH_PASSWORD?: string;
};

const app = new Hono<{ Bindings: Env }>();

app.use("*", secureHeaders());

// Tijdelijke afscherming: buiten lokaal altijd een wachtwoord vereist.
// Wordt vervangen door Microsoft Entra-login (stap 2 van het plan).
app.use("*", async (c, next) => {
  if (c.env.ENVIRONMENT === "local") return next();
  const password = c.env.BASIC_AUTH_PASSWORD;
  if (!password) {
    return c.text("Werkruimte is nog niet geconfigureerd (BASIC_AUTH_PASSWORD ontbreekt).", 503);
  }
  return basicAuth({ username: "deploy", password, realm: "DEPLOY Werkruimte" })(c, next);
});

const api = new Hono<{ Bindings: Env }>();

api.get("/health", async (c) => {
  let db = false;
  try {
    await getDb(c.env).run(sql`select 1`);
    db = true;
  } catch {
    db = false;
  }
  return c.json({ ok: db, environment: c.env.ENVIRONMENT, db }, db ? 200 : 503);
});

app.route("/api", api);
// Onbekende API-routes nooit naar de React-app laten doorvallen.
app.all("/api/*", (c) => c.json({ error: "Niet gevonden" }, 404));

// Alles buiten /api: de React-app (statische bestanden, SPA-fallback).
// Kopie van de response, zodat middleware (secureHeaders) headers mag toevoegen.
app.all("*", async (c) => {
  const res = await c.env.ASSETS.fetch(c.req.raw);
  return new Response(res.body, res);
});

export default app;
