import type { ReactNode } from "react";

export function PageHeader({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mb-8">
      <div className="kicker border-b border-line pb-2">{kicker}</div>
      <h1 className="mt-4 text-4xl">{title}</h1>
      <div className="brand-bar mt-3" />
    </div>
  );
}

type Accent = "cyan" | "brand" | "magenta";
const accentClass: Record<Accent, string> = {
  cyan: "border-l-cyan",
  brand: "border-l-brand",
  magenta: "border-l-magenta",
};

export function Card({ accent, children }: { accent?: Accent; children: ReactNode }) {
  return (
    <div className={`border-2 border-line bg-white p-5 ${accent ? `border-l-[12px] ${accentClass[accent]}` : ""}`}>
      {children}
    </div>
  );
}
