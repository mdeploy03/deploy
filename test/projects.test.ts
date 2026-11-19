import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { api } from "./helpers";

async function setup() {
  const org = (await api("POST", "/organizations", { name: "Acme BV" })).body;
  const project = (await api("POST", "/projects", { name: "Green Belt Acme", organizationId: org.id })).body;
  return { org, project };
}

async function addUser(name: string) {
  const id = crypto.randomUUID();
  await env.DB.prepare("insert into users (id, email, name) values (?, ?, ?)").bind(id, `${name.toLowerCase()}@deploy.test`, name).run();
  return id;
}

const isoDay = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

describe("projecten", () => {
  it("maakt een project aan met status gepland", async () => {
    const { project } = await setup();
    expect(project).toMatchObject({ name: "Green Belt Acme", status: "planned", dealId: null });
  });

  it("valideert naam, klant, datums en projectleider", async () => {
    const res = await api("POST", "/projects", { name: "", organizationId: "", startDate: "2026-12-01", endDate: "2026-11-01" });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.fields).sort()).toEqual(["endDate", "name", "organizationId"]);

    const { org } = await setup();
    const wrong = await api("POST", "/projects", { name: "x", organizationId: org.id, leadId: "nope" });
    expect(wrong.body.fields).toEqual({ leadId: "Onbekende gebruiker" });
  });

  it("controleert de einddatum ook tegen de opgeslagen startdatum", async () => {
    const { project } = await setup();
    await api("PATCH", `/projects/${project.id}`, { startDate: "2026-12-01" });
    const res = await api("PATCH", `/projects/${project.id}`, { endDate: "2026-11-01" });
    expect(res.status).toBe(400);
    expect(res.body.fields.endDate).toBeDefined();
  });

  it("gedeeltelijk wijzigen laat de rest ongemoeid", async () => {
    const { project } = await setup();
    await api("PATCH", `/projects/${project.id}`, { status: "active", description: "Zes deelnemers" });
    const res = await api("PATCH", `/projects/${project.id}`, { name: "Nieuwe naam" });
    expect(res.body).toMatchObject({ name: "Nieuwe naam", status: "active", description: "Zes deelnemers" });
  });

  it("lijst: zoeken, filteren, sorteren op status en voortgang tellen", async () => {
    const { org, project } = await setup();
    const active = (await api("POST", "/projects", { name: "Zorgpad", organizationId: org.id, status: "active" })).body;
    await api("POST", `/projects/${active.id}/tasks`, { title: "Klaar", status: "done" });
    await api("POST", `/projects/${active.id}/tasks`, { title: "Te laat", dueDate: isoDay(-2) });
    await api("POST", `/projects/${active.id}/tasks`, { title: "Later", dueDate: isoDay(5) });

    const all = await api("GET", "/projects");
    expect(all.body.map((p: any) => p.name)).toEqual(["Zorgpad", "Green Belt Acme"]);
    expect(all.body[0]).toMatchObject({ organizationName: "Acme BV", taskCount: 3, doneCount: 1, overdueCount: 1 });

    expect((await api("GET", "/projects?status=planned")).body.map((p: any) => p.id)).toEqual([project.id]);
    expect((await api("GET", "/projects?q=zorg")).body).toHaveLength(1);
    expect((await api("GET", "/projects?q=acme")).body).toHaveLength(2);
  });

  it("detail met taken, leden en kans; klantpagina toont projecten", async () => {
    const { org } = await setup();
    const deal = (await api("POST", "/deals", { title: "Black Belt", organizationId: org.id, stage: "won" })).body;
    const fromDeal = (await api("POST", `/deals/${deal.id}/project`)).body;
    const anna = await addUser("Anna");
    const bram = await addUser("Bram");

    expect((await api("PUT", `/projects/${fromDeal.id}/members`, { userIds: [bram, anna, anna] })).status).toBe(204);
    expect((await api("PUT", `/projects/${fromDeal.id}/members`, { userIds: ["nope"] })).status).toBe(400);
    await api("POST", `/projects/${fromDeal.id}/tasks`, { title: "Intake", assigneeId: anna });

    const detail = await api("GET", `/projects/${fromDeal.id}`);
    expect(detail.body).toMatchObject({ dealTitle: "Black Belt", taskCount: 1 });
    expect(detail.body.members.map((m: any) => m.name)).toEqual(["Anna", "Bram"]);
    expect(detail.body.tasks[0]).toMatchObject({ title: "Intake", assigneeName: "Anna", projectName: "Black Belt" });

    const orgDetail = await api("GET", `/organizations/${org.id}`);
    expect(orgDetail.body.projects.map((p: any) => p.name).sort()).toEqual(["Black Belt", "Green Belt Acme"]);
  });

  it("verwijderen ruimt taken en leden op", async () => {
    const { project } = await setup();
    const anna = await addUser("Anna");
    await api("PUT", `/projects/${project.id}/members`, { userIds: [anna] });
    await api("POST", `/projects/${project.id}/tasks`, { title: "x" });
    expect((await api("DELETE", `/projects/${project.id}`)).status).toBe(204);
    const left = await env.DB.prepare("select (select count(*) from tasks) + (select count(*) from project_members) as n").first<{ n: number }>();
    expect(left?.n).toBe(0);
    expect((await api("GET", `/projects/${project.id}`)).status).toBe(404);
  });
});

