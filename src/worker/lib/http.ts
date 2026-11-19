import { zValidator } from "@hono/zod-validator";
import type { ZodType } from "zod";

/** JSON-body valideren; bij fouten 400 met een veldoverzicht in het Nederlands. */
export function jsonBody<T extends ZodType>(schema: T) {
  return zValidator("json", schema, (result, c) => {
    if (!result.success) {
      const fields: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join(".") || "_";
        fields[key] ??= issue.message;
      }
      return c.json({ error: "Controleer de invoer", fields }, 400);
    }
  });
}

/** Zoekterm veilig maken voor LIKE (% en _ letterlijk). */
export function likePattern(q: string) {
  return `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}
