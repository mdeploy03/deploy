import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { addDays, endOfWeek, nlDate, quarterStartMs } from "../src/worker/lib/dates";
import { api } from "./helpers";

const today = nlDate();

describe("datums", () => {
  it("einde van de week is zondag", () => {
    expect(endOfWeek("2026-11-19")).toBe("2026-11-22"); // donderdag → zondag
    expect(endOfWeek("2026-11-22")).toBe("2026-11-22"); // zondag blijft zondag
    expect(endOfWeek("2026-11-23")).toBe("2026-11-29"); // maandag
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
  });

  it("kwartaalbegin", () => {
    expect(new Date(quarterStartMs("2026-11-19") + 2 * 3600_000).toISOString().slice(0, 10)).toBe("2026-10-01");
    expect(new Date(quarterStartMs("2026-03-31") + 2 * 3600_000).toISOString().slice(0, 10)).toBe("2026-01-01");
  });
});

describe("dashboard", () => {
  it("is leeg zonder gegevens", async () => {
    const res = await api("GET", "/dashboard");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      pipeline: { openCount: 0, openValueCents: 0, weightedValueCents: 0, wonThisQuarter: { count: 0, valueCents: 0 }, closingSoon: [] },
      projects: { activeCount: 0, active: [] },
      tasks: { overdueCount: 0, dueThisWeek: [] },
      recentActivities: [],
    });
  });

  it("telt pipeline, gewonnen, sluitdatums, projecten, taken en tijdlijn", async () => {
    const org = (await api("POST", "/organizations", { name: "Acme" })).body;
    const deal = (title: string, body: Record<string, unknown>) => api("POST", "/deals", { title, organizationId: org.id, ...body });
    await deal("Lead", { valueCents: 100_00, expectedCloseDate: addDays(today, -3) }); // 10%
    await deal("Offerte", { stage: "proposal", valueCents: 1000_00, expectedCloseDate: addDays(today, 30) }); // 50%
    const toWin = (await deal("Wordt gewonnen", { stage: "negotiation", valueCents: 5000_00 })).body;
    await api("POST", `/deals/${toWin.id}/move`, { stage: "won" });
    await deal("Direct gewonnen", { stage: "won", valueCents: 200_00 });
    await deal("Verloren", { stage: "lost", valueCents: 999_00 });

    const active = (await api("POST", "/projects", { name: "Actief", organizationId: org.id, status: "active" })).body;
    await api("POST", "/projects", { name: "Gepland", organizationId: org.id });
    const done = (await api("POST", "/projects", { name: "Klaar", organizationId: org.id, status: "done" })).body;
    await api("POST", `/projects/${active.id}/tasks`, { title: "Te laat", dueDate: addDays(today, -1) });
    await api("POST", `/projects/${active.id}/tasks`, { title: "Vandaag", dueDate: today, priority: "high" });
    await api("POST", `/projects/${active.id}/tasks`, { title: "Volgende maand", dueDate: addDays(today, 40) });
    await api("POST", `/projects/${active.id}/tasks`, { title: "Al gedaan", dueDate: addDays(today, -5), status: "done" });
    await api("POST", `/projects/${done.id}/tasks`, { title: "In afgerond project", dueDate: addDays(today, -5) });
    await api("POST", `/organizations/${org.id}/activities`, { body: "Gebeld", type: "call" });

    const { body } = await api("GET", "/dashboard");
    expect(body.pipeline).toMatchObject({ openCount: 2, openValueCents: 1100_00, weightedValueCents: 510_00 });
    expect(body.pipeline.wonThisQuarter).toEqual({ count: 2, valueCents: 5200_00 });
    expect(body.pipeline.closingSoon.map((d: any) => d.title)).toEqual(["Lead"]);
    expect(body.projects.activeCount).toBe(1);
    expect(body.projects.active[0]).toMatchObject({ name: "Actief", taskCount: 4, doneCount: 1, overdueCount: 1 });
    expect(body.tasks.overdueCount).toBe(1);
    expect(body.tasks.dueThisWeek.map((t: any) => t.title)).toEqual(["Te laat", "Vandaag"]);
    expect(body.recentActivities).toHaveLength(1);
    expect(body.recentActivities[0]).toMatchObject({ body: "Gebeld", organizationName: "Acme" });
  });

  it("een kans die na winnen weer heropend is, telt niet als gewonnen", async () => {
    const org = (await api("POST", "/organizations", { name: "Acme" })).body;
    const d = (await api("POST", "/deals", { title: "x", organizationId: org.id, valueCents: 100 })).body;
    await api("PATCH", `/deals/${d.id}`, { stage: "won" });
    await api("PATCH", `/deals/${d.id}`, { stage: "negotiation" });
    expect((await api("GET", "/dashboard")).body.pipeline.wonThisQuarter.count).toBe(0);
  });
});

describe("geschiedenis", () => {
  it("toont aanmaken en wijzigingen, nieuwste eerst, met naam van de gebruiker", async () => {
    const org = (await api("POST", "/organizations", { name: "Acme" })).body;
    await api("PATCH", `/organizations/${org.id}`, { status: "client" });
    const uid = crypto.randomUUID();
    await env.DB.prepare("insert into users (id, email, name) values (?, 'a@deploy.test', 'Anna')").bind(uid).run();
    await env.DB.prepare("update audit_log set user_id = ? where action = 'update'").bind(uid).run();

    const res = await api("GET", `/audit?entityType=organization&entityId=${org.id}`);
    expect(res.body.map((e: any) => e.action)).toEqual(["update", "create"]);
    expect(res.body[0]).toMatchObject({ userName: "Anna", changes: { status: { from: "prospect", to: "client" } } });
    expect((await api("GET", "/audit")).status).toBe(400);
  });
});
