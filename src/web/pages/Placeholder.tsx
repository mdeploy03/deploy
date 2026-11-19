import { Link, useRouteError } from "react-router";
import { PageHeader, useDocumentTitle } from "../ui";

export function NotFound() {
  useDocumentTitle("Niet gevonden");
  return (
    <div>
      <PageHeader kicker="DEPLOY Werkruimte" title="Pagina niet gevonden" />
      <p className="text-muted">
        Deze pagina bestaat niet (meer).{" "}
        <Link to="/" className="text-brand hover:underline">
          Terug naar het dashboard
        </Link>
      </p>
    </div>
  );
}

/** Getoond als een pagina onverwacht vastloopt. */
export function ErrorPage() {
  const error = useRouteError();
  console.error(error);
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="kicker border-b border-line pb-2">DEPLOY Werkruimte</div>
      <h1 className="mt-4 text-4xl">Er ging iets mis</h1>
      <div className="brand-bar mt-3" />
      <p className="mt-6 text-muted">
        Probeer de pagina opnieuw te laden. Blijft het misgaan, meld dan wat je deed vlak voordat dit scherm verscheen.
      </p>
      <a href="/" className="mt-4 inline-block font-semibold text-brand hover:underline">
        Naar het dashboard
      </a>
    </div>
  );
}
