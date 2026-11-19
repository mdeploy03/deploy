# Hosting op Cloudflare

De werkruimte draait als Cloudflare Worker met een D1-database. Beide D1-databases zijn aangemaakt met
EU-jurisdictie (gegevens blijven in de EU).

| Omgeving | Worker | D1-database |
| --- | --- | --- |
| Staging | `deploy-werkruimte-staging` | `deploy-werkruimte-staging` |
| Productie | `deploy-werkruimte` | `deploy-werkruimte` |

Database-id's en tokens staan **niet** in de code. `wrangler.jsonc` bevat plaatshouders
(`__STAGING_D1_DATABASE_ID__`, `__PRODUCTION_D1_DATABASE_ID__`) die GitHub Actions tijdens de build invult.

## Stap 1 – GitHub-secrets

Repository → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Waarde |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | API-token met rechten voor Workers en D1 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account-id |
| `STAGING_D1_DATABASE_ID` | id van `deploy-werkruimte-staging` |
| `PRODUCTION_D1_DATABASE_ID` | id van `deploy-werkruimte` |
| `STAGING_BASIC_AUTH_PASSWORD` | tijdelijk wachtwoord voor staging (zie hieronder) |
| `PRODUCTION_BASIC_AUTH_PASSWORD` | tijdelijk wachtwoord voor productie |

## Stap 2 – Omgeving "production" met goedkeuring

**Settings → Environments → New environment** → `production` → vink **Required reviewers** aan en kies
wie een productie-deploy moet goedkeuren. Maak ook een omgeving `staging` aan (zonder reviewers).

## Stap 3 – Deployen

- Push naar `main`: tests, daarna automatisch naar staging.
- Productie: publiceer een GitHub-release, of **Actions → CI en deploy → Run workflow → production**.

De workflow past eerst de databasemigraties toe (`wrangler d1 migrations apply --remote`) en deployt
daarna de Worker.

## Tijdelijke afscherming

Totdat de Microsoft 365-login er is, vraagt de werkruimte op staging en productie om een
gebruikersnaam en wachtwoord van de browser:

- gebruikersnaam: `deploy`
- wachtwoord: de waarde van `STAGING_BASIC_AUTH_PASSWORD` / `PRODUCTION_BASIC_AUTH_PASSWORD`

Zonder ingesteld wachtwoord geeft de Worker een 503 en is er dus niets zichtbaar.
