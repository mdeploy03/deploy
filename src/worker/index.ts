import { Hono } from "hono";
import { basicAuth } from "hono/basic-auth";
import { secureHeaders } from "hono/secure-headers";
import { HTTPException } from "hono/http-exception";
import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { contactRoutes } from "./routes/contacts";
import { dealRoutes } from "./routes/deals";
import { auditRoutes, dashboardRoutes } from "./routes/dashboard";
import { projectRoutes, taskRoutes } from "./routes/projects";
import { organizationRoutes } from "./routes/organizations";
import { userRoutes } from "./routes/users";
import type { AppEnv } from "./types";

export type { Env } from "./types";

const app = new Hono<AppEnv>();

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

// Tot de Microsoft-login er is, is er geen ingelogde gebruiker.
app.use("/api/*", async (c, next) => {
  c.set("userId", null);
  await next();
});

const api = new Hono<AppEnv>();

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

api.route("/organizations", organizationRoutes);
api.route("/contacts", contactRoutes);
api.route("/deals", dealRoutes);
api.route("/projects", projectRoutes);
api.route("/tasks", taskRoutes);
api.route("/dashboard", dashboardRoutes);
api.route("/audit", auditRoutes);
api.route("/users", userRoutes);

app.route("/api", api);
// Onbekende API-routes nooit naar de React-app laten doorvallen.
app.all("/api/*", (c) => c.json({ error: "Niet gevonden" }, 404));

app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  console.error(err);
  return c.json({ error: "Er ging iets mis op de server" }, 500);
});

// Alles buiten /api: de React-app (statische bestanden, SPA-fallback).
// Kopie van de response, zodat middleware (secureHeaders) headers mag toevoegen.
app.all("*", async (c) => {
  const res = await c.env.ASSETS.fetch(c.req.raw);
  return new Response(res.body, res);
});

export default app;
