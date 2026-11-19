import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { api } from "./helpers";

async function createOrg(body: Record<string, unknown> = {}) {
  const res = await api("POST", "/organizations", { name: "Acme BV", ...body });
  expect(res.status).toBe(201);
  return res.body;
}

describe("organisaties", () => {
  it("maakt een klant aan met standaardstatus prospect en lege velden als null", async () => {
    const org = await createOrg({ sector: "  ", kvk: "" });
    expect(org).toMatchObject({ name: "Acme BV", status: "prospect", sector: null, kvk: null });
    expect(org.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("weigert ongeldige invoer met veldmeldingen", async () => {
    const res = await api("POST", "/organizations", { name: " ", kvk: "123", status: "onbekend" });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.fields).sort()).toEqual(["kvk", "name", "status"]);
  });

  it("weigert een onbekende accountmanager", async () => {
    const res = await api("POST", "/organizations", { name: "X", accountManagerId: "bestaat-niet" });
    expect(res.status).toBe(400);
    expect(res.body.fields.accountManagerId).toBeDefined();
  });

  it("zoekt op naam en filtert op status", async () => {
    await createOrg({ name: "Bakkerij de Gouden Korst", status: "client", sector: "Food" });
    await createOrg({ name: "Gemeente Utrecht", status: "prospect" });
    await createOrg({ name: "100%_Procent", status: "former" });

    const byName = await api("GET", "/organizations?q=gouden");
    expect(byName.body.map((o: any) => o.name)).toEqual(["Bakkerij de Gouden Korst"]);

    const bySector = await api("GET", "/organizations?q=food");
    expect(bySector.body).toHaveLength(1);

    const literal = await api("GET", "/organizations?q=%25_");
    expect(literal.body.map((o: any) => o.name)).toEqual(["100%_Procent"]);

    const clients = await api("GET", "/organizations?status=client");
    expect(clients.body.map((o: any) => o.name)).toEqual(["Bakkerij de Gouden Korst"]);
  });

  it("sorteert alfabetisch zonder op hoofdletters te letten", async () => {
    await createOrg({ name: "beta" });
    await createOrg({ name: "Alfa" });
    const res = await api("GET", "/organizations");
    expect(res.body.map((o: any) => o.name)).toEqual(["Alfa", "beta"]);
  });

  it("wijzigt een klant en legt alleen de wijziging vast in het logboek", async () => {
    const org = await createOrg({ sector: "IT" });
    const res = await api("PATCH", `/organizations/${org.id}`, { status: "client" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "client", sector: "IT" });

    const log = await env.DB.prepare(
      "select action, changes from audit_log where entity_id = ? order by created_at, action",
    )
      .bind(org.id)
      .all<{ action: string; changes: string }>();
    expect(log.results.map((r) => r.action).sort()).toEqual(["create", "update"]);
    const update = log.results.find((r) => r.action === "update")!;
    expect(JSON.parse(update.changes)).toEqual({ status: { from: "prospect", to: "client" } });
  });

  it("geeft 404 voor een onbekende klant", async () => {
    expect((await api("GET", "/organizations/nope")).status).toBe(404);
    expect((await api("PATCH", "/organizations/nope", { name: "x" })).status).toBe(404);
    expect((await api("DELETE", "/organizations/nope")).status).toBe(404);
  });

  it("detail bevat contactpersonen, tijdlijn en tellingen in de lijst", async () => {
    const org = await createOrg();
    const contact = (await api("POST", "/contacts", { organizationId: org.id, firstName: "Sanne", lastName: "de Vries" }))
      .body;
    await api("POST", `/organizations/${org.id}/activities`, { type: "call", body: "Intake gehad", contactId: contact.id, occurredAt: 1000 });
    await api("POST", `/organizations/${org.id}/activities`, { body: "Offerte volgt", occurredAt: 2000 });

    const detail = await api("GET", `/organizations/${org.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.contacts.map((c: any) => c.firstName)).toEqual(["Sanne"]);
    expect(detail.body.activities.map((a: any) => a.body)).toEqual(["Offerte volgt", "Intake gehad"]);
    expect(detail.body.activities[1]).toMatchObject({ type: "call", contactName: "Sanne de Vries" });

    const list = await api("GET", "/organizations");
    expect(list.body[0]).toMatchObject({ contactCount: 1, lastActivityAt: 2000 });
  });

  it("verwijderen ruimt de tijdlijn op en ontkoppelt contactpersonen", async () => {
    const org = await createOrg();
    const contact = (await api("POST", "/contacts", { organizationId: org.id, firstName: "Piet" })).body;
    await api("POST", `/organizations/${org.id}/activities`, { body: "x" });

    expect((await api("DELETE", `/organizations/${org.id}`)).status).toBe(204);
    const left = await env.DB.prepare("select count(*) as n from activities").first<{ n: number }>();
    expect(left?.n).toBe(0);
    const contacts = await api("GET", "/contacts");
    expect(contacts.body.find((c: any) => c.id === contact.id)).toMatchObject({ organizationId: null, organizationName: null });
  });
});

describe("tijdlijn", () => {
  it("weigert lege tekst en een contactpersoon van een andere klant", async () => {
    const a = await createOrg({ name: "A" });
    const b = await createOrg({ name: "B" });
    const other = (await api("POST", "/contacts", { organizationId: b.id, firstName: "Ander" })).body;

    expect((await api("POST", `/organizations/${a.id}/activities`, { body: "  " })).status).toBe(400);
    const wrong = await api("POST", `/organizations/${a.id}/activities`, { body: "x", contactId: other.id });
    expect(wrong.status).toBe(400);
    expect((await api("POST", `/organizations/nope/activities`, { body: "x" })).status).toBe(404);
  });

  it("verwijdert een notitie alleen binnen de juiste klant", async () => {
    const a = await createOrg({ name: "A" });
    const b = await createOrg({ name: "B" });
    const note = (await api("POST", `/organizations/${a.id}/activities`, { body: "x" })).body;
    expect((await api("DELETE", `/organizations/${b.id}/activities/${note.id}`)).status).toBe(404);
    expect((await api("DELETE", `/organizations/${a.id}/activities/${note.id}`)).status).toBe(204);
  });
});

describe("contactpersonen", () => {
  it("maakt aan, normaliseert e-mail en zoekt op naam, e-mail en klant", async () => {
    const org = await createOrg({ name: "Rabobank" });
    const res = await api("POST", "/contacts", {
      organizationId: org.id,
      firstName: "Jan",
      lastName: "Jansen",
      email: " Jan.Jansen@Example.NL ",
    });
    expect(res.status).toBe(201);
    expect(res.body.email).toBe("jan.jansen@example.nl");
    await api("POST", "/contacts", { firstName: "Losse", lastName: "Contact" });

    expect((await api("GET", "/contacts?q=jan jansen")).body).toHaveLength(1);
    expect((await api("GET", "/contacts?q=example.nl")).body).toHaveLength(1);
    const byOrg = await api("GET", "/contacts?q=rabo");
    expect(byOrg.body[0]).toMatchObject({ firstName: "Jan", organizationName: "Rabobank" });
    expect((await api("GET", `/contacts?organizationId=${org.id}`)).body).toHaveLength(1);
  });

  it("weigert ongeldig e-mailadres, lege voornaam en onbekende klant", async () => {
    const res = await api("POST", "/contacts", { firstName: "", email: "geen-mail" });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.fields).sort()).toEqual(["email", "firstName"]);
    expect((await api("POST", "/contacts", { firstName: "A", organizationId: "nope" })).status).toBe(400);
  });

  it("wijzigt en verwijdert", async () => {
    const created = (await api("POST", "/contacts", { firstName: "Kees" })).body;
    const updated = await api("PATCH", `/contacts/${created.id}`, { jobTitle: "Directeur", phone: "" });
    expect(updated.body).toMatchObject({ firstName: "Kees", jobTitle: "Directeur", phone: null });
    expect((await api("DELETE", `/contacts/${created.id}`)).status).toBe(204);
    expect((await api("DELETE", `/contacts/${created.id}`)).status).toBe(404);
  });
});
