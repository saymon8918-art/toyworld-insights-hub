import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Bell,
  Boxes,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Database,
  LayoutDashboard,
  MapPin,
  Menu,
  MoreHorizontal,
  PackageCheck,
  PackageOpen,
  Search,
  Settings,
  ShoppingBag,
  Sparkles,
  Store,
  TrendingUp,
  Users,
  X,
} from "lucide-react";

type TrendPeriod = "Daily" | "Weekly" | "Monthly";
type OrderStatus = "All" | "Completed" | "Processing" | "Pending";

const trendData: Record<TrendPeriod, Array<{ label: string; sales: number; target: number }>> = {
  Daily: [
    { label: "Mon", sales: 8200, target: 7000 }, { label: "Tue", sales: 9400, target: 7600 },
    { label: "Wed", sales: 7800, target: 8200 }, { label: "Thu", sales: 11200, target: 8800 },
    { label: "Fri", sales: 12600, target: 9500 }, { label: "Sat", sales: 14200, target: 10800 },
    { label: "Sun", sales: 11900, target: 10400 },
  ],
  Weekly: [
    { label: "W1", sales: 52400, target: 48000 }, { label: "W2", sales: 61800, target: 52000 },
    { label: "W3", sales: 57100, target: 55000 }, { label: "W4", sales: 68900, target: 59000 },
    { label: "W5", sales: 74200, target: 62000 },
  ],
  Monthly: [
    { label: "Jan", sales: 186000, target: 174000 }, { label: "Feb", sales: 204000, target: 181000 },
    { label: "Mar", sales: 198000, target: 190000 }, { label: "Apr", sales: 237000, target: 205000 },
    { label: "May", sales: 249000, target: 218000 }, { label: "Jun", sales: 284000, target: 235000 },
  ],
};

const categories = [
  { name: "Building Sets", value: 34, color: "var(--chart-coral)" },
  { name: "Plush Toys", value: 26, color: "var(--chart-teal)" },
  { name: "STEM & Learning", value: 22, color: "var(--chart-yellow)" },
  { name: "Games & Puzzles", value: 18, color: "var(--chart-blue)" },
];

const orders = [
  { id: "#TW-8492", customer: "Maya Thompson", initials: "MT", store: "SoHo, NY", items: 4, total: "$189.40", status: "Completed" as const, date: "Sep 13, 2026" },
  { id: "#TW-8491", customer: "Ethan Williams", initials: "EW", store: "Austin Central", items: 2, total: "$74.95", status: "Processing" as const, date: "Sep 13, 2026" },
  { id: "#TW-8490", customer: "Sophia Chen", initials: "SC", store: "Seattle Market", items: 6, total: "$312.80", status: "Completed" as const, date: "Sep 12, 2026" },
  { id: "#TW-8489", customer: "Noah Garcia", initials: "NG", store: "Miami Beach", items: 1, total: "$42.50", status: "Pending" as const, date: "Sep 12, 2026" },
  { id: "#TW-8488", customer: "Amelia Brooks", initials: "AB", store: "SoHo, NY", items: 3, total: "$128.25", status: "Processing" as const, date: "Sep 12, 2026" },
];

const initialStock = [
  { name: "Galaxy Explorer Set", sku: "BLD-2841", left: 3, color: "coral" },
  { name: "Milo the Moon Bear", sku: "PLH-1049", left: 5, color: "teal" },
  { name: "Junior Science Lab", sku: "STM-3320", left: 7, color: "yellow" },
  { name: "Woodland Train Set", sku: "VEH-2174", left: 8, color: "blue" },
];

