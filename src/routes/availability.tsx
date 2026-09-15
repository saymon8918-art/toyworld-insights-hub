import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Loader2, MapPin, PackageX, ShoppingCart, TrendingDown } from "lucide-react";
import { AppShell, Stat } from "@/components/AppShell";
import { compactMoney, fetchStores, int, money, num, pct, rpc } from "@/lib/analytics";

type Summary = {
  out_of_stock: number;
  at_risk: number;
  tracked_pairs: number;
  availability_pct: number;
  lost_units_week: number;
  lost_revenue_week: number;
  lost_profit_week: number;
  affected_stores: number;
};
type ItemRow = {
  store_id: number;
  product_id: number;
  store_name: string;
  store_city: string;
  product_name: string;
  category: string;
  stock_on_hand: number;
  daily_units: number;
  days_cover: number | null;
  lost_units_week: number;
  lost_revenue_week: number;
};
type StoreRow = {
  store_id: number;
  store_name: string;
  store_city: string;
  store_location: string;
  tracked_pairs: number;
  out_of_stock: number;
  availability_pct: number;
  lost_revenue_week: number;
  revenue_week: number;
  loss_ratio_pct: number;
};
type GapRow = {
  store_id: number;
  store_name: string;
  store_city: string;
  product_id: number;
  product_name: string;
  category: string;
  chain_daily_units: number;
  est_revenue_week: number;
  stores_selling: number;
};
type LostCategoryRow = {
  category: string;
  out_of_stock: number;
  lost_units_week: number;
  lost_revenue_week: number;
  revenue_week: number;
  loss_ratio_pct: number;
};

const windows = [
  { key: 14, label: "14 days" },
  { key: 28, label: "28 days" },
  { key: 56, label: "56 days" },
] as const;

export const Route = createFileRoute("/availability")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Lost sales from stockouts — ToyWorld" },
      { name: "description", content: "Where stores lose sales because toys are out of stock, and what that costs every week." },
      { property: "og:title", content: "Lost sales from stockouts — ToyWorld" },
      { property: "og:description", content: "Availability, shortage items and estimated missed revenue by store." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AvailabilityPage,
  pendingComponent: () => (
    <div className="grid min-h-screen place-items-center">
      <Loader2 className="size-8 animate-spin text-brand" />
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="panel max-w-md text-center" role="alert">
        <h2 className="font-display text-xl font-extrabold">Could not load data</h2>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </div>
  ),
  notFoundComponent: () => <div className="p-10 text-center">Page not found.</div>,
});

