import { defineConfig } from "drizzle-kit";

// Alleen voor het genereren van SQL-migraties; toepassen gaat via wrangler.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/worker/db/schema.ts",
  out: "./migrations",
});
