import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Database,
  FileSpreadsheet,
  Loader2,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type TableName = "products" | "sales" | "stores" | "inventory";
type DataRow = Record<string, string | number>;
type Field = { key: string; label: string; type: "text" | "number" | "date" | "money"; aliases?: string[] };

const PAGE_SIZE = 100;

const configs: Record<TableName, { title: string; file: string; description: string; fields: Field[]; key: string; conflict: string }> = {
  products: {
    title: "Product catalog", file: "products.csv", description: "Names, categories, cost and prices",
    key: "product_id", conflict: "product_id",
    fields: [
      { key: "product_id", label: "Product ID", type: "number" }, { key: "product_name", label: "Name", type: "text" },
      { key: "product_category", label: "Category", type: "text" }, { key: "product_cost", label: "Cost", type: "money" },
      { key: "product_price", label: "Price", type: "money" },
    ],
  },
  sales: {
    title: "Sales", file: "sales.csv", description: "Sales by date, store and product",
    key: "sale_id", conflict: "sale_id",
    fields: [
      { key: "sale_id", label: "Sale ID", type: "number" }, { key: "sale_date", label: "Date", type: "date", aliases: ["date"] },
      { key: "store_id", label: "Store ID", type: "number" }, { key: "product_id", label: "Product ID", type: "number" },
      { key: "units", label: "Units", type: "number" },
    ],
  },
  stores: {
    title: "Stores", file: "stores.csv", description: "Stores, cities, addresses and opening dates",
    key: "store_id", conflict: "store_id",
    fields: [
      { key: "store_id", label: "Store ID", type: "number" }, { key: "store_name", label: "Name", type: "text" },
      { key: "store_city", label: "City", type: "text" }, { key: "store_location", label: "Location", type: "text" },
      { key: "store_open_date", label: "Open date", type: "date" },
    ],
  },
  inventory: {
    title: "Inventory", file: "inventory.csv", description: "Stock quantity at each store",
    key: "store_id", conflict: "store_id,product_id",
    fields: [
      { key: "store_id", label: "Store ID", type: "number" }, { key: "product_id", label: "Product ID", type: "number" },
      { key: "stock_on_hand", label: "Stock", type: "number" },
    ],
  },
};

export const Route = createFileRoute("/data")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Data management — ToyWorld" },
      { name: "description", content: "Import CSV files and manage ToyWorld products, sales, stores and inventory." },
      { property: "og:title", content: "Data management — ToyWorld" },
      { property: "og:description", content: "Import and manage ToyWorld operational data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DataPage,
  pendingComponent: () => <div className="grid min-h-screen place-items-center bg-background"><Loader2 className="size-7 animate-spin text-primary" /></div>,
  errorComponent: ({ error }) => <div className="grid min-h-screen place-items-center bg-background p-6"><div className="panel max-w-md text-center"><AlertTriangle className="mx-auto size-8 text-destructive" /><h1 className="mt-3 text-xl font-bold">Could not load data</h1><p className="mt-2 text-sm text-muted-foreground">{error.message}</p></div></div>,
  notFoundComponent: () => <div>Page not found</div>,
});

