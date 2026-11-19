/**
 * Nieuwe positie voor een kaart in een kolom (oplopend gesorteerd, zonder de kaart zelf).
 * Zonder beforeId: achteraan. Geeft null als beforeId niet in de kolom staat.
 */
export function positionBefore(column: { id: string; position: number }[], beforeId?: string | null): number | null {
  if (!beforeId) return (column.at(-1)?.position ?? 0) + 1;
  const index = column.findIndex((c) => c.id === beforeId);
  if (index === -1) return null;
  const next = column[index].position;
  return index === 0 ? next - 1 : (column[index - 1].position + next) / 2;
}
