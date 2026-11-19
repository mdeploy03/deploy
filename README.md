# DEPLOY Werkruimte

Mini-CRM en projectbeheer voor DEPLOY Consultancy: klanten, sales-pipeline, projecten en taken.

**Stack:** Cloudflare Workers + D1 (EU) · Hono (API) · React + Vite · Drizzle ORM · Tailwind (DEPLOY-huisstijl).

## Lokaal werken

```bash
npm install
npm run db:migrate:local   # lokale D1-database aanmaken/bijwerken
npm run dev                # http://localhost:5173
```

Lokaal is er geen inlogscherm. Overige scripts:

| Script | Doel |
| --- | --- |
| `npm test` | API-tests in de Workers-runtime (met lokale D1) |
| `npm run typecheck` | TypeScript-controle |
| `npm run db:generate -- --name <naam>` | nieuwe migratie maken na wijziging in `src/worker/db/schema.ts` |
| `npm run build` | productiebuild (`CLOUDFLARE_ENV=staging` of `production` voor een omgeving) |

## Structuur

```
src/worker/        Hono API (alles onder /api), afscherming, database
src/worker/db/     Drizzle-schema
src/web/           React-app (pagina's, layout, huisstijl)
migrations/        SQL-migraties voor D1 (gegenereerd door drizzle-kit)
test/              Vitest-tests in de Workers-runtime
.github/workflows/ CI en deploy naar Cloudflare
```

## Deploy

Zie [docs/hosting-cloudflare.md](docs/hosting-cloudflare.md).

- Push naar `main` → tests → **staging** (`deploy-werkruimte-staging`).
- GitHub-release publiceren (of handmatig "Run workflow" → production) → **productie** (`deploy-werkruimte`).
