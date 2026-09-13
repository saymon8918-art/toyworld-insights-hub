import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Boxes, Coins, Loader2, Percent, TrendingUp } from "lucide-react";
import { AppShell, Stat } from "@/components/AppShell";
import { chartColors, compactMoney, int, money, num, pct, rpc } from "@/lib/analytics";

type Summary = { revenue: number; cost: number; profit: number; margin_pct: number; units: number; store_count: number };
type CategoryRow = {
  category: string;
  revenue: number;
  cost: number;
  profit: number;
  margin_pct: number;
  units: number;
  profit_share: number;
  sku_count: number;
};
type MatrixRow = {
  store_id: number;
  store_name: string;
  store_city: string;
  store_location: string;
  category: string;
  revenue: number;
  profit: number;
  units: number;
  store_profit: number;
  share_pct: number;
};
type LocationRow = { store_location: string; category: string; profit: number; revenue: number; share_pct: number; store_count: number };
type ProductRow = { product_id: number; product_name: string; category: string; revenue: number; profit: number; margin_pct: number; units: number };
type Bounds = { min_date: string | null; max_date: string | null; sale_rows: number };

const rangeOptions = [
  { key: "all", label: "Весь период" },
  { key: "90", label: "90 дней" },
  { key: "30", label: "30 дней" },
] as const;

function shiftDays(date: string, delta: number) {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + delta);
  return parsed.toISOString().slice(0, 10);
}

export const Route = createFileRoute("/profit")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Прибыль по категориям и магазинам — ToyWorld" },
      { name: "description", content: "Какие категории игрушек приносят наибольшую прибыль и одинаково ли это во всех магазинах сети." },
      { property: "og:title", content: "Прибыль по категориям и магазинам — ToyWorld" },
      { property: "og:description", content: "Валовая прибыль, маржа и структура заработка по категориям и точкам продаж." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfitPage,
  pendingComponent: () => (
    <div className="grid min-h-screen place-items-center">
      <Loader2 className="size-8 animate-spin text-brand" />
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="panel max-w-md text-center" role="alert">
        <h2 className="font-display text-xl font-extrabold">Не удалось загрузить данные</h2>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </div>
  ),
  notFoundComponent: () => <div className="p-10 text-center">Страница не найдена.</div>,
});

