import { PageHeader } from "../ui";

export function Placeholder({ title, step }: { title: string; step?: string }) {
  return (
    <div>
      <PageHeader kicker="DEPLOY Werkruimte" title={title} />
      <p className="text-muted">{step ? `Dit onderdeel komt in ${step} van de bouw.` : "Deze pagina bestaat niet."}</p>
    </div>
  );
}