describe("taken", () => {
  const order = async (projectId: string, status: string) =>
    (await api("GET", `/projects/${projectId}`)).body.tasks.filter((t: any) => t.status === status).map((t: any) => t.title);

  it("valideert titel, deadline en uitvoerder", async () => {
    const { project } = await setup();
    const res = await api("POST", `/projects/${project.id}/tasks`, { title: " ", dueDate: "volgende week", priority: "urgent" });
    expect(Object.keys(res.body.fields).sort()).toEqual(["dueDate", "priority", "title"]);
    expect((await api("POST", `/projects/${project.id}/tasks`, { title: "x", assigneeId: "nope" })).status).toBe(400);
    expect((await api("POST", `/projects/nope/tasks`, { title: "x" })).status).toBe(404);
  });

  it("wijzigen: status naar klaar zet de taak achteraan, rest blijft gelijk", async () => {
    const { project } = await setup();
    const a = (await api("POST", `/projects/${project.id}/tasks`, { title: "A", priority: "high", dueDate: "2026-12-01" })).body;
    await api("POST", `/projects/${project.id}/tasks`, { title: "B", status: "done" });
    const res = await api("PATCH", `/tasks/${a.id}`, { status: "done" });
    expect(res.body).toMatchObject({ status: "done", priority: "high", dueDate: "2026-12-01" });
    expect(await order(project.id, "done")).toEqual(["B", "A"]);
  });

  it("verplaatsen op het bord", async () => {
    const { project } = await setup();
    const a = (await api("POST", `/projects/${project.id}/tasks`, { title: "A" })).body;
    const b = (await api("POST", `/projects/${project.id}/tasks`, { title: "B" })).body;
    const c = (await api("POST", `/projects/${project.id}/tasks`, { title: "C" })).body;
    await api("POST", `/tasks/${c.id}/move`, { status: "todo", beforeId: a.id });
    expect(await order(project.id, "todo")).toEqual(["C", "A", "B"]);
    await api("POST", `/tasks/${a.id}/move`, { status: "doing" });
    await api("POST", `/tasks/${b.id}/move`, { status: "doing", beforeId: a.id });
    expect(await order(project.id, "doing")).toEqual(["B", "A"]);
    expect((await api("POST", `/tasks/${c.id}/move`, { status: "done", beforeId: a.id })).status).toBe(400);
  });

  it("mijn werk: open taken per uitvoerder, gesorteerd op deadline, zonder afgeronde projecten", async () => {
    const { org, project } = await setup();
    const anna = await addUser("Anna");
    const t = (title: string, body: Record<string, unknown> = {}, projectId = project.id) =>
      api("POST", `/projects/${projectId}/tasks`, { title, assigneeId: anna, ...body });
    await t("Zonder datum");
    await t("Later", { dueDate: isoDay(10) });
    await t("Te laat", { dueDate: isoDay(-1) });
    await t("Al klaar", { status: "done", dueDate: isoDay(-3) });
    await t("Van Bram", { assigneeId: null });
    const closed = (await api("POST", "/projects", { name: "Oud", organizationId: org.id, status: "done" })).body;
    await t("In afgerond project", {}, closed.id);

    const mine = await api("GET", `/tasks?assigneeId=${anna}&open=1&activeProjects=1`);
    expect(mine.body.map((x: any) => x.title)).toEqual(["Te laat", "Later", "Zonder datum"]);
    expect(mine.body[0]).toMatchObject({ projectName: "Green Belt Acme", organizationName: "Acme BV" });

    const unassigned = await api("GET", "/tasks?assigneeId=none&open=1");
    expect(unassigned.body.map((x: any) => x.title)).toEqual(["Van Bram"]);
  });

  it("verwijdert een taak", async () => {
    const { project } = await setup();
    const a = (await api("POST", `/projects/${project.id}/tasks`, { title: "A" })).body;
    expect((await api("DELETE", `/tasks/${a.id}`)).status).toBe(204);
    expect((await api("DELETE", `/tasks/${a.id}`)).status).toBe(404);
  });
});
