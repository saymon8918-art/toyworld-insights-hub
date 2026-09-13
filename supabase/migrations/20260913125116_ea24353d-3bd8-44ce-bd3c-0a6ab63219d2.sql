CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.products (
  product_id bigint PRIMARY KEY,
  product_name text NOT NULL,
  product_category text NOT NULL,
  product_cost numeric(12,2) NOT NULL CHECK (product_cost >= 0),
  product_price numeric(12,2) NOT NULL CHECK (product_price >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO anon, authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read products" ON public.products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public can add products" ON public.products FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public can edit products" ON public.products FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public can delete products" ON public.products FOR DELETE TO anon, authenticated USING (true);
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.stores (
  store_id bigint PRIMARY KEY,
  store_name text NOT NULL,
  store_city text NOT NULL,
  store_location text NOT NULL,
  store_open_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores TO anon, authenticated;
GRANT ALL ON public.stores TO service_role;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read stores" ON public.stores FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public can add stores" ON public.stores FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public can edit stores" ON public.stores FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public can delete stores" ON public.stores FOR DELETE TO anon, authenticated USING (true);
CREATE TRIGGER stores_updated_at BEFORE UPDATE ON public.stores FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.sales (
  sale_id bigint PRIMARY KEY,
  sale_date date NOT NULL,
  store_id bigint NOT NULL REFERENCES public.stores(store_id) ON UPDATE CASCADE ON DELETE CASCADE,
  product_id bigint NOT NULL REFERENCES public.products(product_id) ON UPDATE CASCADE ON DELETE CASCADE,
  units integer NOT NULL CHECK (units > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO anon, authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read sales" ON public.sales FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public can add sales" ON public.sales FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public can edit sales" ON public.sales FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public can delete sales" ON public.sales FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX sales_date_idx ON public.sales (sale_date DESC);
CREATE INDEX sales_store_id_idx ON public.sales (store_id);
CREATE INDEX sales_product_id_idx ON public.sales (product_id);
CREATE TRIGGER sales_updated_at BEFORE UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.inventory (
  store_id bigint NOT NULL REFERENCES public.stores(store_id) ON UPDATE CASCADE ON DELETE CASCADE,
  product_id bigint NOT NULL REFERENCES public.products(product_id) ON UPDATE CASCADE ON DELETE CASCADE,
  stock_on_hand integer NOT NULL CHECK (stock_on_hand >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory TO anon, authenticated;
GRANT ALL ON public.inventory TO service_role;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read inventory" ON public.inventory FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public can add inventory" ON public.inventory FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public can edit inventory" ON public.inventory FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public can delete inventory" ON public.inventory FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX inventory_product_id_idx ON public.inventory (product_id);
CREATE TRIGGER inventory_updated_at BEFORE UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();