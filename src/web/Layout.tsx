import { NavLink, Outlet } from "react-router";

const nav = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/klanten", label: "Klanten" },
  { to: "/pipeline", label: "Pipeline" },
  { to: "/projecten", label: "Projecten" },
  { to: "/mijn-werk", label: "Mijn werk" },
];

export function Layout() {
  return (
    <div className="min-h-screen">
      <header className="border-b-2 border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <a href="/" className="flex items-baseline gap-2">
            <span className="font-serif text-2xl font-semibold tracking-wide text-brand">DEPLOY</span>
            <span className="kicker">Werkruimte</span>
          </a>
          <nav className="-mx-4 flex w-[calc(100%+2rem)] gap-1 overflow-x-auto px-4 text-sm whitespace-nowrap sm:mx-0 sm:w-auto sm:px-0">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `border-b-2 px-3 py-1.5 ${
                    isActive ? "border-magenta text-brand" : "border-transparent text-muted hover:text-brand"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
