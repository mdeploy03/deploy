import { useDeferredValue, useMemo, useState, type DragEvent } from "react";
import { DEAL_STAGES, dealStageLabel, formatEuro, OPEN_STAGES, type DealListItem, type DealStage } from "../../shared/deals";
import { DealForm } from "../crm/DealForm";
import { useDeals, useMoveDeal } from "../crm/dealHooks";
import { useUsers } from "../crm/hooks";
import { Button, Dialog, ErrorText, Input, PageHeader, Select, formatDate } from "../ui";

const stageAccent: Record<DealStage, string> = {
  lead: "border-t-line",
  qualified: "border-t-cyan",
  proposal: "border-t-cyan",
  negotiation: "border-t-brand",
  won: "border-t-brand",
  lost: "border-t-magenta",
};

const isOpen = (s: DealStage) => (OPEN_STAGES as readonly DealStage[]).includes(s);
const weighted = (d: DealListItem) => Math.round(d.valueCents * d.probability);
const today = () => new Date().toISOString().slice(0, 10);

export function Pipeline() {
  const [q, setQ] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const deals = useDeals({ q: useDeferredValue(q.trim()), ownerId });
  const users = useUsers();
  const move = useMoveDeal();
  const [dialog, setDialog] = useState<{ deal?: DealListItem } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ stage: DealStage; beforeId: string | null } | null>(null);

  const columns = useMemo(() => {
    const by = Object.fromEntries(DEAL_STAGES.map((s) => [s, [] as DealListItem[]])) as Record<DealStage, DealListItem[]>;
    for (const d of deals.data ?? []) by[d.stage].push(d);
    for (const s of DEAL_STAGES) by[s].sort((a, b) => a.position - b.position);
    return by;
  }, [deals.data]);

  const open = (deals.data ?? []).filter((d) => isOpen(d.stage));
  const totals = {
    count: open.length,
    value: open.reduce((sum, d) => sum + d.valueCents, 0),
    weighted: open.reduce((sum, d) => sum + weighted(d), 0),
  };

  function drop(e: DragEvent, stage: DealStage) {
    e.preventDefault();
    const id = dragId ?? e.dataTransfer.getData("text/plain");
    const beforeId = dropTarget?.stage === stage ? dropTarget.beforeId : null;
    setDragId(null);
    setDropTarget(null);
    if (!id || id === beforeId) return;
    const deal = deals.data?.find((d) => d.id === id);
    if (!deal) return;
    let lostReason: string | null | undefined;
    if (stage === "lost" && deal.stage !== "lost") {
      const reason = prompt(`Waarom is “${deal.title}” verloren? (optioneel)`);
      if (reason === null) return; // geannuleerd
      lostReason = reason;
    }
    move.mutate({ id, move: { stage, beforeId, lostReason } });
  }

  return (
    <div>
      <PageHeader kicker="Sales" title="Pipeline" actions={<Button onClick={() => setDialog({})}>Nieuwe kans</Button>} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Open kansen" value={String(totals.count)} />
        <Stat label="Pipelinewaarde" value={formatEuro(totals.value)} />
        <Stat label="Gewogen waarde" value={formatEuro(totals.weighted)} accent />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-80">
          <Input type="search" placeholder="Zoek op titel of klant…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {users.data && users.data.length > 0 && (
          <div className="w-full sm:w-56">
            <Select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              <option value="">Alle eigenaren</option>
              {users.data.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>
      <ErrorText error={deals.error ?? move.error} />

      <div className="-mx-4 overflow-x-auto px-4 pb-4">
        <div className="grid min-w-[1100px] grid-cols-6 gap-3">
          {DEAL_STAGES.map((stage) => {
            const list = columns[stage];
            const sum = list.reduce((s, d) => s + d.valueCents, 0);
            const showDrop = dragId && dropTarget?.stage === stage;
            return (
              <section
                key={stage}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dropTarget?.stage !== stage) setDropTarget({ stage, beforeId: null });
                }}
                onDrop={(e) => drop(e, stage)}
                className={`flex min-h-64 flex-col border-2 border-t-[6px] border-line ${stageAccent[stage]} ${showDrop ? "bg-subtle" : "bg-white"}`}
              >
                <header className="border-b-2 border-line px-3 py-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="text-lg">{dealStageLabel[stage]}</h2>
                    <span className="text-xs text-muted">{list.length}</span>
                  </div>
                  <div className="text-xs text-muted">
                    {formatEuro(sum)}
                    {isOpen(stage) && sum > 0 && <> · gewogen {formatEuro(list.reduce((s, d) => s + weighted(d), 0))}</>}
                  </div>
                </header>
                <ol className="flex flex-1 flex-col gap-2 p-2">
                  {list.map((d) => (
                    <li
                      key={d.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", d.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDragId(d.id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setDropTarget(null);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        const after = e.clientY > rect.top + rect.height / 2;
                        const idx = list.indexOf(d);
                        const beforeId = after ? (list[idx + 1]?.id ?? null) : d.id;
                        if (dropTarget?.stage !== stage || dropTarget.beforeId !== beforeId) setDropTarget({ stage, beforeId });
                      }}
                      onClick={() => setDialog({ deal: d })}
                      className={`relative cursor-grab border-2 border-line bg-white p-3 text-sm hover:border-brand ${dragId === d.id ? "opacity-40" : ""}`}
                    >
                      {dragId && dropTarget?.stage === stage && dropTarget.beforeId === d.id && (
                        <div className="absolute -top-[7px] right-0 left-0 h-[4px] bg-magenta" />
                      )}
                      <div className="font-bold text-ink">{d.title}</div>
                      <div className="text-muted">{d.organizationName}</div>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 text-xs">
                        <span className="font-bold text-brand">{formatEuro(d.valueCents)}</span>
                        {isOpen(stage) && <span className="text-muted">{Math.round(d.probability * 100)}%</span>}
                      </div>
                      {(d.expectedCloseDate || d.ownerName) && (
                        <div className="mt-1 text-xs text-muted">
                          {d.expectedCloseDate && (
                            <span className={isOpen(stage) && d.expectedCloseDate < today() ? "font-bold text-magenta" : ""}>
                              {formatDate(new Date(d.expectedCloseDate).getTime())}
                            </span>
                          )}
                          {d.expectedCloseDate && d.ownerName && " · "}
                          {d.ownerName}
                        </div>
                      )}
                      {stage === "won" && (
                        <div className="mt-1 text-xs">{d.projectId ? "✓ Project aangemaakt" : <span className="text-magenta">Nog geen project</span>}</div>
                      )}
                      {stage === "lost" && d.lostReason && <div className="mt-1 text-xs text-muted italic">{d.lostReason}</div>}
                    </li>
                  ))}
                  {showDrop && dropTarget?.beforeId === null && <li className="h-[4px] bg-magenta" />}
                </ol>
              </section>
            );
          })}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">Sleep kaarten tussen fases, of klik op een kaart om hem te bewerken (op telefoon: fase kiezen in de kaart).</p>

      <Dialog open={!!dialog} title={dialog?.deal ? "Kans bewerken" : "Nieuwe kans"} onClose={() => setDialog(null)}>
        {dialog && <DealForm deal={dialog.deal} onDone={() => setDialog(null)} />}
      </Dialog>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`border-2 border-line p-4 ${accent ? "border-l-[12px] border-l-magenta" : "border-l-[12px] border-l-cyan"}`}>
      <div className="kicker">{label}</div>
      <div className="mt-1 font-serif text-3xl font-semibold text-brand">{value}</div>
    </div>
  );
}
