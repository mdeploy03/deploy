import { useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Search, X } from "lucide-react";
import { Link } from "react-router";

/** Titel in het browsertabblad. */
export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · DEPLOY Werkruimte` : "DEPLOY Werkruimte";
  }, [title]);
}

export function PageHeader({ kicker, title, actions, meta }: { kicker: ReactNode; title: string; actions?: ReactNode; meta?: ReactNode }) {
  useDocumentTitle(title);
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <div className="kicker">{kicker}</div>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl sm:text-4xl">{title}</h1>
          {meta}
        </div>
        <div className="brand-bar mt-3" />
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export type Accent = "cyan" | "brand" | "magenta";
export const accentSoft: Record<Accent, string> = {
  cyan: "bg-cyan-soft text-[#138a9b]",
  brand: "bg-brand-soft text-brand",
  magenta: "bg-magenta-soft text-magenta",
};

export const cardClass = "rounded-xl border border-line bg-white shadow-card";

export function Card({
  accent = "brand",
  icon: Icon,
  title,
  actions,
  children,
  className = "",
}: {
  accent?: Accent;
  icon?: LucideIcon;
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${cardClass} p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {Icon && (
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${accentSoft[accent]}`}>
                <Icon size={16} strokeWidth={2} />
              </span>
            )}
            {title && <h2 className="truncate text-xl">{title}</h2>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "link";
const buttonClass: Record<ButtonVariant, string> = {
  primary: "rounded-lg bg-brand px-4 py-2 text-white shadow-card hover:bg-brand-dark",
  secondary: "rounded-lg border border-line bg-white px-4 py-2 text-ink shadow-card hover:border-[#cdd5df] hover:bg-subtle",
  danger: "rounded-lg border border-line bg-white px-4 py-2 text-magenta shadow-card hover:border-magenta/40 hover:bg-magenta-soft",
  ghost: "rounded-lg px-2.5 py-1.5 text-brand hover:bg-brand-soft",
  link: "px-1 text-brand underline-offset-2 hover:underline",
};

export function Button({
  variant = "primary",
  icon: Icon,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; icon?: LucideIcon }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${buttonClass[variant]} ${className}`}
      {...props}
    >
      {Icon && <Icon size={16} strokeWidth={2.2} />}
      {children}
    </button>
  );
}

const fieldClass =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink shadow-[inset_0_1px_1px_rgb(31_51_80/0.03)] transition-colors placeholder:text-label hover:border-[#cdd5df] focus:border-brand focus:ring-3 focus:ring-brand/15 focus:outline-none disabled:bg-subtle disabled:text-muted";

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-muted">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs font-medium text-magenta">{error}</span>}
    </label>
  );
}

export const Input = ({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) => (
  <input className={`${fieldClass} ${className}`} {...props} />
);
export const Textarea = (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea className={fieldClass} rows={3} {...props} />;
export const Select = (props: SelectHTMLAttributes<HTMLSelectElement>) => <select className={fieldClass} {...props} />;

/** Zoekveld met vergrootglas. */
export function SearchInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-label" />
      <Input type="search" className="pl-9" {...props} />
    </div>
  );
}

/** Gesegmenteerde keuze, bijv. statusfilters of Bord/Lijst. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly (readonly [T, ReactNode])[];
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg border border-line bg-white p-1 shadow-card">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${value === v ? "bg-brand text-white shadow-card" : "text-muted hover:bg-subtle hover:text-ink"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function Chip({ tone = "brand", children }: { tone?: "brand" | "magenta" | "cyan" | "muted"; children: ReactNode }) {
  const tones = {
    brand: "bg-brand-soft text-brand",
    magenta: "bg-magenta-soft text-magenta",
    cyan: "bg-cyan-soft text-[#138a9b]",
    muted: "bg-subtle text-muted ring-1 ring-line ring-inset",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${tones[tone]}`}>{children}</span>;
}

/** Kerncijfer-tegel. */
export function Stat({ label, value, sub, icon: Icon, accent = "brand", alert }: { label: string; value: string; sub?: string; icon?: LucideIcon; accent?: Accent; alert?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="kicker">{label}</div>
        <div className={`mt-1.5 font-serif text-3xl font-semibold ${alert ? "text-magenta" : "text-ink"}`}>{value}</div>
        {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
      </div>
      {Icon && (
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${accentSoft[alert ? "magenta" : accent]}`}>
          <Icon size={18} />
        </span>
      )}
    </div>
  );
}

export function Dialog({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      // showModal zet de focus op het eerste knopje (sluiten); liever het eerste invulveld.
      d.querySelector<HTMLElement>("[autofocus], input, textarea, select")?.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-[min(640px,calc(100vw-32px))] rounded-2xl border border-line bg-white p-0 text-ink shadow-pop backdrop:bg-ink/30 backdrop:backdrop-blur-[2px]"
    >
      {open && (
        <div className="p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <h2 className="text-2xl">{title}</h2>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-subtle hover:text-ink" aria-label="Sluiten">
              <X size={18} />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function Empty({ icon: Icon, children }: { icon?: LucideIcon; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-[#cdd5df] bg-white/60 px-6 py-10 text-center text-sm text-muted">
      {Icon && (
        <span className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand">
          <Icon size={18} />
        </span>
      )}
      {children}
    </div>
  );
}

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p className="rounded-lg bg-magenta-soft px-3 py-2 text-sm font-medium text-magenta">
      {error instanceof Error ? error.message : "Er ging iets mis"}
    </p>
  );
}

/** Dunne voortgangsbalk. */
export function Progress({ value, tone = "brand" }: { value: number; tone?: "brand" | "cyan" }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-subtle ring-1 ring-line ring-inset">
      <div className={`h-full rounded-full ${tone === "cyan" ? "bg-cyan" : "bg-brand"}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/** Tabelopmaak, gedeeld door de lijsten. */
export const table = {
  wrap: `${cardClass} overflow-x-auto`,
  table: "w-full text-left text-sm",
  head: "border-b border-line bg-subtle/60 text-xs font-semibold tracking-wide text-muted uppercase",
  th: "px-4 py-3 font-semibold",
  row: "cursor-pointer border-b border-line last:border-0 transition-colors hover:bg-brand-soft/40",
  td: "px-4 py-3",
};

/** Kop van een detailpagina met een link terug naar het overzicht. */
export function DetailHeader({
  back,
  title,
  meta,
  actions,
}: {
  back: { to: string; label: string };
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <Link to={back.to} className="kicker inline-flex items-center gap-1 hover:text-brand">
          <ArrowLeft size={12} /> {back.label}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl sm:text-4xl">{title}</h1>
          {meta}
        </div>
        <div className="brand-bar mt-3" />
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Gegevenslijst (label / waarde) voor detailpagina's. */
export function InfoList({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(110px,auto)_1fr] gap-x-4 gap-y-2.5 text-sm">
      {items.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted">{label}</dt>
          <dd className="min-w-0 text-ink">{value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

const dateFmt = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
export const formatDate = (ms: number | null | undefined) => (ms ? dateFmt.format(ms) : "—");
export const formatDateTime = (ms: number) => dateTimeFmt.format(ms);
