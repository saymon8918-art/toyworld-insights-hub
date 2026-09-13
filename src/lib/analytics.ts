import { supabase } from "@/integrations/supabase/client";

type RpcClient = {
  rpc: (fn: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T[]> {
  const client = supabase as unknown as RpcClient;
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

export const num = (value: unknown) => Number(value ?? 0);
export const money = (value: unknown) => `$${Math.round(num(value)).toLocaleString("en-US")}`;
export const compactMoney = (value: unknown) => {
  const amount = num(value);
  if (Math.abs(amount) >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (Math.abs(amount) >= 1000) return `$${Math.round(amount / 1000)}k`;
  return `$${Math.round(amount)}`;
};
export const int = (value: unknown) => Math.round(num(value)).toLocaleString("ru-RU");
export const pct = (value: unknown) => `${num(value).toFixed(1)}%`;
export const days = (value: unknown) => (value === null || value === undefined ? "—" : `${num(value).toFixed(0)} дн.`);

export const chartColors = [
  "var(--chart-coral)",
  "var(--chart-teal)",
  "var(--chart-yellow)",
  "var(--chart-blue)",
  "var(--brand)",
  "var(--chart-grid)",
];

export type StoreOption = { store_id: number; store_name: string; store_city: string };

export async function fetchStores(): Promise<StoreOption[]> {
  const { data, error } = await supabase
    .from("stores")
    .select("store_id, store_name, store_city")
    .order("store_name")
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as StoreOption[];
}
