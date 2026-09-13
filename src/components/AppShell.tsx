import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Database,
  LayoutDashboard,
  Menu,
  PackageSearch,
  Settings,
  Sparkles,
  TrendingUp,
  Warehouse,
  X,
} from "lucide-react";

const navItems = [
  { label: "Overview", to: "/", icon: LayoutDashboard },
  { label: "Category profit", to: "/profit", icon: TrendingUp },
  { label: "Availability & losses", to: "/availability", icon: PackageSearch },
  { label: "Cash in inventory", to: "/inventory", icon: Warehouse },
] as const;

export function AppShell({
  title,
  subtitle,
  eyebrow,
  controls,
  children,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  controls?: ReactNode;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 ${collapsed ? "w-20" : "w-64"} ${mobileNav ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <div className="flex h-20 items-center justify-between border-b border-sidebar-border px-5">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <Sparkles className="size-5" />
            </div>
            {!collapsed && (
              <span className="font-display text-xl font-extrabold">
                ToyWorld<span className="text-brand">.</span>
              </span>
            )}
          </div>
          <button aria-label="Close menu" onClick={() => setMobileNav(false)} className="icon-button text-sidebar-muted lg:hidden">
            <X className="size-5" />
          </button>
        </div>
        <nav aria-label="Main navigation" className="flex-1 space-y-1 overflow-y-auto px-3 py-6">
          {navItems.map(({ label, to, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              onClick={() => setMobileNav(false)}
              className={`nav-item ${pathname === to ? "nav-item-active" : ""}`}
            >
              <Icon className="size-5 shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          ))}
          <p className={`px-3 pb-2 pt-7 text-[10px] font-bold uppercase text-sidebar-muted ${collapsed ? "invisible" : ""}`}>
            Workspace
          </p>
          <Link to="/data" title={collapsed ? "Data" : undefined} className={`nav-item ${pathname === "/data" ? "nav-item-active" : ""}`}>
            <Database className="size-5 shrink-0" />
            {!collapsed && <span>Data & import</span>}
          </Link>
          <button title={collapsed ? "Settings" : undefined} className="nav-item">
            <Settings className="size-5 shrink-0" />
            {!collapsed && <span>Settings</span>}
          </button>
          <button title={collapsed ? "Help" : undefined} className="nav-item">
            <CircleHelp className="size-5 shrink-0" />
            {!collapsed && <span>Help</span>}
          </button>
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 rounded-lg p-2">
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-avatar text-sm font-bold text-avatar-foreground">OH</div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">Oleksandr Haidai</p>
                <p className="truncate text-xs text-sidebar-muted">Regional manager</p>
              </div>
            )}
          </div>
          <button
            aria-label={collapsed ? "Expand menu" : "Collapse menu"}
            onClick={() => setCollapsed((value) => !value)}
            className="mt-2 hidden w-full items-center justify-center rounded-md py-2 text-sidebar-muted transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:flex"
          >
            {collapsed ? <ChevronRight className="size-5" /> : <ChevronLeft className="size-5" />}
          </button>
        </div>
      </aside>

      {mobileNav && <button aria-label="Close menu" className="fixed inset-0 z-40 bg-overlay lg:hidden" onClick={() => setMobileNav(false)} />}

      <main className={`min-h-screen transition-[margin] duration-300 ${collapsed ? "lg:ml-20" : "lg:ml-64"}`}>
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
          <div className="flex min-h-20 flex-wrap items-center gap-3 px-4 py-3 md:px-7">
            <button aria-label="Open menu" onClick={() => setMobileNav(true)} className="icon-button lg:hidden">
              <Menu className="size-5" />
            </button>
            <div className="min-w-0 flex-1">
              {eyebrow && <p className="text-xs font-bold uppercase tracking-wide text-brand">{eyebrow}</p>}
              <h1 className="font-display text-xl font-extrabold md:text-2xl">{title}</h1>
            </div>
            {controls && <div className="flex flex-wrap items-center gap-2">{controls}</div>}
          </div>
        </header>

        <div className="mx-auto max-w-[1600px] px-4 py-7 md:px-7 md:py-9">
          {subtitle && <p className="mb-6 max-w-3xl text-sm text-muted-foreground">{subtitle}</p>}
          {children}
        </div>
      </main>
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "coral",
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
  icon?: ReactNode;
}) {
  return (
    <article className="metric-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-muted-foreground">{label}</p>
          <p className="mt-2 font-display text-2xl font-extrabold">{value}</p>
        </div>
        {icon && <span className={`metric-icon metric-${tone}`}>{icon}</span>}
      </div>
      {hint && <p className="mt-4 text-xs text-muted-foreground">{hint}</p>}
    </article>
  );
}
