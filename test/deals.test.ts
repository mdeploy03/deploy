import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { parseEuro } from "../src/shared/deals";
import { api } from "./helpers";

async function setup() {
  const org = (await api("POST", "/organizations", { name: "Acme BV" })).body;
  return org as { id: string };
}

async function createDeal(organizationId: string, body: Record<string, unknown> = {}) {
  const res = await api("POST", "/deals", { title: "Lean-training", organizationId, ...body });
  expect(res.status).toBe(201);
  return res.body;
}

const stageOrder = async (stage: string) =>
  (await api("GET", "/deals")).body.filter((d: any) => d.stage === stage).map((d: any) => d.title);

describe("kansen", () => {
  it("maakt een kans aan met standaardfase lead en kans 10%", async () => {
    const org = await setup();
    const deal = await createDeal(org.id, { valueCents: 1250000 });
    expect(deal).toMatchObject({ stage: "lead", probability: 0.1, valueCents: 1250000, lostReason: null, position: 1 });
  });

  it("valideert verplichte velden, bedrag, datum en verwijzingen", async () => {
    const org = await setup();
    const res = await api("POST", "/deals", { title: "", organizationId: "", valueCents: -1, expectedCloseDate: "morgen" });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.fields).sort()).toEqual(["expectedCloseDate", "organizationId", "title", "valueCents"]);

    const other = (await api("POST", "/organizations", { name: "Ander" })).body;
    const contact = (await api("POST", "/contacts", { organizationId: other.id, firstName: "X" })).body;
    const wrong = await api("POST", "/deals", { title: "x", organizationId: org.id, contactId: contact.id, ownerId: "nope" });
    expect(wrong.status).toBe(400);
    expect(Object.keys(wrong.body.fields).sort()).toEqual(["contactId", "ownerId"]);
    expect((await api("POST", "/deals", { title: "x", organizationId: "nope" })).status).toBe(400);
  });

  it("past de standaardkans aan bij een fasewissel, maar houdt een eigen kans", async () => {
    const org = await setup();
    const deal = await createDeal(org.id);
    const toProposal = await api("PATCH", `/deals/${deal.id}`, { stage: "proposal" });
    expect(toProposal.body.probability).toBe(0.5);

    const custom = await api("PATCH", `/deals/${deal.id}`, { probability: 0.6 });
    expect(custom.body).toMatchObject({ stage: "proposal", probability: 0.6 });

    const title = await api("PATCH", `/deals/${deal.id}`, { title: "Nieuwe titel" });
    expect(title.body.probability).toBe(0.6);
  });

  it("bewaart een reden alleen bij verloren", async () => {
    const org = await setup();
    const deal = await createDeal(org.id);
    const lost = await api("PATCH", `/deals/${deal.id}`, { stage: "lost", lostReason: "Te duur" });
    expect(lost.body).toMatchObject({ stage: "lost", probability: 0, lostReason: "Te duur" });
    const reopened = await api("PATCH", `/deals/${deal.id}`, { stage: "lead" });
    expect(reopened.body).toMatchObject({ stage: "lead", probability: 0.1, lostReason: null });
  });

  it("verplaatst op het bord naar het einde of vóór een andere kaart", async () => {
    const org = await setup();
    const a = await createDeal(org.id, { title: "A" });
    const b = await createDeal(org.id, { title: "B" });
    const c = await createDeal(org.id, { title: "C" });
    expect(await stageOrder("lead")).toEqual(["A", "B", "C"]);

    await api("POST", `/deals/${c.id}/move`, { stage: "lead", beforeId: a.id });
    expect(await stageOrder("lead")).toEqual(["C", "A", "B"]);

    await api("POST", `/deals/${c.id}/move`, { stage: "lead", beforeId: b.id });
    expect(await stageOrder("lead")).toEqual(["A", "C", "B"]);

    const moved = await api("POST", `/deals/${a.id}/move`, { stage: "qualified" });
    expect(moved.body).toMatchObject({ stage: "qualified", probability: 0.25 });
    expect(await stageOrder("lead")).toEqual(["C", "B"]);

    const lost = await api("POST", `/deals/${b.id}/move`, { stage: "lost", lostReason: "Geen budget" });
    expect(lost.body.lostReason).toBe("Geen budget");

    expect((await api("POST", `/deals/${c.id}/move`, { stage: "won", beforeId: a.id })).status).toBe(400);
    expect((await api("POST", `/deals/nope/move`, { stage: "won" })).status).toBe(404);
  });

  it("zoekt op titel en klantnaam en toont namen in de lijst", async () => {
    const org = await setup();
    const contact = (await api("POST", "/contacts", { organizationId: org.id, firstName: "Sanne", lastName: "de Vries" })).body;
    await createDeal(org.id, { title: "Green Belt traject", contactId: contact.id });
    await createDeal(org.id, { title: "Coaching" });

    const byTitle = await api("GET", "/deals?q=green");
    expect(byTitle.body).toHaveLength(1);
    expect(byTitle.body[0]).toMatchObject({ organizationName: "Acme BV", contactName: "Sanne de Vries", projectId: null });
    expect((await api("GET", "/deals?q=acme")).body).toHaveLength(2);
  });

  it("maakt van een gewonnen kans één project en toont het bij de kans", async () => {
    const org = await setup();
    const deal = await createDeal(org.id, { title: "Black Belt" });
    expect((await api("POST", `/deals/${deal.id}/project`)).status).toBe(400);

    await api("PATCH", `/deals/${deal.id}`, { stage: "won" });
    const res = await api("POST", `/deals/${deal.id}/project`);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: "Black Belt", organizationId: org.id, dealId: deal.id, status: "planned" });

    const again = await api("POST", `/deals/${deal.id}/project`);
    expect(again.status).toBe(409);
    expect(again.body.projectId).toBe(res.body.id);

    expect((await api("GET", `/deals/${deal.id}`)).body.projectId).toBe(res.body.id);
  });

  it("klantdetail toont kansen; verwijderen van kans laat project bestaan", async () => {
    const org = await setup();
    const deal = await createDeal(org.id, { stage: "won" });
    const project = (await api("POST", `/deals/${deal.id}/project`)).body;

    const detail = await api("GET", `/organizations/${org.id}`);
    expect(detail.body.deals.map((d: any) => d.id)).toEqual([deal.id]);

    expect((await api("DELETE", `/deals/${deal.id}`)).status).toBe(204);
    const row = await env.DB.prepare("select deal_id from projects where id = ?").bind(project.id).first();
    expect(row).toEqual({ deal_id: null });
  });
});

describe("bedrag invoeren", () => {
  it.each([
    ["12500", 1250000],
    ["12.500", 1250000],
    ["1.250.000", 125000000],
    ["12.500,50", 1250050],
    ["€ 1.234,5", 123450],
    ["99.95", 9995],
    ["1500,-", 150000],
    ["", 0],
  ])("%s → %d cent", (input, cents) => {
    expect(parseEuro(input)).toBe(cents);
  });

  it.each(["abc", "12,5,0", "-5", "1.2.3"])("weigert %s", (input) => {
    expect(parseEuro(input)).toBeNull();
  });
});