function AvailabilityPage() {
  const [windowDays, setWindowDays] = useState<number>(28);
  const [storeId, setStoreId] = useState("all");
  const storeParam = storeId === "all" ? null : Number(storeId);

  const storesQuery = useQuery({ queryKey: ["stores"], queryFn: fetchStores });
  const summaryQuery = useQuery({
    queryKey: ["avail", "summary", windowDays, storeParam],
    queryFn: () => rpc<Summary>("analytics_availability_summary", { p_days: windowDays, p_store_id: storeParam }).then((rows) => rows[0] ?? null),
  });
  const itemsQuery = useQuery({
    queryKey: ["avail", "items", windowDays, storeParam],
    queryFn: () => rpc<ItemRow>("analytics_stockout_items", { p_days: windowDays, p_store_id: storeParam, p_limit: 20 }),
  });
  const storeRowsQuery = useQuery({
    queryKey: ["avail", "stores", windowDays],
    queryFn: () => rpc<StoreRow>("analytics_store_availability", { p_days: windowDays, p_limit: 50 }),
  });
  const gapsQuery = useQuery({
    queryKey: ["avail", "gaps", windowDays],
    queryFn: () => rpc<GapRow>("analytics_assortment_gaps", { p_days: windowDays, p_limit: 15 }),
  });
  const lostCategoryQuery = useQuery({
    queryKey: ["avail", "lost-cat", windowDays],
    queryFn: () => rpc<LostCategoryRow>("analytics_lost_by_category", { p_days: windowDays }),
  });

  const summary = summaryQuery.data ?? null;
  const storeRows = storeRowsQuery.data ?? [];
  const gapTotal = (gapsQuery.data ?? []).reduce((sum, row) => sum + num(row.est_revenue_week), 0);

  return (
    <AppShell
      eyebrow="Question 2"
      title="Are we losing sales to stockouts?"
      subtitle={`Demand is based on actual sales over the last ${windowDays} дней. Weekly loss = (weekly demand − current stock) × price. Items with zero stock but live demand are direct losses.`}
      controls={
        <>
          <div className="control-wrap">
            <MapPin className="size-4 text-muted-foreground" />
            <select aria-label="Store" value={storeId} onChange={(event) => setStoreId(event.target.value)} className="max-w-52 bg-transparent text-sm font-semibold outline-none">
              <option value="all">All stores</option>
              {(storesQuery.data ?? []).map((store) => (
                <option key={store.store_id} value={String(store.store_id)}>{store.store_name} · {store.store_city}</option>
              ))}
            </select>
          </div>
          <div className="segmented">
            {windows.map((option) => (
              <button key={option.key} onClick={() => setWindowDays(option.key)} className={windowDays === option.key ? "segmented-active" : ""}>
                {option.label}
              </button>
            ))}
          </div>
        </>
      }
    >
      <section aria-label="Summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Lost revenue per week"
          value={summary ? money(summary.lost_revenue_week) : "—"}
          hint={summary ? `Of which profit ${money(summary.lost_profit_week)}` : ""}
          tone="coral"
          icon={<TrendingDown className="size-5" />}
        />
        <Stat
          label="Out of stock"
          value={summary ? int(summary.out_of_stock) : "—"}
          hint={summary ? `items with demand across ${int(summary.affected_stores)} stores` : ""}
          tone="yellow"
          icon={<PackageX className="size-5" />}
        />
        <Stat
          label="Availability"
          value={summary ? pct(summary.availability_pct) : "—"}
          hint={summary ? `${int(summary.tracked_pairs)} tracked store-product pairs` : ""}
          tone="teal"
          icon={<ShoppingCart className="size-5" />}
        />
        <Stat
          label="Runs out this week"
          value={summary ? int(summary.at_risk) : "—"}
          hint="items with under 7 days of cover"
          tone="blue"
          icon={<AlertTriangle className="size-5" />}
        />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <div className="panel min-w-0">
          <div className="panel-heading">
            <div>
              <h2>Losses by category</h2>
              <p>Missed weekly revenue and its share of potential</p>
            </div>
          </div>
          <div className="mt-6 h-72">
            {lostCategoryQuery.isPending ? (
              <div className="grid h-full place-items-center"><Loader2 className="size-6 animate-spin text-brand" /></div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={(lostCategoryQuery.data ?? []).map((row) => ({ ...row, lost: num(row.lost_revenue_week), rev: num(row.revenue_week) }))}>
                  <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="category" axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={compactMoney} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                  <Tooltip formatter={(value: number, name) => [money(value), String(name)]} contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--popover)", fontSize: 12 }} />
                  <Legend />
                  <Bar dataKey="rev" name="Weekly potential" fill="var(--chart-blue)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="lost" name="Losses" fill="var(--chart-coral)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-4 space-y-2 text-sm">
            {(lostCategoryQuery.data ?? []).map((row) => (
              <div key={row.category} className="flex items-center gap-3">
                <span className="flex-1 truncate text-muted-foreground">{row.category}</span>
                <span className="text-xs text-muted-foreground">{int(row.out_of_stock)} items with no stock</span>
                <strong className="text-destructive">{pct(row.loss_ratio_pct)}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="panel min-w-0 p-0">
          <div className="panel-heading border-b border-border p-5 md:p-6">
            <div>
              <h2>Stores with the biggest losses</h2>
              <p>Loss share is measured against the store's weekly potential</p>
            </div>
          </div>
          <div className="max-h-[430px] overflow-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="sticky top-0 bg-muted/70 backdrop-blur">
                <tr className="text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-3">Store</th><th className="px-4 py-3">Out of stock</th><th className="px-4 py-3">Availability</th><th className="px-4 py-3">Loss/week</th><th className="px-4 py-3">Loss share</th>
                </tr>
              </thead>
              <tbody>
                {storeRows.map((row) => (
                  <tr key={row.store_id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2 font-semibold">{row.store_name} · <span className="text-muted-foreground">{row.store_city}</span></td>
                    <td className="px-4 py-2">{row.out_of_stock} / {row.tracked_pairs}</td>
                    <td className="px-4 py-2">{pct(row.availability_pct)}</td>
                    <td className="px-4 py-2 font-semibold text-destructive">{money(row.lost_revenue_week)}</td>
                    <td className="px-4 py-2">{pct(row.loss_ratio_pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {storeRowsQuery.isPending && <div className="grid py-12 place-items-center"><Loader2 className="size-6 animate-spin text-brand" /></div>}
          </div>
        </div>
      </section>

      <section className="mt-5 panel overflow-hidden p-0">
        <div className="panel-heading border-b border-border p-5 md:p-6">
          <div>
            <h2>Items to restock urgently</h2>
            <p>Demand exists but stock will not last the week</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
                <th>Product</th><th>Category</th><th>Store</th><th>Stock</th><th>Demand/day</th><th>Days of cover</th><th>Shortfall/week</th><th>Loss/week</th>
              </tr>
            </thead>
            <tbody>
              {(itemsQuery.data ?? []).map((row) => (
                <tr key={`${row.store_id}-${row.product_id}`} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="font-bold">{row.product_name}</td>
                  <td className="text-muted-foreground">{row.category}</td>
                  <td className="text-muted-foreground">{row.store_name} · {row.store_city}</td>
                  <td className={row.stock_on_hand === 0 ? "font-bold text-destructive" : "font-semibold"}>{row.stock_on_hand} pcs</td>
                  <td>{num(row.daily_units).toFixed(2)}</td>
                  <td>{row.days_cover === null ? "—" : `${num(row.days_cover).toFixed(1)}d`}</td>
                  <td>{Math.ceil(num(row.lost_units_week))} pcs</td>
                  <td className="font-semibold text-destructive">{money(row.lost_revenue_week)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {itemsQuery.isPending && <div className="grid py-12 place-items-center"><Loader2 className="size-6 animate-spin text-brand" /></div>}
          {!itemsQuery.isPending && (itemsQuery.data ?? []).length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">No shortages — stock covers the whole week.</p>
          )}
        </div>
      </section>

      <section className="mt-5 panel overflow-hidden p-0">
        <div className="panel-heading border-b border-border p-5 md:p-6">
          <div>
            <h2>Assortment gaps</h2>
            <p>These products sell well chain-wide but appear in neither stock nor sales at these stores — estimated missed revenue {money(gapTotal)} per week</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
                <th>Store</th><th>Product</th><th>Category</th><th>Selling in stores</th><th>Demand/day per store</th><th>Missed/week</th>
              </tr>
            </thead>
            <tbody>
              {(gapsQuery.data ?? []).map((row) => (
                <tr key={`${row.store_id}-${row.product_id}`} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="font-semibold">{row.store_name} · <span className="text-muted-foreground">{row.store_city}</span></td>
                  <td className="font-bold">{row.product_name}</td>
                  <td className="text-muted-foreground">{row.category}</td>
                  <td>{row.stores_selling}</td>
                  <td>{num(row.chain_daily_units).toFixed(2)}</td>
                  <td className="font-semibold text-destructive">{money(row.est_revenue_week)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {gapsQuery.isPending && <div className="grid py-12 place-items-center"><Loader2 className="size-6 animate-spin text-brand" /></div>}
          {!gapsQuery.isPending && (gapsQuery.data ?? []).length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">No assortment gaps found.</p>
          )}
        </div>
      </section>
    </AppShell>
  );
}
