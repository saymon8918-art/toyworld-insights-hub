import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Banknote, Clock, Loader2, MapPin, Snowflake, Warehouse } from "lucide-react";
import { AppShell, Stat } from "@/components/AppShell";
import { chartColors, compactMoney, fetchStores, int, money, num, pct, rpc } from "@/lib/analytics";

type Summary = {
  units: number;
  sku_rows: number;
  cost_value: number;
  retail_value: number;
  locked_profit: number;
  daily_cost_burn: number;
  days_cover: number | null;
  dead_cost_value: number;
  dead_rows: number;
};
type CategoryRow = { category: string; units: number; cost_value: number; retail_value: number; daily_cost_burn: number; days_cover: number | null; share_pct: number };
type StoreRow = {
  store_id: number;
  store_name: string;
  store_city: string;
  store_location: string;
  units: number;
  cost_value: number;
  daily_cost_burn: number;
  days_cover: number | null;
  dead_cost_value: number;
};
type BucketRow = { bucket: string; sort_order: number; sku_rows: number; units: number; cost_value: number; share_pct: number };
type SlowRow = {
  store_id: number;
  product_id: number;
  store_name: string;
  store_city: string;
  product_name: string;
  category: string;
  stock_on_hand: number;
  cost_value: number;
  daily_units: number;
  days_cover: number | null;
};

const windows = [
  { key: 14, label: "14 days" },
  { key: 28, label: "28 days" },
  { key: 56, label: "56 days" },
] as const;

