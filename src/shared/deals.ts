import { z } from "zod";

export const DEAL_STAGES = ["lead", "qualified", "proposal", "negotiation", "won", "lost"] as const;
export type DealStage = (typeof DEAL_STAGES)[number];
export const OPEN_STAGES = ["lead", "qualified", "proposal", "negotiation"] as const satisfies readonly DealStage[];

export const dealStageLabel: Record<DealStage, string> = {
  lead: "Lead",
  qualified: "Gekwalificeerd",
  proposal: "Offerte",
  negotiation: "Onderhandeling",
  won: "Gewonnen",
  lost: "Verloren",
};

/** Standaard-slagingskans per fase; wordt gebruikt als er geen eigen kans is opgegeven. */
export const defaultProbability: Record<DealStage, number> = {
  lead: 0.1,
  qualified: 0.25,
  proposal: 0.5,
  negotiation: 0.75,
  won: 1,
  lost: 0,
};

const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullish();

const dealFields = {
  title: z.string().trim().min(1, "Titel is verplicht").max(200),
  organizationId: z.string().min(1, "Kies een klant"),
  contactId: optionalText(64),
  stage: z.enum(DEAL_STAGES),
  valueCents: z.number().int("Bedrag in hele centen").min(0, "Bedrag kan niet negatief zijn").max(100_000_000_00),
  probability: z.number().min(0).max(1).optional(),
  expectedCloseDate: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/, "Ongeldige datum")
    .transform((v) => (v === "" ? null : v))
    .nullish(),
  lostReason: optionalText(1000),
  ownerId: optionalText(64),
};

export const dealInput = z.object({
  ...dealFields,
  stage: dealFields.stage.default("lead"),
  valueCents: dealFields.valueCents.default(0),
});
export type DealInput = z.input<typeof dealInput>;

// Bij wijzigen géén standaardwaarden: wat niet is meegestuurd, blijft zoals het was.
export const dealUpdate = z.object(dealFields).partial();

/** Verplaatsen op het bord: nieuwe fase en (optioneel) tussen welke kaarten. */
export const dealMove = z.object({
  stage: z.enum(DEAL_STAGES),
  beforeId: z.string().nullish(),
  lostReason: optionalText(1000),
});
export type DealMove = z.input<typeof dealMove>;

export type Deal = {
  id: string;
  title: string;
  organizationId: string;
  contactId: string | null;
  stage: DealStage;
  valueCents: number;
  probability: number;
  expectedCloseDate: string | null;
  lostReason: string | null;
  ownerId: string | null;
  position: number;
  createdAt: number;
  updatedAt: number;
};

export type DealListItem = Deal & {
  organizationName: string;
  contactName: string | null;
  ownerName: string | null;
  projectId: string | null;
};

const euro = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
export const formatEuro = (cents: number) => euro.format(cents / 100);

/** "12.500", "12.500,50", "12500" of "12500.5" → centen; null bij ongeldige invoer. */
export function parseEuro(input: string): number | null {
  const s = input.replace(/[€\s]/g, "").replace(/,-$/, "");
  if (s === "") return 0;
  let normalized: string;
  if (s.includes(",")) normalized = s.replace(/\./g, "").replace(",", "."); // Nederlandse notatie
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) normalized = s.replace(/\./g, ""); // 12.500 = twaalfduizend vijfhonderd
  else normalized = s;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}