function ProfitPage() {
  const [rangeKey, setRangeKey] = useState<"all" | "90" | "30">("all");

  const boundsQuery = useQuery({
    queryKey: ["bounds"],
    queryFn: () => rpc<Bounds>("dashboard_date_bounds").then((rows) => rows[0] ?? null),
  });
  const maxDate = boundsQuery.data?.max_date ?? null;
  const range = useMemo(() => {
    if (!maxDate) return { from: null as string | null, to: null as string | null };
    if (rangeKey === "all") return { from: boundsQuery.data?.min_date ?? null, to: maxDate };
    return { from: shiftDays(maxDate, -(Number(rangeKey) - 1)), to: maxDate };
  }, [boundsQuery.data?.min_date, maxDate, rangeKey]);

  const enabled = Boolean(maxDate);
  const args = { p_from: range.from, p_to: range.to };

  const summaryQuery = useQuery({
    queryKey: ["profit", "summary", range.from, range.to],
    enabled,
    queryFn: () => rpc<Summary>("analytics_profit_summary", { ...args, p_store_id: null }).then((rows) => rows[0] ?? null),
  });
  const categoryQuery = useQuery({
    queryKey: ["profit", "categories", range.from, range.to],
    enabled,
    queryFn: () => rpc<CategoryRow>("analytics_category_profit", { ...args, p_store_id: null }),
  });
  const matrixQuery = useQuery({
    queryKey: ["profit", "matrix", range.from, range.to],
    enabled,
    queryFn: () => rpc<MatrixRow>("analytics_store_category_profit", args),
  });
  const locationQuery = useQuery({
    queryKey: ["profit", "locations", range.from, range.to],
    enabled,
    queryFn: () => rpc<LocationRow>("analytics_location_category_profit", args),
  });
  const productQuery = useQuery({
    queryKey: ["profit", "products", range.from, range.to],
    enabled,
    queryFn: () => rpc<ProductRow>("analytics_product_profit", { ...args, p_store_id: null, p_limit: 10 }),
  });

  const summary = summaryQuery.data ?? null;
  const categories = categoryQuery.data ?? [];
  const categoryNames = useMemo(() => categories.map((row) => row.category), [categories]);
  const chainTop = categories[0]?.category ?? null;

  const stores = useMemo(() => {
    const rows = matrixQuery.data ?? [];
    const map = new Map<number, { name: string; city: string; location: string; profit: number; shares: Record<string, number>; top: string }>();
    for (const row of rows) {
      const entry = map.get(row.store_id) ?? {
        name: row.store_name,
        city: row.store_city,
        location: row.store_location,
        profit: num(row.store_profit),
        shares: {},
        top: row.category,
      };
      entry.shares[row.category] = num(row.share_pct);
      if (num(row.share_pct) > num(entry.shares[entry.top] ?? 0)) entry.top = row.category;
      map.set(row.store_id, entry);
    }
    return [...map.entries()]
      .map(([store_id, value]) => ({ store_id, ...value }))
      .sort((a, b) => b.profit - a.profit);
  }, [matrixQuery.data]);

  const deviating = stores.filter((store) => chainTop && store.top !== chainTop);

  const locationChart = useMemo(() => {
    const rows = locationQuery.data ?? [];
    const map = new Map<string, Record<string, number | string>>();
    for (const row of rows) {
      const entry = map.get(row.store_location) ?? { location: row.store_location };
      entry[row.category] = num(row.profit);
      map.set(row.store_location, entry);
    }
    return [...map.values()];
  }, [locationQuery.data]);

  const donutData = categories.map((row, index) => ({
    name: row.category,
    value: num(row.profit),
    color: chartColors[index % chartColors.length],
  }));

  const loading = summaryQuery.isPending || categoryQuery.isPending;

  return (
    <AppShell
      eyebrow="Вопрос 1"
      title="Какие категории приносят наибольшую прибыль?"
      subtitle={`Прибыль считается как (цена − себестоимость) × количество проданных единиц. Период: ${range.from ?? "—"} — ${range.to ?? "—"}.`}
      controls={
        <div className="segmented">
          {rangeOptions.map((option) => (
            <button key={option.key} onClick={() => setRangeKey(option.key)} className={rangeKey === option.key ? "segmented-active" : ""}>
              {option.label}
            </button>
          ))}
        </div>
      }
    >
      <section aria-label="Итоги" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Валовая прибыль" value={summary ? money(summary.profit) : "—"} hint={summary ? `Выручка ${money(summary.revenue)}` : ""} tone="coral" icon={<Coins className="size-5" />} />
        <Stat label="Средняя маржа" value={summary ? pct(summary.margin_pct) : "—"} hint={summary ? `Себестоимость ${money(summary.cost)}` : ""} tone="teal" icon={<Percent className="size-5" />} />
        <Stat label="Топ категория по прибыли" value={chainTop ?? "—"} hint={categories[0] ? `${pct(categories[0].profit_share)} всей прибыли сети` : ""} tone="yellow" icon={<Boxes className="size-5" />} />
        <Stat label="Магазинов с иным лидером" value={String(deviating.length)} hint={`из ${stores.length} магазинов сети`} tone="blue" icon={<TrendingUp className="size-5" />} />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.9fr)]">
        <div className="panel min-w-0">
          <div className="panel-heading">
            <div>
              <h2>Прибыль и маржа по категориям</h2>
              <p>Сколько зарабатывает каждая категория и какая у неё рентабельность</p>
            </div>
          </div>
          <div className="mt-6 h-80">
            {loading ? (
              <div className="grid h-full place-items-center"><Loader2 className="size-6 animate-spin text-brand" /></div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categories.map((row) => ({ ...row, profit: num(row.profit), revenue: num(row.revenue) }))}>
                  <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="category" axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={compactMoney} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number, name) => (name === "Маржа" ? pct(value) : money(value))}
                    contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--popover)", fontSize: 12 }}
                  />
                  <Legend />
                  <Bar dataKey="revenue" name="Выручка" fill="var(--chart-blue)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="profit" name="Прибыль" fill="var(--brand)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
                  <th>Категория</th><th>Прибыль</th><th>Доля прибыли</th><th>Маржа</th><th>Продано, шт.</th><th>Товаров</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((row) => (
                  <tr key={row.category} className="border-b border-border last:border-0">
                    <td className="font-bold">{row.category}</td>
                    <td className="font-semibold">{money(row.profit)}</td>
                    <td>{pct(row.profit_share)}</td>
                    <td>{pct(row.margin_pct)}</td>
                    <td className="text-muted-foreground">{int(row.units)}</td>
                    <td className="text-muted-foreground">{row.sku_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>Структура прибыли</h2>
              <p>Доля категорий в общей прибыли сети</p>
            </div>
          </div>
          <div className="relative mx-auto mt-5 h-56 max-w-64">
            {donutData.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} dataKey="value" innerRadius={62} outerRadius={88} paddingAngle={3} stroke="none">
                    {donutData.map((item) => <Cell key={item.name} fill={item.color} />)}
                  </Pie>
                  <Tooltip formatter={(value: number, name) => [money(value), String(name)]} />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <strong className="font-display text-2xl">{summary ? compactMoney(summary.profit) : "—"}</strong>
                <p className="text-xs text-muted-foreground">Прибыль</p>
              </div>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {donutData.map((item) => (
              <div key={item.name} className="flex items-center gap-3 text-sm">
                <span className="size-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                <span className="flex-1 truncate text-muted-foreground">{item.name}</span>
                <strong>{money(item.value)}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <div className="panel min-w-0">
          <div className="panel-heading">
            <div>
              <h2>Прибыль по типам локаций</h2>
              <p>Одинаково ли работают категории в разных типах точек</p>
            </div>
          </div>
          <div className="mt-6 h-72">
            {locationChart.length === 0 ? (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">Нет данных</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={locationChart}>
                  <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="location" axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={compactMoney} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                  <Tooltip formatter={(value: number, name) => [money(value), String(name)]} contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--popover)", fontSize: 12 }} />
                  <Legend />
                  {categoryNames.map((name, index) => (
                    <Bar key={name} dataKey={name} stackId="loc" fill={chartColors[index % chartColors.length]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="panel min-w-0">
          <div className="panel-heading">
            <div>
              <h2>Магазины с другим лидером</h2>
              <p>Здесь больше всего зарабатывает не «{chainTop ?? "—"}»</p>
            </div>
          </div>
          <div className="mt-4 max-h-80 overflow-auto">
            {deviating.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Во всех магазинах лидирует одна и та же категория — структура прибыли одинаковая.
              </p>
            ) : (
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
                    <th>Магазин</th><th>Лидер</th><th>Доля</th><th>Прибыль</th>
                  </tr>
                </thead>
                <tbody>
                  {deviating.map((store) => (
                    <tr key={store.store_id} className="border-b border-border last:border-0">
                      <td className="font-semibold">{store.name} · <span className="text-muted-foreground">{store.city}</span></td>
                      <td className="font-bold text-primary">{store.top}</td>
                      <td>{pct(store.shares[store.top])}</td>
                      <td>{money(store.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>

      <section className="mt-5 panel overflow-hidden p-0">
        <div className="panel-heading border-b border-border p-5 md:p-6">
          <div>
            <h2>Матрица: магазин × категория</h2>
            <p>Доля категории в прибыли магазина — тёмнее значит важнее для точки</p>
          </div>
        </div>
        <div className="max-h-[520px] overflow-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="sticky top-0 bg-muted/70 backdrop-blur">
              <tr className="text-xs uppercase text-muted-foreground">
                <th className="px-4 py-3">Магазин</th>
                <th className="px-4 py-3">Тип</th>
                {categoryNames.map((name) => <th key={name} className="px-4 py-3">{name}</th>)}
                <th className="px-4 py-3">Прибыль</th>
              </tr>
            </thead>
            <tbody>
              {stores.map((store) => (
                <tr key={store.store_id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 font-semibold">{store.name} · <span className="text-muted-foreground">{store.city}</span></td>
                  <td className="px-4 py-2 text-muted-foreground">{store.location}</td>
                  {categoryNames.map((name) => {
                    const share = num(store.shares[name]);
                    return (
                      <td key={name} className="px-4 py-2">
                        <span
                          className="inline-block min-w-14 rounded-md px-2 py-1 text-center text-xs font-bold"
                          style={{ backgroundColor: `color-mix(in oklab, var(--brand) ${Math.min(share * 2, 90)}%, transparent)` }}
                        >
                          {share ? `${share.toFixed(0)}%` : "—"}
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-4 py-2 font-semibold">{money(store.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {matrixQuery.isPending && <div className="grid py-12 place-items-center"><Loader2 className="size-6 animate-spin text-brand" /></div>}
        </div>
      </section>

      <section className="mt-5 panel overflow-hidden p-0">
        <div className="panel-heading border-b border-border p-5 md:p-6">
          <div>
            <h2>Топ товаров по прибыли</h2>
            <p>Что именно зарабатывает больше всего внутри категорий</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
                <th>Товар</th><th>Категория</th><th>Прибыль</th><th>Выручка</th><th>Маржа</th><th>Продано, шт.</th>
              </tr>
            </thead>
            <tbody>
              {(productQuery.data ?? []).map((row) => (
                <tr key={row.product_id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="font-bold">{row.product_name}</td>
                  <td className="text-muted-foreground">{row.category}</td>
                  <td className="font-semibold">{money(row.profit)}</td>
                  <td>{money(row.revenue)}</td>
                  <td>{pct(row.margin_pct)}</td>
                  <td className="text-muted-foreground">{int(row.units)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
