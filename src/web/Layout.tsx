import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { Building2, CheckSquare, FolderKanban, LayoutDashboard, Menu, TrendingUp, X, type LucideIcon } from "lucide-react";

const nav: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/klanten", label: "Klanten", icon: Building2 },
  { to: "/pipeline", label: "Pipeline", icon: TrendingUp },
  { to: "/projecten", label: "Projecten", icon: FolderKanban },
  { to: "/mijn-werk", label: "Mijn werk", icon: CheckSquare },
];

function Brand() {
  return (
    <a href="/" className="flex items-baseline gap-2 px-2">
      <span className="font-serif text-2xl font-semibold tracking-wide text-brand">DEPLOY</span>
      <span className="kicker">Werkruimte</span>
    </a>
  );
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="grid gap-1">
      {nav.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive ? "bg-brand-soft text-brand" : "text-muted hover:bg-subtle hover:text-ink"
            }`
          }
        >
          {({ isActive }) => (
            <>
              {isActive && <span className="absolute top-2 bottom-2 -left-3 w-[3px] rounded-r bg-magenta" />}
              <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export function Layout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <div className="min-h-screen lg:pl-64">
      {/* Zijbalk (laptop) */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-line bg-white px-3 py-6 lg:flex">
        <Brand />
        <div className="mt-8 flex-1">
          <NavItems />
        </div>
        <div className="px-2 text-xs text-label">DEPLOY Consultancy</div>
      </aside>

      {/* Bovenbalk (telefoon/tablet) */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <Brand />
        <button className="rounded-lg p-2 text-ink hover:bg-subtle" onClick={() => setOpen(true)} aria-label="Menu openen">
          <Menu size={20} />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white px-3 py-5 shadow-pop">
            <div className="flex items-center justify-between">
              <Brand />
              <button className="rounded-lg p-2 text-muted hover:bg-subtle" onClick={() => setOpen(false)} aria-label="Menu sluiten">
                <X size={20} />
              </button>
            </div>
            <div className="mt-6">
              <NavItems onNavigate={() => setOpen(false)} />
            </div>
          </aside>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <Outlet />
      </main>
    </div>
  );
}