const navItems = [
  { label: "Overview", icon: LayoutDashboard }, { label: "Orders", icon: ShoppingBag },
  { label: "Inventory", icon: Boxes }, { label: "Products", icon: PackageOpen },
  { label: "Customers", icon: Users }, { label: "Store locations", icon: Store },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ToyWorld Sales Dashboard" },
      { name: "description", content: "ToyWorld store performance, sales, orders, and inventory dashboard." },
      { property: "og:title", content: "ToyWorld Sales Dashboard" },
      { property: "og:description", content: "Monitor ToyWorld sales, orders, and stock across every store." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [period, setPeriod] = useState<TrendPeriod>("Daily");
  const [status, setStatus] = useState<OrderStatus>("All");
  const [store, setStore] = useState("All locations");
  const [range, setRange] = useState("Sep 7 – Sep 13");
  const [showDates, setShowDates] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [search, setSearch] = useState("");
  const [restocked, setRestocked] = useState<string[]>([]);

  const visibleOrders = useMemo(() => orders.filter((order) => {
    const statusMatch = status === "All" || order.status === status;
    const query = search.trim().toLowerCase();
    const searchMatch = !query || `${order.id} ${order.customer} ${order.store}`.toLowerCase().includes(query);
    return statusMatch && searchMatch;
  }), [search, status]);

  const stockItems = initialStock.filter((item) => !restocked.includes(item.sku));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 ${collapsed ? "w-20" : "w-64"} ${mobileNav ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="flex h-20 items-center justify-between border-b border-sidebar-border px-5">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"><Sparkles className="size-5" /></div>
            {!collapsed && <span className="font-display text-xl font-extrabold">ToyWorld<span className="text-brand">.</span></span>}
          </div>
          <button aria-label="Close navigation" onClick={() => setMobileNav(false)} className="icon-button text-sidebar-muted lg:hidden"><X className="size-5" /></button>
        </div>
        <nav aria-label="Primary navigation" className="flex-1 space-y-1 px-3 py-6">
          {navItems.map(({ label, icon: Icon }, index) => (
            <button key={label} title={collapsed ? label : undefined} className={`nav-item ${index === 0 ? "nav-item-active" : ""}`}>
              <Icon className="size-5 shrink-0" />{!collapsed && <span>{label}</span>}
            </button>
          ))}
          <p className={`px-3 pb-2 pt-7 text-[10px] font-bold uppercase text-sidebar-muted ${collapsed ? "invisible" : ""}`}>Workspace</p>
          <Link to="/data" title={collapsed ? "Data manager" : undefined} className="nav-item"><Database className="size-5 shrink-0" />{!collapsed && <span>Data manager</span>}</Link>
          <button title={collapsed ? "Settings" : undefined} className="nav-item"><Settings className="size-5 shrink-0" />{!collapsed && <span>Settings</span>}</button>
          <button title={collapsed ? "Help center" : undefined} className="nav-item"><CircleHelp className="size-5 shrink-0" />{!collapsed && <span>Help center</span>}</button>
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 rounded-lg p-2">
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-avatar text-sm font-bold text-avatar-foreground">OH</div>
            {!collapsed && <div className="min-w-0"><p className="truncate text-sm font-semibold">Oleksandr Haidai</p><p className="truncate text-xs text-sidebar-muted">Regional manager</p></div>}
          </div>
          <button aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed((value) => !value)} className="mt-2 hidden w-full items-center justify-center rounded-md py-2 text-sidebar-muted transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:flex">
            {collapsed ? <ChevronRight className="size-5" /> : <ChevronLeft className="size-5" />}
          </button>
        </div>
      </aside>

      {mobileNav && <button aria-label="Close navigation overlay" className="fixed inset-0 z-40 bg-overlay lg:hidden" onClick={() => setMobileNav(false)} />}

      <main className={`min-h-screen transition-[margin] duration-300 ${collapsed ? "lg:ml-20" : "lg:ml-64"}`}>
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
          <div className="flex h-20 items-center gap-3 px-4 md:px-7">
            <button aria-label="Open navigation" onClick={() => setMobileNav(true)} className="icon-button lg:hidden"><Menu className="size-5" /></button>
            <label className="relative hidden max-w-md flex-1 sm:block">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search orders, products, customers…" className="h-10 w-full rounded-md border border-input bg-muted/60 pl-10 pr-4 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20" />
            </label>
            <div className="ml-auto flex items-center gap-2">
              <div className="control-wrap hidden md:flex"><MapPin className="size-4 text-muted-foreground" /><select aria-label="Store location" value={store} onChange={(event) => setStore(event.target.value)} className="bg-transparent text-sm font-semibold outline-none"><option>All locations</option><option>SoHo, NY</option><option>Austin Central</option><option>Seattle Market</option><option>Miami Beach</option></select></div>
              <div className="relative hidden sm:block">
                <button onClick={() => setShowDates((value) => !value)} className="control-wrap"><CalendarDays className="size-4 text-muted-foreground" /><span>{range}</span><ChevronDown className="size-3.5 text-muted-foreground" /></button>
                {showDates && <div className="popover right-0 w-52">{["Sep 7 – Sep 13", "Aug 31 – Sep 6", "Aug 14 – Sep 13"].map((item) => <button key={item} onClick={() => { setRange(item); setShowDates(false); }} className={`popover-row ${range === item ? "text-primary" : ""}`}>{item}</button>)}</div>}
              </div>
              <div className="relative">
                <button aria-label="Notifications" onClick={() => setShowNotifications((value) => !value)} className="icon-button relative"><Bell className="size-5" /><span className="absolute right-2 top-2 size-2 rounded-full bg-brand ring-2 ring-background" /></button>
                {showNotifications && <div className="popover right-0 w-72"><p className="px-3 py-2 text-sm font-bold">Notifications</p><div className="border-t border-border p-3"><p className="text-sm font-semibold">4 inventory items need attention</p><p className="mt-1 text-xs text-muted-foreground">Review stock levels before tomorrow’s opening.</p></div></div>}
              </div>
            </div>
          </div>
          <div className="flex gap-2 px-4 pb-3 sm:hidden">
            <label className="relative flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search orders…" className="h-10 w-full rounded-md border border-input bg-muted/60 pl-10 pr-3 text-sm outline-none" /></label>
          </div>
        </header>

        <div className="mx-auto max-w-[1600px] px-4 py-7 md:px-7 md:py-9">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div><p className="mb-1 text-sm font-semibold text-brand">Sunday, September 13</p><h1 className="font-display text-3xl font-extrabold md:text-4xl">Good afternoon, Oleksandr</h1><p className="mt-2 text-sm text-muted-foreground">Here’s what’s happening across {store.toLowerCase()} today.</p></div>
            <button className="primary-button"><PackageCheck className="size-4" />Export report</button>
          </div>

          <section aria-label="Key metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Total revenue" value="$284,920" change="12.4%" icon={<TrendingUp className="size-5" />} tone="coral">
              <svg viewBox="0 0 116 36" className="h-9 w-28" role="img" aria-label="Revenue trending upward"><path d="M2 30 C15 26 19 29 29 21 S48 24 57 15 S75 20 85 10 S103 13 114 3" fill="none" stroke="var(--brand)" strokeWidth="3" strokeLinecap="round" /></svg>
            </MetricCard>
            <MetricCard title="Total toys sold" value="18,642" change="8.7%" icon={<ShoppingBag className="size-5" />} tone="teal"><p className="text-xs text-muted-foreground">1,284 this week</p></MetricCard>
            <MetricCard title="Active store locations" value="24" change="2 new" icon={<Store className="size-5" />} tone="blue"><p className="text-xs text-muted-foreground">Across 11 cities</p></MetricCard>
            <MetricCard title="Top selling category" value="Building Sets" change="34%" icon={<Boxes className="size-5" />} tone="yellow"><p className="text-xs text-muted-foreground">of total sales</p></MetricCard>
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.75fr)_minmax(300px,0.75fr)]">
            <div className="panel min-w-0">
              <div className="panel-heading"><div><h2>Sales trend</h2><p>Revenue performance against target</p></div><div className="segmented">{(["Daily", "Weekly", "Monthly"] as TrendPeriod[]).map((item) => <button key={item} onClick={() => setPeriod(item)} className={period === item ? "segmented-active" : ""}>{item}</button>)}</div></div>
              <div className="mt-6 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  {period === "Monthly" ? <BarChart data={trendData[period]} barGap={2}><CartesianGrid stroke="var(--chart-grid)" vertical={false} /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} /><YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `$${v / 1000}k`} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} /><Tooltip content={<ChartTooltip />} /><Bar dataKey="target" fill="var(--chart-target)" radius={[4, 4, 0, 0]} /><Bar dataKey="sales" fill="var(--brand)" radius={[4, 4, 0, 0]} /></BarChart> : <AreaChart data={trendData[period]}><defs><linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--brand)" stopOpacity={0.24} /><stop offset="100%" stopColor="var(--brand)" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="var(--chart-grid)" vertical={false} /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} /><YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `$${v / 1000}k`} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} /><Tooltip content={<ChartTooltip />} /><Area type="monotone" dataKey="target" stroke="var(--chart-target)" strokeDasharray="5 5" fill="none" strokeWidth={2} /><Area type="monotone" dataKey="sales" stroke="var(--brand)" fill="url(#salesFill)" strokeWidth={3} /></AreaChart>}
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex justify-center gap-5 text-xs text-muted-foreground"><span className="flex items-center gap-2"><i className="size-2.5 rounded-full bg-brand" />Sales</span><span className="flex items-center gap-2"><i className="size-2.5 rounded-full bg-chart-target" />Target</span></div>
            </div>
            <div className="panel">
              <div className="panel-heading"><div><h2>Sales by category</h2><p>This month’s revenue mix</p></div><button aria-label="Category chart options" className="icon-button"><MoreHorizontal className="size-5" /></button></div>
              <div className="relative mx-auto mt-5 h-48 max-w-60"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={categories} dataKey="value" innerRadius={58} outerRadius={82} paddingAngle={3} stroke="none">{categories.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip formatter={(value) => [`${value}%`, "Share"]} /></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 grid place-items-center text-center"><div><strong className="font-display text-2xl">$284.9K</strong><p className="text-xs text-muted-foreground">Total sales</p></div></div></div>
              <div className="mt-4 space-y-3">{categories.map((category) => <div key={category.name} className="flex items-center gap-3 text-sm"><span className="size-2.5 rounded-sm" style={{ backgroundColor: category.color }} /><span className="flex-1 text-muted-foreground">{category.name}</span><strong>{category.value}%</strong></div>)}</div>
            </div>
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.75fr)_minmax(320px,0.75fr)]">
            <div className="panel overflow-hidden p-0">
              <div className="panel-heading border-b border-border p-5 md:p-6"><div><h2>Recent orders</h2><p>Latest purchases across your stores</p></div><div className="segmented">{(["All", "Completed", "Processing", "Pending"] as OrderStatus[]).map((item) => <button key={item} onClick={() => setStatus(item)} className={status === item ? "segmented-active" : ""}>{item}</button>)}</div></div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground"><th>Order</th><th>Customer</th><th>Store</th><th>Items</th><th>Total</th><th>Status</th><th>Date</th></tr></thead><tbody>{visibleOrders.map((order) => <tr key={order.id} className="border-b border-border last:border-0 hover:bg-muted/30"><td className="font-bold">{order.id}</td><td><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-full bg-muted text-[11px] font-bold">{order.initials}</span>{order.customer}</div></td><td className="text-muted-foreground">{order.store}</td><td>{order.items}</td><td className="font-semibold">{order.total}</td><td><span className={`status status-${order.status.toLowerCase()}`}>{order.status}</span></td><td className="text-muted-foreground">{order.date}</td></tr>)}</tbody></table>
                {visibleOrders.length === 0 && <div className="py-12 text-center text-sm text-muted-foreground">No matching orders found.</div>}
              </div>
              <div className="flex items-center justify-between border-t border-border px-5 py-4 text-sm"><span className="text-muted-foreground">Showing {visibleOrders.length} of {orders.length} orders</span><button className="font-bold text-primary hover:underline">View all orders</button></div>
            </div>

            <div className="panel p-0">
              <div className="panel-heading border-b border-border p-5 md:p-6"><div><div className="flex items-center gap-2"><h2>Low stock</h2>{stockItems.length > 0 && <span className="rounded-full bg-destructive-soft px-2 py-0.5 text-xs font-bold text-destructive">{stockItems.length}</span>}</div><p>Items that need your attention</p></div></div>
              <div className="divide-y divide-border">{stockItems.map((item) => <div key={item.sku} className="flex items-center gap-3 p-4"><div className={`stock-thumb stock-${item.color}`}><PackageOpen className="size-5" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{item.name}</p><p className="text-xs text-muted-foreground">{item.sku} · <span className="font-semibold text-destructive">{item.left} left</span></p></div><button onClick={() => setRestocked((items) => [...items, item.sku])} className="secondary-button">Restock</button></div>)}{stockItems.length === 0 && <div className="px-5 py-12 text-center"><PackageCheck className="mx-auto size-8 text-success" /><p className="mt-3 text-sm font-bold">Inventory looks healthy</p><p className="mt-1 text-xs text-muted-foreground">All alerts have been handled.</p></div>}</div>
              {stockItems.length > 0 && <div className="border-t border-border p-4"><button className="w-full text-sm font-bold text-primary hover:underline">Open inventory</button></div>}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function MetricCard({ title, value, change, icon, tone, children }: { title: string; value: string; change: string; icon: React.ReactNode; tone: string; children: React.ReactNode }) {
  return <article className="metric-card"><div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-muted-foreground">{title}</p><p className="mt-2 font-display text-2xl font-extrabold">{value}</p></div><span className={`metric-icon metric-${tone}`}>{icon}</span></div><div className="mt-5 flex min-h-9 items-end justify-between gap-3"><div><span className="text-xs font-bold text-success">↑ {change}</span><span className="ml-1 text-xs text-muted-foreground">vs last period</span></div>{children}</div></article>;
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-md border border-border bg-popover p-3 text-xs shadow-lg"><p className="mb-2 font-bold">{label}</p>{payload.map((item) => <p key={item.name} style={{ color: item.color }} className="font-semibold capitalize">{item.name}: ${item.value.toLocaleString()}</p>)}</div>;
}