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
  { key: 14, label: "14 дней" },
  { key: 28, label: "28 дней" },
  { key: 56, label: "56 дней" },
] as const;

export const Route = createFileRoute("/availability")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Потери продаж из-за нехватки товара — ToyWorld" },
      { name: "description", content: "Где магазины теряют продажи из-за отсутствия игрушек на складе и сколько это стоит в деньгах каждую неделю." },
      { property: "og:title", content: "Потери продаж из-за нехватки товара — ToyWorld" },
      { property: "og:description", content: "Наличие товара, дефицитные позиции и оценка недополученной выручки по магазинам." },
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
        <h2 className="font-display text-xl font-extrabold">Не удалось загрузить данные</h2>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </div>
  ),
  notFoundComponent: () => <div className="p-10 text-center">Страница не найдена.</div>,
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
      eyebrow="Вопрос 2"
      title="Теряем ли мы продажи из-за отсутствия товара?"
      subtitle={`Спрос берётся по фактическим продажам за последние ${windowDays} дней. Потери за неделю = (недельный спрос − текущий остаток) × цена. Позиции с нулевым остатком, но живым спросом — прямые потери.`}
      controls={
        <>
          <div className="control-wrap">
            <MapPin className="size-4 text-muted-foreground" />
            <select aria-label="Магазин" value={storeId} onChange={(event) => setStoreId(event.target.value)} className="max-w-52 bg-transparent text-sm font-semibold outline-none">
              <option value="all">Все магазины</option>
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
      <section aria-label="Итоги" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Потери выручки в неделю"
          value={summary ? money(summary.lost_revenue_week) : "—"}
          hint={summary ? `Из них прибыль ${money(summary.lost_profit_week)}` : ""}
          tone="coral"
          icon={<TrendingDown className="size-5" />}
        />
        <Stat
          label="Нет в наличии"
          value={summary ? int(summary.out_of_stock) : "—"}
          hint={summary ? `позиций со спросом в ${int(summary.affected_stores)} магазинах` : ""}
          tone="yellow"
          icon={<PackageX className="size-5" />}
        />
        <Stat
          label="Наличие товара"
          value={summary ? pct(summary.availability_pct) : "—"}
          hint={summary ? `${int(summary.tracked_pairs)} отслеживаемых пар магазин-товар` : ""}
          tone="teal"
          icon={<ShoppingCart className="size-5" />}
        />
        <Stat
          label="Закончится за неделю"
          value={summary ? int(summary.at_risk) : "—"}
          hint="позиций с запасом меньше 7 дней"
          tone="blue"
          icon={<AlertTriangle className="size-5" />}
        />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <div className="panel min-w-0">
          <div className="panel-heading">
            <div>
              <h2>Потери по категориям</h2>
              <p>Недополученная выручка за неделю и её доля в потенциале</p>
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
                  <Bar dataKey="rev" name="Потенциал за неделю" fill="var(--chart-blue)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="lost" name="Потери" fill="var(--chart-coral)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-4 space-y-2 text-sm">
            {(lostCategoryQuery.data ?? []).map((row) => (
              <div key={row.category} className="flex items-center gap-3">
                <span className="flex-1 truncate text-muted-foreground">{row.category}</span>
                <span className="text-xs text-muted-foreground">{int(row.out_of_stock)} позиций без остатка</span>
                <strong className="text-destructive">{pct(row.loss_ratio_pct)}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="panel min-w-0 p-0">
          <div className="panel-heading border-b border-border p-5 md:p-6">
            <div>
              <h2>Магазины с наибольшими потерями</h2>
              <p>Доля потерь считается от недельного потенциала магазина</p>
            </div>
          </div>
          <div className="max-h-[430px] overflow-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="sticky top-0 bg-muted/70 backdrop-blur">
                <tr className="text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-3">Магазин</th><th className="px-4 py-3">Нет в наличии</th><th className="px-4 py-3">Наличие</th><th className="px-4 py-3">Потери/нед.</th><th className="px-4 py-3">Доля потерь</th>
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
            <h2>Позиции, которые надо срочно пополнить</h2>
            <p>Спрос есть, запаса не хватает до конца недели</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
                <th>Товар</th><th>Категория</th><th>Магазин</th><th>Остаток</th><th>Спрос/день</th><th>Хватит на</th><th>Дефицит/нед.</th><th>Потери/нед.</th>
              </tr>
            </thead>
            <tbody>
              {(itemsQuery.data ?? []).map((row) => (
                <tr key={`${row.store_id}-${row.product_id}`} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="font-bold">{row.product_name}</td>
                  <td className="text-muted-foreground">{row.category}</td>
                  <td className="text-muted-foreground">{row.store_name} · {row.store_city}</td>
                  <td className={row.stock_on_hand === 0 ? "font-bold text-destructive" : "font-semibold"}>{row.stock_on_hand} шт.</td>
                  <td>{num(row.daily_units).toFixed(2)}</td>
                  <td>{row.days_cover === null ? "—" : `${num(row.days_cover).toFixed(1)} дн.`}</td>
                  <td>{Math.ceil(num(row.lost_units_week))} шт.</td>
                  <td className="font-semibold text-destructive">{money(row.lost_revenue_week)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {itemsQuery.isPending && <div className="grid py-12 place-items-center"><Loader2 className="size-6 animate-spin text-brand" /></div>}
          {!itemsQuery.isPending && (itemsQuery.data ?? []).length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">Дефицитных позиций нет — запасов хватает на всю неделю.</p>
          )}
        </div>
      </section>

      <section className="mt-5 panel overflow-hidden p-0">
        <div className="panel-heading border-b border-border p-5 md:p-6">
          <div>
            <h2>Пропущенный ассортимент</h2>
            <p>Товары хорошо продаются в сети, но в этих магазинах их нет ни в остатках, ни в продажах — оценка упущенной выручки {money(gapTotal)} в неделю</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
                <th>Магазин</th><th>Товар</th><th>Категория</th><th>Продаётся в магазинах</th><th>Спрос/день на точку</th><th>Упущено/нед.</th>
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
            <p className="py-12 text-center text-sm text-muted-foreground">Пропусков в ассортименте не найдено.</p>
          )}
        </div>
      </section>
    </AppShell>
  );
}