export const Route = createFileRoute("/inventory")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Cash in inventory & days of cover — ToyWorld" },
      { name: "description", content: "How much cash is tied up in toy store inventory and how long that stock will last at current demand." },
      { property: "og:title", content: "Cash in inventory & days of cover — ToyWorld" },
      { property: "og:description", content: "Inventory value at cost and retail, days of cover and dead stock by store." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InventoryPage,
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

function InventoryPage() {
  const [windowDays, setWindowDays] = useState<number>(28);
  const [storeId, setStoreId] = useState("all");
  const storeParam = storeId === "all" ? null : Number(storeId);

  const storesQuery = useQuery({ queryKey: ["stores"], queryFn: fetchStores });
  const summaryQuery = useQuery({
    queryKey: ["inv", "summary", windowDays, storeParam],
    queryFn: () => rpc<Summary>("analytics_inventory_summary", { p_days: windowDays, p_store_id: storeParam }).then((rows) => rows[0] ?? null),
  });
  const categoryQuery = useQuery({
    queryKey: ["inv", "categories", windowDays, storeParam],
    queryFn: () => rpc<CategoryRow>("analytics_inventory_by_category", { p_days: windowDays, p_store_id: storeParam }),
  });
  const bucketQuery = useQuery({
    queryKey: ["inv", "buckets", windowDays, storeParam],
    queryFn: () => rpc<BucketRow>("analytics_cover_buckets", { p_days: windowDays, p_store_id: storeParam }),
  });
  const storeQuery = useQuery({
    queryKey: ["inv", "stores", windowDays],
    queryFn: () => rpc<StoreRow>("analytics_inventory_by_store", { p_days: windowDays, p_limit: 50 }),
  });
  const slowQuery = useQuery({
    queryKey: ["inv", "slow", windowDays, storeParam],
    queryFn: () => rpc<SlowRow>("analytics_slow_movers", { p_days: windowDays, p_store_id: storeParam, p_limit: 20 }),
  });

  const summary = summaryQuery.data ?? null;
  const buckets = bucketQuery.data ?? [];

  return (
    <AppShell
      eyebrow="Questions 3 & 4"
      title="How much cash is tied up in inventory, and how long will it last?"
      subtitle={`Stock is valued at cost and at retail prices. Days of cover = inventory value divided by average daily consumption over the last ${windowDays} дней.`}
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
          label="Cash in inventory"
          value={summary ? money(summary.cost_value) : "—"}
          hint={summary ? `${int(summary.units)} units across ${int(summary.sku_rows)} line items` : ""}
          tone="coral"
          icon={<Banknote className="size-5" />}
        />
        <Stat
          label="Retail value"
          value={summary ? money(summary.retail_value) : "—"}
          hint={summary ? `Potential profit ${money(summary.locked_profit)}` : ""}
          tone="teal"
          icon={<Warehouse className="size-5" />}
        />
        <Stat
          label="Days of cover"
          value={summary?.days_cover ? `${num(summary.days_cover).toFixed(0)}d` : "—"}
          hint={summary ? `Burn ${money(summary.daily_cost_burn)} per day at cost` : ""}
          tone="blue"
          icon={<Clock className="size-5" />}
        />
        <Stat
          label="Dead stock"
          value={summary ? money(summary.dead_cost_value) : "—"}
          hint={summary ? `${int(summary.dead_rows)} line items with no sales in ${windowDays} дней` : ""}
          tone="yellow"
          icon={<Snowflake className="size-5" />}
        />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,1fr)]">
        <div className="panel min-w-0">
          <div className="panel-heading">
            <div>
              <h2>Inventory by category</h2>
              <p>Where the cash sits and how many days each category will last</p>
            </div>
          </div>
          <div className="mt-6 h-72">
            {categoryQuery.isPending ? (
              <div className="grid h-full place-items-center"><Loader2 className="size-6 animate-spin text-brand" /></div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={(categoryQuery.data ?? []).map((row) => ({ ...row, cost: num(row.cost_value), retail: num(row.retail_value) }))}>
                  <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="category" axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={compactMoney} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                  <Tooltip formatter={(value: number, name) => [money(value), String(name)]} contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--popover)", fontSize: 12 }} />
                  <Legend />
                  <Bar dataKey="cost" name="At cost" fill="var(--brand)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="retail" name="At retail" fill="var(--chart-teal)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
                  <th>Category</th><th>Tied up</th><th>Share</th><th>Units</th><th>Burn/day</th><th>Days of cover</th>
                </tr>
              </thead>
              <tbody>
                {(categoryQuery.data ?? []).map((row) => (
                  <tr key={row.category} className="border-b border-border last:border-0">
                    <td className="font-bold">{row.category}</td>
                    <td className="font-semibold">{money(row.cost_value)}</td>
                    <td>{pct(row.share_pct)}</td>
                    <td className="text-muted-foreground">{int(row.units)}</td>
                    <td className="text-muted-foreground">{money(row.daily_cost_burn)}</td>
                    <td className="font-semibold">{row.days_cover === null ? "—" : `${num(row.days_cover).toFixed(0)}d`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel min-w-0">
          <div className="panel-heading">
            <div>
              <h2>Days of cover</h2>
              <p>How much cash sits in each cover bucket</p>
            </div>
          </div>
          <div className="mt-6 h-64">
            {buckets.length === 0 ? (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={buckets.map((row) => ({ ...row, value: num(row.cost_value) }))} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid stroke="var(--chart-grid)" horizontal={false} />
                  <XAxis type="number" axisLine={false} tickLine={false} tickFormatter={compactMoney} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                  <YAxis type="category" dataKey="bucket" width={150} axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                  <Tooltip formatter={(value: number) => money(value)} contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--popover)", fontSize: 12 }} />
                  <Bar dataKey="value" name="Tied up" radius={[0, 4, 4, 0]}>
                    {buckets.map((row, index) => <Cell key={row.bucket} fill={chartColors[index % chartColors.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-4 space-y-2 text-sm">
            {buckets.map((row) => (
              <div key={row.bucket} className="flex items-center gap-3">
                <span className="flex-1 truncate text-muted-foreground">{row.bucket}</span>
                <span className="text-xs text-muted-foreground">{int(row.sku_rows)} items</span>
                <strong>{pct(row.share_pct)}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <div className="panel min-w-0 p-0">
          <div className="panel-heading border-b border-border p-5 md:p-6">
            <div>
              <h2>Inventory by store</h2>
              <p>Where the most cash is tied up and for how long</p>
            </div>
          </div>
          <div className="max-h-[430px] overflow-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="sticky top-0 bg-muted/70 backdrop-blur">
                <tr className="text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-3">Store</th><th className="px-4 py-3">Tied up</th><th className="px-4 py-3">Units</th><th className="px-4 py-3">Days of cover</th><th className="px-4 py-3">Dead stock</th>
                </tr>
              </thead>
              <tbody>
                {(storeQuery.data ?? []).map((row) => (
                  <tr key={row.store_id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2 font-semibold">{row.store_name} · <span className="text-muted-foreground">{row.store_city}</span></td>
                    <td className="px-4 py-2 font-semibold">{money(row.cost_value)}</td>
                    <td className="px-4 py-2 text-muted-foreground">{int(row.units)}</td>
                    <td className="px-4 py-2">{row.days_cover === null ? "—" : `${num(row.days_cover).toFixed(0)}d`}</td>
                    <td className="px-4 py-2 text-muted-foreground">{money(row.dead_cost_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {storeQuery.isPending && <div className="grid py-12 place-items-center"><Loader2 className="size-6 animate-spin text-brand" /></div>}
          </div>
        </div>

        <div className="panel min-w-0 p-0">
          <div className="panel-heading border-b border-border p-5 md:p-6">
            <div>
              <h2>Slow-moving stock</h2>
              <p>No sales or over 90 days of cover — first candidates for markdown</p>
            </div>
          </div>
          <div className="max-h-[430px] overflow-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="sticky top-0 bg-muted/70 backdrop-blur">
                <tr className="text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-3">Product</th><th className="px-4 py-3">Store</th><th className="px-4 py-3">Stock</th><th className="px-4 py-3">Cash</th><th className="px-4 py-3">Days of cover</th>
                </tr>
              </thead>
              <tbody>
                {(slowQuery.data ?? []).map((row) => (
                  <tr key={`${row.store_id}-${row.product_id}`} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2"><span className="font-bold">{row.product_name}</span><br /><span className="text-xs text-muted-foreground">{row.category}</span></td>
                    <td className="px-4 py-2 text-muted-foreground">{row.store_name} · {row.store_city}</td>
                    <td className="px-4 py-2">{row.stock_on_hand} pcs</td>
                    <td className="px-4 py-2 font-semibold">{money(row.cost_value)}</td>
                    <td className="px-4 py-2">{row.days_cover === null ? "нет продаж" : `${num(row.days_cover).toFixed(0)}d`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {slowQuery.isPending && <div className="grid py-12 place-items-center"><Loader2 className="size-6 animate-spin text-brand" /></div>}
            {!slowQuery.isPending && (slowQuery.data ?? []).length === 0 && (
              <p className="py-12 text-center text-sm text-muted-foreground">Залежавшихся позиций нет.</p>
            )}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