function DataPage() {
  const queryClient = useQueryClient();
  const [table, setTable] = useState<TableName>("products");
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [editor, setEditor] = useState<DataRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DataRow | "all" | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const fileRefs = useRef<Record<TableName, HTMLInputElement | null>>({ products: null, sales: null, stores: null, inventory: null });
  const config = configs[table];

  const queryKey = ["data-manager", table, page, appliedSearch];
  const { data } = useSuspenseQuery({
    queryKey,
    queryFn: () => loadRows(table, page, appliedSearch),
  });

  const totalPages = Math.max(1, Math.ceil(data.count / PAGE_SIZE));
  const emptyRow = useMemo(() => Object.fromEntries(config.fields.map((field) => [field.key, ""])), [config]);

  function switchTable(next: TableName) {
    setTable(next); setPage(0); setSearch(""); setAppliedSearch(""); setMessage(null);
  }

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["data-manager"] });
  }

  async function importFile(file: File, target: TableName) {
    setBusy(true); setMessage(null);
    try {
      const parsed = parseCsv(await file.text(), target);
      const cfg = configs[target];
      const unique = new Map<string, DataRow>();
      for (const row of parsed) {
        const dedupeKey = cfg.conflict.split(",").map((key) => row[key]).join("|");
        unique.set(dedupeKey, row);
      }
      const rows = [...unique.values()];
      for (let index = 0; index < rows.length; index += 500) {
        const chunk = rows.slice(index, index + 500);
        const { error } = await supabase.from(target).upsert(chunk as never, { onConflict: cfg.conflict });
        if (error) throw error;
      }
      await refresh();
      setMessage({ text: `Imported ${rows.length.toLocaleString("en-US")} rows. Duplicates removed: ${(parsed.length - rows.length).toLocaleString("en-US")}.` });
    } catch (error) {
      setMessage({ text: describeError(error, "Could not import the file."), error: true });
    } finally {
      setBusy(false);
      const input = fileRefs.current[target];
      if (input) input.value = "";
    }
  }

  async function saveRow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    setBusy(true); setMessage(null);
    try {
      const normalized = normalizeRow(editor, table);
      const { error } = await supabase.from(table).upsert(normalized as never, { onConflict: config.conflict });
      if (error) throw error;
      setEditor(null); await refresh(); setMessage({ text: "Record saved." });
    } catch (error) {
      setMessage({ text: describeError(error, "Could not save the record."), error: true });
    } finally { setBusy(false); }
  }

  async function removeRows() {
    if (!deleteTarget) return;
    setBusy(true); setMessage(null);
    try {
      let error: { message: string } | null = null;
      if (deleteTarget === "all") {
        if (table === "products") ({ error } = await supabase.from("products").delete().not("product_id", "is", null));
        else if (table === "sales") ({ error } = await supabase.from("sales").delete().not("sale_id", "is", null));
        else if (table === "stores") ({ error } = await supabase.from("stores").delete().not("store_id", "is", null));
        else ({ error } = await supabase.from("inventory").delete().not("store_id", "is", null));
      } else if (table === "inventory") {
        ({ error } = await supabase.from("inventory").delete().eq("store_id", Number(deleteTarget["store_id"])).eq("product_id", Number(deleteTarget["product_id"])));
      } else if (table === "products") {
        ({ error } = await supabase.from("products").delete().eq("product_id", Number(deleteTarget["product_id"])));
      } else if (table === "sales") {
        ({ error } = await supabase.from("sales").delete().eq("sale_id", Number(deleteTarget["sale_id"])));
      } else {
        ({ error } = await supabase.from("stores").delete().eq("store_id", Number(deleteTarget["store_id"])));
      }
      if (error) throw error;
      setDeleteTarget(null); setPage(0); await refresh(); setMessage({ text: deleteTarget === "all" ? "All records deleted." : "Record deleted." });
    } catch (error) {
      setMessage({ text: describeError(error, "Could not delete data."), error: true });
      setDeleteTarget(null);
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex h-20 max-w-[1600px] items-center gap-4 px-4 md:px-8">
          <Link to="/" className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"><Sparkles className="size-5" /></span><strong className="font-display text-xl">ToyWorld<span className="text-brand">.</span></strong></Link>
          <div className="ml-auto"><Button asChild variant="ghost" className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"><Link to="/"><ArrowLeft />Back to dashboard</Link></Button></div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-8 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-sm font-bold text-brand">Data center</p><h1 className="mt-1 font-display text-3xl font-extrabold md:text-4xl">Import & manage</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Re-upload CSV files any time. Matching keys are updated and duplicates are never created.</p></div>
          <Button onClick={() => setEditor(emptyRow)}><Plus />Add record</Button>
        </div>

        <section aria-label="File import" className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {(Object.keys(configs) as TableName[]).map((name) => {
            const item = configs[name];
            return <article key={name} className={`panel cursor-pointer transition ${table === name ? "border-primary ring-2 ring-primary/10" : "hover:border-ring"}`} onClick={() => switchTable(name)}>
              <div className="flex items-start justify-between gap-3"><span className="metric-icon metric-coral"><FileSpreadsheet className="size-5" /></span><span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold uppercase text-muted-foreground">CSV</span></div>
              <h2 className="mt-4 font-display text-base font-extrabold">{item.title}</h2><p className="mt-1 min-h-9 text-xs text-muted-foreground">{item.description}</p>
              <input ref={(node) => { fileRefs.current[name] = node; }} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importFile(file, name); }} />
              <Button disabled={busy} variant="outline" className="mt-4 w-full" onClick={(event) => { event.stopPropagation(); fileRefs.current[name]?.click(); }}><Upload />{item.file}</Button>
            </article>;
          })}
        </section>

        {message && <div role="status" className={`mt-5 flex items-center gap-2 rounded-md border p-3 text-sm font-semibold ${message.error ? "border-destructive/30 bg-destructive-soft text-destructive" : "border-success/30 bg-success/10 text-success"}`}>{message.error ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />}{message.text}</div>}

        <section className="panel mt-5 overflow-hidden p-0">
          <div className="flex flex-wrap items-center gap-3 border-b border-border p-5">
            <div><h2 className="font-display text-lg font-extrabold">{config.title}</h2><p className="text-xs text-muted-foreground">{data.count.toLocaleString("en-US")} records · {PAGE_SIZE} per page</p></div>
            <form className="relative ml-auto w-full sm:w-72" onSubmit={(event) => { event.preventDefault(); setPage(0); setAppliedSearch(search.trim()); }}><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск…" className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/20" /></form>
            <Button variant="destructive" size="sm" disabled={data.count === 0 || busy} onClick={() => setDeleteTarget("all")}><Trash2 />Удалить всё</Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">{config.fields.map((field) => <th key={field.key}>{field.label}</th>)}<th className="w-24 text-right">Действия</th></tr></thead><tbody>{data.rows.map((row, rowIndex) => <tr key={rowKey(row, table, rowIndex)} className="border-b border-border last:border-0 hover:bg-muted/30">{config.fields.map((field) => <td key={field.key}>{formatValue(row[field.key], field.type)}</td>)}<td><div className="flex justify-end gap-1"><Button aria-label="Изменить" title="Изменить" size="icon" variant="ghost" onClick={() => setEditor(row)}><Pencil /></Button><Button aria-label="Удалить" title="Удалить" size="icon" variant="ghost" className="text-destructive" onClick={() => setDeleteTarget(row)}><Trash2 /></Button></div></td></tr>)}</tbody></table>
            {data.rows.length === 0 && <div className="py-16 text-center"><Database className="mx-auto size-9 text-muted-foreground" /><p className="mt-3 text-sm font-bold">Данных пока нет</p><p className="mt-1 text-xs text-muted-foreground">Загрузите {config.file} или добавьте запись вручную.</p></div>}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4 text-sm"><span className="text-muted-foreground">Страница {page + 1} of {totalPages}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((value) => value - 1)}><ChevronLeft />Назад</Button><Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((value) => value + 1)}>Далее<ChevronRight /></Button></div></div>
        </section>
      </main>

      <Dialog open={editor !== null} onOpenChange={(open) => { if (!open) setEditor(null); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>{editor && String(editor[config.key] ?? "") ? "Изменить запись" : "Новая запись"}</DialogTitle><DialogDescription>Заполните все поля. Идентификаторы должны быть уникальными.</DialogDescription></DialogHeader>
          {editor && <form onSubmit={saveRow}><div className="grid gap-4 py-3 sm:grid-cols-2">{config.fields.map((field) => <label key={field.key} className="grid gap-1.5 text-sm font-semibold"><span>{field.label}</span><input required type={field.type === "date" ? "date" : field.type === "text" ? "text" : "number"} step={field.type === "money" ? "0.01" : field.type === "number" ? "1" : undefined} min={field.type === "number" || field.type === "money" ? "0" : undefined} value={String(editor[field.key] ?? "")} onChange={(event) => setEditor({ ...editor, [field.key]: event.target.value })} className="h-10 rounded-md border border-input bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring/20" /></label>)}</div><DialogFooter><Button type="button" variant="outline" onClick={() => setEditor(null)}>Отмена</Button><Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />}Сохранить</Button></DialogFooter></form>}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{deleteTarget === "all" ? `Удалить все данные «${config.title}»?` : "Удалить эту запись?"}</AlertDialogTitle><AlertDialogDescription>{deleteTarget === "all" ? "Это действие необратимо. Связанные продажи и остатки также могут быть удалены." : "Восстановить запись после удаления будет невозможно."}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Отмена</AlertDialogCancel><AlertDialogAction onClick={() => void removeRows()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Удалить</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

async function loadRows(table: TableName, page: number, search: string): Promise<{ rows: DataRow[]; count: number }> {
  let query = supabase.from(table).select("*", { count: "exact" });
  if (search) {
    const cfg = configs[table];
    const textFields = cfg.fields.filter((field) => field.type === "text").map((field) => field.key);
    const numericFields = cfg.fields.filter((field) => field.type === "number" && /^\d+$/.test(search)).map((field) => field.key);
    const filters = [...textFields.map((key) => `${key}.ilike.%${search.replaceAll(",", "")}%`), ...numericFields.map((key) => `${key}.eq.${search}`)];
    if (filters.length) query = query.or(filters.join(","));
  }
  const { data, count, error } = await query.order(configs[table].key, { ascending: true }).range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  if (error) throw error;
  return { rows: (data ?? []) as DataRow[], count: count ?? 0 };
}

function describeError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message
    : typeof error === "object" && error !== null && "message" in error && typeof (error as { message: unknown }).message === "string"
      ? (error as { message: string }).message
      : null;
  if (!message) return fallback;
  const lower = message.toLowerCase();
  if (lower.includes("foreign key") || lower.includes("violates foreign key constraint") || lower.includes("is not present in table")) {
    if (lower.includes("sales")) return "Sales ссылаются на магазин или товар, которого нет в базе. Сначала импортируйте stores.csv и products.csv, затем sales.csv.";
    if (lower.includes("inventory")) return "Inventory ссылаются на магазин или товар, которого нет в базе. Сначала импортируйте stores.csv и products.csv, затем inventory.csv.";
    return `Связанная запись не найдена: ${message}`;
  }
  if (lower.includes("row-level security")) return "No access to this table. Check the access rules in the database.";
  return message;
}

function parseCsv(text: string, table: TableName): DataRow[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("Файл пуст или не содержит строк данных.");
  const firstLine = lines[0];
  if (!firstLine) throw new Error("Файл не содержит заголовков.");
  const delimiter = firstLine.includes(";") ? ";" : ",";
  const matrix = lines.map((line) => splitCsvLine(line, delimiter));
  const expected = configs[table].fields.map((field) => field.key);
  const headerRow = matrix[0];
  if (!headerRow) throw new Error("Файл не содержит заголовков.");
  const aliasMap = new Map<string, string>();
  for (const field of configs[table].fields) {
    aliasMap.set(field.key.toLowerCase(), field.key);
    for (const alias of field.aliases ?? []) aliasMap.set(alias.toLowerCase(), field.key);
  }
  const headers = headerRow.map((header) => {
    const normalized = header.trim().toLowerCase();
    return aliasMap.get(normalized) ?? normalized;
  });
  const missing = expected.filter((field) => !headers.includes(field));
  if (missing.length) throw new Error(`Не найдены столбцы: ${missing.join(", ")}`);
  return matrix.slice(1).map((values, index) => {
    const raw = Object.fromEntries(headers.map((header, column) => [header, values[column]?.trim() ?? ""]));
    try { return normalizeRow(raw, table); } catch (error) { throw new Error(`Строка ${index + 2}: ${error instanceof Error ? error.message : "ошибка формата"}`); }
  });
}

function splitCsvLine(line: string, delimiter: string) {
  const values: string[] = []; let value = ""; let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"' && quoted) { value += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) { values.push(value); value = ""; }
    else value += char;
  }
  values.push(value); return values;
}

