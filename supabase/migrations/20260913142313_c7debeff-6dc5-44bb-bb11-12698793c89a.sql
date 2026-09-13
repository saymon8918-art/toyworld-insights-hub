
-- KPI summary with comparison to the previous period of equal length
CREATE OR REPLACE FUNCTION public.dashboard_kpis(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_store_id bigint DEFAULT NULL
)
RETURNS TABLE (
  revenue numeric,
  units bigint,
  order_count bigint,
  store_count bigint,
  top_category text,
  top_category_share numeric,
  prev_revenue numeric,
  prev_units bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
WITH bounds AS (
  SELECT
    COALESCE(p_from, (SELECT MIN(sale_date) FROM sales)) AS d_from,
    COALESCE(p_to, (SELECT MAX(sale_date) FROM sales)) AS d_to
),
prev AS (
  SELECT d_from - (d_to - d_from + 1) AS d_from, d_from - 1 AS d_to FROM bounds
),
cur AS (
  SELECT s.units, s.units * p.product_price AS amount, p.product_category, s.store_id
  FROM sales s
  JOIN products p ON p.product_id = s.product_id
  CROSS JOIN bounds b
  WHERE s.sale_date BETWEEN b.d_from AND b.d_to
    AND (p_store_id IS NULL OR s.store_id = p_store_id)
),
prv AS (
  SELECT s.units, s.units * p.product_price AS amount
  FROM sales s
  JOIN products p ON p.product_id = s.product_id
  CROSS JOIN prev pr
  WHERE s.sale_date BETWEEN pr.d_from AND pr.d_to
    AND (p_store_id IS NULL OR s.store_id = p_store_id)
),
cats AS (
  SELECT product_category, SUM(amount) AS amount FROM cur GROUP BY product_category
)
SELECT
  COALESCE((SELECT SUM(amount) FROM cur), 0)::numeric,
  COALESCE((SELECT SUM(units) FROM cur), 0)::bigint,
  (SELECT COUNT(*) FROM cur)::bigint,
  COALESCE((SELECT COUNT(DISTINCT store_id) FROM cur), 0)::bigint,
  (SELECT product_category FROM cats ORDER BY amount DESC LIMIT 1),
  COALESCE(
    (SELECT ROUND(MAX(amount) * 100 / NULLIF(SUM(amount), 0), 1) FROM cats),
    0
  )::numeric,
  COALESCE((SELECT SUM(amount) FROM prv), 0)::numeric,
  COALESCE((SELECT SUM(units) FROM prv), 0)::bigint;
$$;

-- Sales trend bucketed by day / week / month
CREATE OR REPLACE FUNCTION public.dashboard_sales_trend(
  p_grain text DEFAULT 'day',
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_store_id bigint DEFAULT NULL
)
RETURNS TABLE (bucket date, label text, sales numeric, units bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
WITH bounds AS (
  SELECT
    COALESCE(p_from, (SELECT MIN(sale_date) FROM sales)) AS d_from,
    COALESCE(p_to, (SELECT MAX(sale_date) FROM sales)) AS d_to
),
rows_ AS (
  SELECT
    date_trunc(
      CASE WHEN p_grain = 'month' THEN 'month' WHEN p_grain = 'week' THEN 'week' ELSE 'day' END,
      s.sale_date
    )::date AS bucket,
    s.units,
    s.units * p.product_price AS amount
  FROM sales s
  JOIN products p ON p.product_id = s.product_id
  CROSS JOIN bounds b
  WHERE s.sale_date BETWEEN b.d_from AND b.d_to
    AND (p_store_id IS NULL OR s.store_id = p_store_id)
)
SELECT
  bucket,
  CASE
    WHEN p_grain = 'month' THEN to_char(bucket, 'Mon YYYY')
    WHEN p_grain = 'week' THEN to_char(bucket, 'DD Mon')
    ELSE to_char(bucket, 'DD Mon')
  END,
  ROUND(SUM(amount), 2)::numeric,
  SUM(units)::bigint
FROM rows_
GROUP BY bucket
ORDER BY bucket;
$$;

-- Revenue split by product category
CREATE OR REPLACE FUNCTION public.dashboard_category_sales(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_store_id bigint DEFAULT NULL
)
RETURNS TABLE (category text, revenue numeric, units bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
WITH bounds AS (
  SELECT
    COALESCE(p_from, (SELECT MIN(sale_date) FROM sales)) AS d_from,
    COALESCE(p_to, (SELECT MAX(sale_date) FROM sales)) AS d_to
)
SELECT p.product_category,
       ROUND(SUM(s.units * p.product_price), 2)::numeric,
       SUM(s.units)::bigint
FROM sales s
JOIN products p ON p.product_id = s.product_id
CROSS JOIN bounds b
WHERE s.sale_date BETWEEN b.d_from AND b.d_to
  AND (p_store_id IS NULL OR s.store_id = p_store_id)
GROUP BY p.product_category
ORDER BY 2 DESC;
$$;

-- Most recent sales with store / product details
CREATE OR REPLACE FUNCTION public.dashboard_recent_sales(
  p_limit integer DEFAULT 10,
  p_store_id bigint DEFAULT NULL,
  p_search text DEFAULT NULL
)
RETURNS TABLE (
  sale_id bigint,
  sale_date date,
  store_name text,
  store_city text,
  product_name text,
  product_category text,
  units integer,
  total numeric
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
SELECT s.sale_id, s.sale_date, st.store_name, st.store_city,
       p.product_name, p.product_category, s.units,
       ROUND(s.units * p.product_price, 2)::numeric
FROM sales s
JOIN products p ON p.product_id = s.product_id
JOIN stores st ON st.store_id = s.store_id
WHERE (p_store_id IS NULL OR s.store_id = p_store_id)
  AND (
    p_search IS NULL OR p_search = ''
    OR p.product_name ILIKE '%' || p_search || '%'
    OR st.store_name ILIKE '%' || p_search || '%'
    OR st.store_city ILIKE '%' || p_search || '%'
    OR p.product_category ILIKE '%' || p_search || '%'
    OR s.sale_id::text = p_search
  )
ORDER BY s.sale_date DESC, s.sale_id DESC
LIMIT LEAST(GREATEST(p_limit, 1), 200);
$$;

-- Low stock alerts
CREATE OR REPLACE FUNCTION public.dashboard_low_stock(
  p_threshold integer DEFAULT 10,
  p_limit integer DEFAULT 8,
  p_store_id bigint DEFAULT NULL
)
RETURNS TABLE (
  store_id bigint,
  product_id bigint,
  product_name text,
  product_category text,
  store_name text,
  store_city text,
  stock_on_hand integer
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
SELECT i.store_id, i.product_id, p.product_name, p.product_category,
       st.store_name, st.store_city, i.stock_on_hand
FROM inventory i
JOIN products p ON p.product_id = i.product_id
JOIN stores st ON st.store_id = i.store_id
WHERE i.stock_on_hand <= p_threshold
  AND (p_store_id IS NULL OR i.store_id = p_store_id)
ORDER BY i.stock_on_hand ASC, p.product_name ASC
LIMIT LEAST(GREATEST(p_limit, 1), 100);
$$;

-- Available sales date range
CREATE OR REPLACE FUNCTION public.dashboard_date_bounds()
RETURNS TABLE (min_date date, max_date date, sale_rows bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
SELECT MIN(sale_date), MAX(sale_date), COUNT(*)::bigint FROM sales;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_kpis(date, date, bigint) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dashboard_sales_trend(text, date, date, bigint) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dashboard_category_sales(date, date, bigint) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dashboard_recent_sales(integer, bigint, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dashboard_low_stock(integer, integer, bigint) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dashboard_date_bounds() TO anon, authenticated, service_role;
