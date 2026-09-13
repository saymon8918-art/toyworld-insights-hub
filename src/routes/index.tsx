import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
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
  Loader2,
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
  
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type TrendPeriod = "Daily" | "Weekly" | "Monthly";
type RangeKey = "7" | "30" | "90" | "all";

type Kpis = {
  revenue: number;
  units: number;
  order_count: number;
  store_count: number;
  top_category: string | null;
  top_category_share: number;
  prev_revenue: number;
  prev_units: number;
};
type TrendRow = { bucket: string; label: string; sales: number; units: number };
type CategoryRow = { category: string; revenue: number; units: number };
type SaleRow = {
  sale_id: number;
  sale_date: string;
  store_name: string;
  store_city: string;
  product_name: string;
  product_category: string;
  units: number;
  total: number;
};
type StockRow = {
  store_id: number;
  product_id: number;
  product_name: string;
  product_category: string;
  store_name: string;
  store_city: string;
  stock_on_hand: number;
};
type Bounds = { min_date: string | null; max_date: string | null; sale_rows: number };
type StoreOption = { store_id: number; store_name: string; store_city: string };

const grainByPeriod: Record<TrendPeriod, string> = { Daily: "day", Weekly: "week", Monthly: "month" };
const rangeLabels: Record<RangeKey, string> = {
  "7": "Last 7 days",
  "30": "Last 30 days",
  "90": "Last 90 days",
  all: "All time",
};
const donutColors = ["var(--chart-coral)", "var(--chart-teal)", "var(--chart-yellow)", "var(--chart-blue)", "var(--brand)"];
const toneByIndex = ["coral", "teal", "yellow", "blue"];

