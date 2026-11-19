const TZ = "Europe/Amsterdam";

/** Datum (YYYY-MM-DD) in Nederlandse tijd. */
export function nlDate(d = new Date()) {
  return d.toLocaleDateString("sv-SE", { timeZone: TZ });
}

export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Zondag van de huidige week (maandag t/m zondag). */
export function endOfWeek(iso: string) {
  const day = new Date(`${iso}T12:00:00Z`).getUTCDay(); // 0 = zondag
  return addDays(iso, (7 - day) % 7);
}

/** Begin van het kwartaal als tijdstip (ms), ongeveer middernacht Nederlandse tijd. */
export function quarterStartMs(iso: string) {
  const [y, m] = iso.split("-").map(Number);
  const startMonth = Math.floor((m - 1) / 3) * 3;
  return Date.UTC(y, startMonth, 1) - 2 * 3600_000; // ruim genomen, zomer- en wintertijd
}