function normalizeRow(row: DataRow, table: TableName): DataRow {
  const result: DataRow = {};
  for (const field of configs[table].fields) {
    const raw = String(row[field.key] ?? "").trim();
    if (!raw) throw new Error(`поле ${field.label} обязательно`);
    if (field.type === "number") {
      const value = Number(raw); if (!Number.isInteger(value) || value < 0) throw new Error(`${field.label}: ожидается целое неотрицательное число`); result[field.key] = value;
    } else if (field.type === "money") {
      const value = Number(raw.replace(/[$€£\s]/g, "").replace(",", ".")); if (!Number.isFinite(value) || value < 0) throw new Error(`${field.label}: неверная сумма`); result[field.key] = value;
    } else if (field.type === "date") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(raw))) throw new Error(`${field.label}: используйте формат YYYY-MM-DD`); result[field.key] = raw;
    } else result[field.key] = raw;
  }
  if (table === "sales" && Number(result["units"]) < 1) throw new Error("Units должно быть больше нуля");
  return result;
}

function rowKey(row: DataRow, table: TableName, fallback: number) {
  return table === "inventory" ? `${row["store_id"]}-${row["product_id"]}` : String(row[configs[table].key] ?? fallback);
}

function formatValue(value: string | number | undefined, type: Field["type"]) {
  if (value === undefined) return "—";
  if (type === "money") return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value));
  if (type === "date") return new Intl.DateTimeFormat("en-US").format(new Date(`${String(value)}T00:00:00`));
  return String(value);
}