type RpcClient = {
  rpc: (fn: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T[]> {
  const client = supabase as unknown as RpcClient;
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}


const money = (value: number) =>
  `$${Math.round(value).toLocaleString("en-US")}`;
const compactMoney = (value: number) =>
  value >= 1_000_000 ? `$${(value / 1_000_000).toFixed(1)}M` : value >= 1000 ? `$${Math.round(value / 1000)}k` : `$${value}`;
const growth = (current: number, previous: number) =>
  previous > 0 ? `${(((current - previous) / previous) * 100).toFixed(1)}%` : "—";

function shiftDays(date: string, days: number) {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export const Route = createFileRoute("/")({
  ssr: false,
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
  pendingComponent: () => (
    <div className="grid min-h-screen place-items-center"><Loader2 className="size-8 animate-spin text-brand" /></div>
  ),
  errorComponent: ({ error }) => (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="panel max-w-md text-center" role="alert">
        <h2 className="font-display text-xl font-extrabold">Failed to load data</h2>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </div>
  ),
  notFoundComponent: () => <div className="p-10 text-center">Page not found.</div>,
});

function Dashboard() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [period, setPeriod] = useState<TrendPeriod>("Monthly");
  const [storeId, setStoreId] = useState<string>("all");
  const [rangeKey, setRangeKey] = useState<RangeKey>("all");
  const [showDates, setShowDates] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [search, setSearch] = useState("");
  const [restocked, setRestocked] = useState<string[]>([]);

  const boundsQuery = useQuery({
    queryKey: ["dashboard", "bounds"],
    queryFn: () => rpc<Bounds>("dashboard_date_bounds", {}).then((rows) => rows[0] ?? null),
  });
  const storesQuery = useQuery({
    queryKey: ["dashboard", "stores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("store_id, store_name, store_city")
        .order("store_name")
        .limit(500);
      if (error) throw new Error(error.message);
      return (data ?? []) as StoreOption[];
    },
  });

  const bounds = boundsQuery.data ?? null;
  const maxDate = bounds?.max_date ?? null;
  const range = useMemo(() => {
    if (!maxDate) return { from: null as string | null, to: null as string | null };
    if (rangeKey === "all") return { from: bounds?.min_date ?? null, to: maxDate };
    return { from: shiftDays(maxDate, -(Number(rangeKey) - 1)), to: maxDate };
  }, [bounds?.min_date, maxDate, rangeKey]);

  const storeParam = storeId === "all" ? null : Number(storeId);
  const enabled = Boolean(maxDate);
  const filterKey = [range.from, range.to, storeParam] as const;

  const kpisQuery = useQuery({
    queryKey: ["dashboard", "kpis", ...filterKey],
    enabled,
    queryFn: () =>
      rpc<Kpis>("dashboard_kpis", { p_from: range.from, p_to: range.to, p_store_id: storeParam }).then((rows) => rows[0] ?? null),
  });
  const trendQuery = useQuery({
    queryKey: ["dashboard", "trend", period, ...filterKey],
    enabled,
    queryFn: () =>
      rpc<TrendRow>("dashboard_sales_trend", {
        p_grain: grainByPeriod[period],
        p_from: range.from,
        p_to: range.to,
        p_store_id: storeParam,
      }),
  });
  const categoryQuery = useQuery({
    queryKey: ["dashboard", "categories", ...filterKey],
    enabled,
    queryFn: () => rpc<CategoryRow>("dashboard_category_sales", { p_from: range.from, p_to: range.to, p_store_id: storeParam }),
  });
  const salesQuery = useQuery({
    queryKey: ["dashboard", "recent", storeParam, search.trim()],
    queryFn: () => rpc<SaleRow>("dashboard_recent_sales", { p_limit: 10, p_store_id: storeParam, p_search: search.trim() || null }),
  });
  const stockQuery = useQuery({
    queryKey: ["dashboard", "low-stock", storeParam],
    queryFn: () => rpc<StockRow>("dashboard_low_stock", { p_threshold: 10, p_limit: 8, p_store_id: storeParam }),
  });

  const kpis = kpisQuery.data ?? null;
  const trend = trendQuery.data ?? [];
  const categories = useMemo(() => {
    const rows = categoryQuery.data ?? [];
    const total = rows.reduce((sum, row) => sum + Number(row.revenue), 0);
    return rows.map((row, index) => ({
      name: row.category,
      revenue: Number(row.revenue),
      value: total > 0 ? Number(((Number(row.revenue) / total) * 100).toFixed(1)) : 0,
      color: donutColors[index % donutColors.length],
    }));
  }, [categoryQuery.data]);

  const sparkline = useMemo(() => trend.slice(-12).map((row) => ({ value: Number(row.sales) })), [trend]);
  const trendChartData = useMemo(
    () => trend.map((row) => ({ label: row.label, sales: Number(row.sales), units: Number(row.units) })),
    [trend],
  );

  const storeLabel = storeId === "all"
    ? "all stores"
    : storesQuery.data?.find((item) => String(item.store_id) === storeId)?.store_name ?? "store";

  const stockItems = (stockQuery.data ?? []).filter((item) => !restocked.includes(`${item.store_id}-${item.product_id}`));

  const empty = Boolean(bounds && bounds.sale_rows === 0);
  const loadError = boundsQuery.error ?? kpisQuery.error ?? trendQuery.error ?? categoryQuery.error;

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
          <button title={collapsed ? "Overview" : undefined} className="nav-item nav-item-active">
            <LayoutDashboard className="size-5 shrink-0" />{!collapsed && <span>Overview</span>}
          </button>
          {[
            { label: "Category Profit", to: "/profit" as const, icon: TrendingUp },
            { label: "Availability & Loss", to: "/availability" as const, icon: PackageOpen },
            { label: "Inventory Value", to: "/inventory" as const, icon: Boxes },
          ].map(({ label, to, icon: Icon }) => (
            <Link key={to} to={to} title={collapsed ? label : undefined} className="nav-item">
              <Icon className="size-5 shrink-0" />{!collapsed && <span className="truncate">{label}</span>}
            </Link>
          ))}
          <button title={collapsed ? "Stores" : undefined} className="nav-item">
            <Store className="size-5 shrink-0" />{!collapsed && <span>Stores</span>}
          </button>
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
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products, stores, cities, orders..." className="h-10 w-full rounded-md border border-input bg-muted/60 pl-10 pr-4 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20" />
            </label>
            <div className="ml-auto flex items-center gap-2">
              <div className="control-wrap hidden md:flex">
                <MapPin className="size-4 text-muted-foreground" />
                <select aria-label="Store location" value={storeId} onChange={(event) => setStoreId(event.target.value)} className="max-w-52 bg-transparent text-sm font-semibold outline-none">
                  <option value="all">All stores</option>
                  {(storesQuery.data ?? []).map((item) => (
                    <option key={item.store_id} value={String(item.store_id)}>{item.store_name} · {item.store_city}</option>
                  ))}
                </select>
              </div>
              <div className="relative hidden sm:block">
                <button onClick={() => setShowDates((value) => !value)} className="control-wrap"><CalendarDays className="size-4 text-muted-foreground" /><span>{rangeLabels[rangeKey]}</span><ChevronDown className="size-3.5 text-muted-foreground" /></button>
                {showDates && <div className="popover right-0 w-56">{(Object.keys(rangeLabels) as RangeKey[]).map((item) => <button key={item} onClick={() => { setRangeKey(item); setShowDates(false); }} className={`popover-row ${rangeKey === item ? "text-primary" : ""}`}>{rangeLabels[item]}</button>)}</div>}
              </div>
              <div className="relative">
                <button aria-label="Notifications" onClick={() => setShowNotifications((value) => !value)} className="icon-button relative"><Bell className="size-5" />{stockItems.length > 0 && <span className="absolute right-2 top-2 size-2 rounded-full bg-brand ring-2 ring-background" />}</button>
                {showNotifications && <div className="popover right-0 w-72"><p className="px-3 py-2 text-sm font-bold">Notifications</p><div className="border-t border-border p-3"><p className="text-sm font-semibold">{stockItems.length} items with low stock</p><p className="mt-1 text-xs text-muted-foreground">Review inventory before store opening.</p></div></div>}
              </div>
            </div>
          </div>
          <div className="flex gap-2 px-4 pb-3 sm:hidden">
            <label className="relative flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search sales..." className="h-10 w-full rounded-md border border-input bg-muted/60 pl-10 pr-3 text-sm outline-none" /></label>
          </div>
        </header>

        <div className="mx-auto max-w-[1600px] px-4 py-7 md:px-7 md:py-9">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-1 text-sm font-semibold text-brand">{range.from && range.to ? `${range.from} — ${range.to}` : "No sales data"}</p>
              <h1 className="font-display text-3xl font-extrabold md:text-4xl">Sales by {storeLabel}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{bounds ? `${bounds.sale_rows.toLocaleString("en-US")} sales records in database` : "Loading data..."}</p>
            </div>
            <Link to="/data" className="primary-button"><Database className="size-4" />Import data</Link>
          </div>

          {loadError && <div className="panel mb-5 border-destructive/40 text-sm text-destructive" role="alert">{loadError.message}</div>}
          {empty && <div className="panel mb-5 text-sm text-muted-foreground">No sales records found. Upload files in the <Link to="/data" className="font-bold text-primary hover:underline">Data Manager</Link>.</div>}

          <section aria-label="Key metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Revenue" value={kpis ? money(Number(kpis.revenue)) : "—"} change={kpis ? growth(Number(kpis.revenue), Number(kpis.prev_revenue)) : "—"} icon={<TrendingUp className="size-5" />} tone="coral">
              {sparkline.length > 1 && (
                <div className="h-9 w-28">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sparkline}><Line type="monotone" dataKey="value" stroke="var(--brand)" strokeWidth={2.5} dot={false} /></LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </MetricCard>
            <MetricCard title="Units Sold" value={kpis ? Number(kpis.units).toLocaleString("en-US") : "—"} change={kpis ? growth(Number(kpis.units), Number(kpis.prev_units)) : "—"} icon={<ShoppingBag className="size-5" />} tone="teal">
              <p className="text-xs text-muted-foreground">{kpis ? `${Number(kpis.order_count).toLocaleString("en-US")} продаж` : ""}</p>
            </MetricCard>
            <MetricCard title="Active Stores" value={kpis ? String(kpis.store_count) : "—"} change={kpis ? `${storesQuery.data?.length ?? 0} total` : "—"} icon={<Store className="size-5" />} tone="blue">
              <p className="text-xs text-muted-foreground">with sales in period</p>
            </MetricCard>
            <MetricCard title="Top Category" value={kpis?.top_category ?? "—"} change={kpis ? `${Number(kpis.top_category_share)}%` : "—"} icon={<Boxes className="size-5" />} tone="yellow">
              <p className="text-xs text-muted-foreground">of total revenue</p>
            </MetricCard>
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.75fr)_minmax(300px,0.75fr)]">
            <div className="panel min-w-0">
              <div className="panel-heading"><div><h2>Sales Dynamics</h2><p>Revenue по данным of базы</p></div><div className="segmented">{(["Daily", "Weekly", "Monthly"] as TrendPeriod[]).map((item) => <button key={item} onClick={() => setPeriod(item)} className={period === item ? "segmented-active" : ""}>{item}</button>)}</div></div>
              <div className="mt-6 h-72">
                {trendQuery.isPending ? (
                  <div className="grid h-full place-items-center"><Loader2 className="size-6 animate-spin text-brand" /></div>
                ) : trendChartData.length === 0 ? (
                  <div className="grid h-full place-items-center text-sm text-muted-foreground">No data for selected period</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    {period === "Monthly" ? (
                      <BarChart data={trendChartData}><CartesianGrid stroke="var(--chart-grid)" vertical={false} /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} /><YAxis axisLine={false} tickLine={false} tickFormatter={compactMoney} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} /><Tooltip content={<ChartTooltip />} /><Bar dataKey="sales" fill="var(--brand)" radius={[4, 4, 0, 0]} /></BarChart>
                    ) : (
                      <AreaChart data={trendChartData}><defs><linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--brand)" stopOpacity={0.24} /><stop offset="100%" stopColor="var(--brand)" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="var(--chart-grid)" vertical={false} /><XAxis dataKey="label" axisLine={false} tickLine={false} interval="preserveStartEnd" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} /><YAxis axisLine={false} tickLine={false} tickFormatter={compactMoney} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} /><Tooltip content={<ChartTooltip />} /><Area type="monotone" dataKey="sales" stroke="var(--brand)" fill="url(#salesFill)" strokeWidth={3} /></AreaChart>
                    )}
                  </ResponsiveContainer>
                )}
              </div>
              <div className="mt-3 flex justify-center gap-5 text-xs text-muted-foreground"><span className="flex items-center gap-2"><i className="size-2.5 rounded-full bg-brand" />Revenue</span></div>
            </div>
            <div className="panel">
              <div className="panel-heading"><div><h2>Sales by категориям</h2><p>Revenue breakdown for period</p></div><button aria-label="Category chart options" className="icon-button"><MoreHorizontal className="size-5" /></button></div>
              {categories.length === 0 ? (
                <div className="grid h-48 place-items-center text-sm text-muted-foreground">{categoryQuery.isPending ? <Loader2 className="size-6 animate-spin text-brand" /> : "No data"}</div>
              ) : (
                <>
                  <div className="relative mx-auto mt-5 h-48 max-w-60">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart><Pie data={categories} dataKey="value" innerRadius={58} outerRadius={82} paddingAngle={3} stroke="none">{categories.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip formatter={(value, name) => [`${value}%`, String(name)]} /></PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 grid place-items-center text-center"><div><strong className="font-display text-2xl">{kpis ? compactMoney(Number(kpis.revenue)) : "—"}</strong><p className="text-xs text-muted-foreground">Total Sales</p></div></div>
                  </div>
                  <div className="mt-4 space-y-3">{categories.map((category) => <div key={category.name} className="flex items-center gap-3 text-sm"><span className="size-2.5 rounded-sm" style={{ backgroundColor: category.color }} /><span className="flex-1 truncate text-muted-foreground">{category.name}</span><strong>{category.value}%</strong></div>)}</div>
                </>
              )}
            </div>
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.75fr)_minmax(320px,0.75fr)]">
            <div className="panel overflow-hidden p-0">
              <div className="panel-heading border-b border-border p-5 md:p-6"><div><h2>Recent Sales</h2><p>Latest entries from database</p></div></div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground"><th>#</th><th>Product</th><th>Category</th><th>Store</th><th>Qty</th><th>Total</th><th>Date</th></tr></thead><tbody>{(salesQuery.data ?? []).map((sale) => <tr key={sale.sale_id} className="border-b border-border last:border-0 hover:bg-muted/30"><td className="font-bold">#{sale.sale_id}</td><td>{sale.product_name}</td><td className="text-muted-foreground">{sale.product_category}</td><td className="text-muted-foreground">{sale.store_name} · {sale.store_city}</td><td>{sale.units}</td><td className="font-semibold">{money(Number(sale.total))}</td><td className="text-muted-foreground">{sale.sale_date}</td></tr>)}</tbody></table>
                {salesQuery.isPending && <div className="grid py-12 place-items-center"><Loader2 className="size-6 animate-spin text-brand" /></div>}
                {!salesQuery.isPending && (salesQuery.data ?? []).length === 0 && <div className="py-12 text-center text-sm text-muted-foreground">No sales found.</div>}
              </div>
              <div className="flex items-center justify-between border-t border-border px-5 py-4 text-sm"><span className="text-muted-foreground">Showing {(salesQuery.data ?? []).length} of {bounds?.sale_rows.toLocaleString("en-US") ?? "—"}</span><Link to="/data" className="font-bold text-primary hover:underline">All sales</Link></div>
            </div>

            <div className="panel p-0">
              <div className="panel-heading border-b border-border p-5 md:p-6"><div><div className="flex items-center gap-2"><h2>Low Stock</h2>{stockItems.length > 0 && <span className="rounded-full bg-destructive-soft px-2 py-0.5 text-xs font-bold text-destructive">{stockItems.length}</span>}</div><p>10 units or less remaining</p></div></div>
              <div className="divide-y divide-border">
                {stockItems.map((item, index) => (
                  <div key={`${item.store_id}-${item.product_id}`} className="flex items-center gap-3 p-4">
                    <div className={`stock-thumb stock-${toneByIndex[index % toneByIndex.length]}`}><PackageOpen className="size-5" /></div>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{item.product_name}</p><p className="truncate text-xs text-muted-foreground">{item.store_name} · <span className="font-semibold text-destructive">{item.stock_on_hand} units</span></p></div>
                    <button onClick={() => setRestocked((items) => [...items, `${item.store_id}-${item.product_id}`])} className="secondary-button">Restock</button>
                  </div>
                ))}
                {stockQuery.isPending && <div className="grid py-12 place-items-center"><Loader2 className="size-6 animate-spin text-brand" /></div>}
                {!stockQuery.isPending && stockItems.length === 0 && <div className="px-5 py-12 text-center"><PackageCheck className="mx-auto size-8 text-success" /><p className="mt-3 text-sm font-bold">Stock Level Healthy</p><p className="mt-1 text-xs text-muted-foreground">All stock alerts resolved.</p></div>}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function MetricCard({ title, value, change, icon, tone, children }: { title: string; value: string; change: string; icon: React.ReactNode; tone: string; children: React.ReactNode }) {
  const negative = change.startsWith("-");
  const showChange = change !== "—";
  return <article className="metric-card"><div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-muted-foreground">{title}</p><p className="mt-2 font-display text-2xl font-extrabold">{value}</p></div><span className={`metric-icon metric-${tone}`}>{icon}</span></div><div className="mt-5 flex min-h-9 items-end justify-between gap-3"><div>{showChange && <><span className={`text-xs font-bold ${negative ? "text-destructive" : "text-success"}`}>{negative ? "↓" : "↑"} {change.replace("-", "")}</span><span className="ml-1 text-xs text-muted-foreground">vs prev period</span></>}</div>{children}</div></article>;
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string; payload?: { units?: number } }>; label?: string }) {
  if (!active || !payload?.length) return null;
  const units = payload[0]?.payload?.units;
  return (
    <div className="rounded-md border border-border bg-popover p-3 text-xs shadow-lg">
      <p className="mb-2 font-bold">{label}</p>
      {payload.map((item) => <p key={item.name} style={{ color: item.color }} className="font-semibold">Revenue: {money(Number(item.value))}</p>)}
      {typeof units === "number" && <p className="mt-1 text-muted-foreground">Sold: {units.toLocaleString("en-US")} units</p>}
    </div>
  );
}
