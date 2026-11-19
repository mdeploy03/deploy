import { useDeferredValue, useMemo, useState, type DragEvent } from "react";
import { DEAL_STAGES, dealStageLabel, formatEuro, OPEN_STAGES, type DealListItem, type DealStage } from "../../shared/deals";
import { DealForm } from "../crm/DealForm";
import { useDeals, useMoveDeal } from "../crm/dealHooks";
import { useUsers } from "../crm/hooks";
import { CalendarDays, Plus, Scale, Target, Wallet } from "lucide-react";
import { Button, Dialog, ErrorText, PageHeader, SearchInput, Select, Stat, cardClass, formatDate } from "../ui";

const stageDot: Record<DealStage, string> = {
  lead: "bg-label",
  qualified: "bg-cyan",
  proposal: "bg-cyan",
  negotiation: "bg-brand",
  won: "bg-brand",
  lost: "bg-magenta",
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
      <PageHeader kicker="Sales" title="Pipeline" actions={<Button icon={Plus} onClick={() => setDialog({})}>Nieuwe kans</Button>} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className={`${cardClass} p-5`}>
          <Stat icon={Target} accent="cyan" label="Open kansen" value={String(totals.count)} />
        </div>
        <div className={`${cardClass} p-5`}>
          <Stat icon={Wallet} accent="brand" label="Pipelinewaarde" value={formatEuro(totals.value)} />
        </div>
        <div className={`${cardClass} p-5`}>
          <Stat icon={Scale} accent="magenta" label="Gewogen waarde" value={formatEuro(totals.weighted)} sub="waarde × slagingskans" />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-80">
          <SearchInput placeholder="Zoek op titel of klant…" value={q} onChange={(e) => setQ(e.target.value)} />
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

      <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
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
                className={`flex min-h-72 flex-col rounded-xl transition-colors ${showDrop ? "bg-brand-soft ring-2 ring-brand/30" : "bg-[#eef2f7]"}`}
              >
                <header className="px-3 pt-3 pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="flex items-center gap-2 font-sans text-sm font-semibold">
                      <span className={`h-2 w-2 rounded-full ${stageDot[stage]}`} />
                      {dealStageLabel[stage]}
                    </h2>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-muted">{list.length}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted tabular-nums">
                    {formatEuro(sum)}
                    {isOpen(stage) && sum > 0 && <> · gewogen {formatEuro(list.reduce((s, d) => s + weighted(d), 0))}</>}
                  </div>
                </header>
                <ol className="flex flex-1 flex-col gap-2 px-2 pb-2">
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
                      className={`relative cursor-grab rounded-lg border border-line bg-white p-3 text-sm shadow-card transition-shadow hover:shadow-pop active:cursor-grabbing ${dragId === d.id ? "opacity-40" : ""}`}
                    >
                      {dragId && dropTarget?.stage === stage && dropTarget.beforeId === d.id && (
                        <div className="absolute -top-[6px] right-1 left-1 h-[3px] rounded-full bg-magenta" />
                      )}
                      <div className="font-semibold text-ink">{d.title}</div>
                      <div className="text-xs text-muted">{d.organizationName}</div>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 text-xs">
                        <span className="font-semibold text-ink tabular-nums">{formatEuro(d.valueCents)}</span>
                        {isOpen(stage) && <span className="rounded-full bg-subtle px-1.5 py-0.5 text-[11px] font-semibold text-muted">{Math.round(d.probability * 100)}%</span>}
                      </div>
                      {(d.expectedCloseDate || d.ownerName) && (
                        <div className="mt-1.5 flex items-center gap-1 text-xs text-muted">
                          {d.expectedCloseDate && <CalendarDays size={12} className="shrink-0" />}
                          {d.expectedCloseDate && (
                            <span className={isOpen(stage) && d.expectedCloseDate < today() ? "font-semibold text-magenta" : ""}>
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
                  {showDrop && dropTarget?.beforeId === null && <li className="mx-1 h-[3px] rounded-full bg-magenta" />}
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
