import { useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

/** Titel in het browsertabblad. */
export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · DEPLOY Werkruimte` : "DEPLOY Werkruimte";
  }, [title]);
}

export function PageHeader({ kicker, title, actions }: { kicker: string; title: string; actions?: ReactNode }) {
  useDocumentTitle(title);
  return (
    <div className="mb-8">
      <div className="kicker border-b border-line pb-2">{kicker}</div>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">{title}</h1>
          <div className="brand-bar mt-3" />
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

type Accent = "cyan" | "brand" | "magenta";
const accentClass: Record<Accent, string> = {
  cyan: "border-l-cyan",
  brand: "border-l-brand",
  magenta: "border-l-magenta",
};

export function Card({ accent, title, actions, children }: { accent?: Accent; title?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className={`border-2 border-line bg-white p-5 ${accent ? `border-l-[12px] ${accentClass[accent]}` : ""}`}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && <h2 className="text-xl">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

type ButtonVariant = "primary" | "secondary" | "danger" | "link";
const buttonClass: Record<ButtonVariant, string> = {
  primary: "border-2 border-brand bg-brand px-4 py-2 text-white hover:bg-ink hover:border-ink",
  secondary: "border-2 border-brand bg-white px-4 py-2 text-brand hover:bg-subtle",
  danger: "border-2 border-magenta bg-white px-4 py-2 text-magenta hover:bg-subtle",
  link: "px-1 text-brand underline-offset-2 hover:underline",
};

export function Button({ variant = "primary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      className={`text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50 ${buttonClass[variant]} ${className}`}
      {...props}
    />
  );
}

const fieldClass = "w-full border-2 border-line bg-white px-3 py-2 text-ink focus:border-brand focus:outline-none";

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold text-ink">{label}</span>
      {children}
      {error && <span className="mt-1 block text-sm text-magenta">{error}</span>}
    </label>
  );
}

export const Input = (props: InputHTMLAttributes<HTMLInputElement>) => <input className={fieldClass} {...props} />;
export const Textarea = (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea className={fieldClass} rows={3} {...props} />;
export const Select = (props: SelectHTMLAttributes<HTMLSelectElement>) => <select className={fieldClass} {...props} />;

export function Chip({ tone = "brand", children }: { tone?: "brand" | "magenta" | "muted"; children: ReactNode }) {
  const tones = { brand: "border-brand text-brand", magenta: "border-magenta text-magenta", muted: "border-line text-muted" };
  return <span className={`inline-block border-2 px-2 py-0.5 text-xs font-bold ${tones[tone]}`}>{children}</span>;
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
      className="m-auto w-[min(640px,calc(100vw-32px))] border-2 border-line bg-white p-0 text-ink backdrop:bg-ink/40"
    >
      {open && (
        <div className="p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <h2 className="text-2xl">{title}</h2>
            <button type="button" onClick={onClose} className="text-2xl leading-none text-muted hover:text-brand" aria-label="Sluiten">
              ×
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="border-2 border-dashed border-line p-6 text-center text-muted">{children}</p>;
}

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null;
  return <p className="text-sm text-magenta">{error instanceof Error ? error.message : "Er ging iets mis"}</p>;
}

const dateFmt = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
export const formatDate = (ms: number | null | undefined) => (ms ? dateFmt.format(ms) : "—");
export const formatDateTime = (ms: number) => dateTimeFmt.format(ms);
