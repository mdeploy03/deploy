import { useQuery } from "@tanstack/react-query";
import { Card, PageHeader } from "../ui";

type Health = { ok: boolean; environment: string; db: boolean };

export function Dashboard() {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: async (): Promise<Health> => {
      const res = await fetch("/api/health");
      return res.json();
    },
  });

  const blocks = [
    { accent: "cyan" as const, title: "Open kansen", text: "Pipelinewaarde en gewogen waarde verschijnen hier in stap 4." },
    { accent: "brand" as const, title: "Actieve projecten", text: "Lopende projecten verschijnen hier in stap 5." },
    { accent: "magenta" as const, title: "Deadlines deze week", text: "Je taken met een deadline deze week verschijnen hier in stap 5." },
  ];

  return (
    <div>
      <PageHeader kicker="Overzicht" title="Dashboard" />
      <div className="grid gap-4 md:grid-cols-3">
        {blocks.map((b) => (
          <Card key={b.title} accent={b.accent}>
            <h2 className="text-xl">{b.title}</h2>
            <p className="mt-2 text-sm text-muted">{b.text}</p>
          </Card>
        ))}
      </div>
      <p className="mt-10 text-sm text-muted">
        Systeemstatus:{" "}
        {health.isPending
          ? "controleren…"
          : health.data?.ok
            ? `in orde (${health.data.environment})`
            : "database niet bereikbaar"}
      </p>
    </div>
  );
}
