CREATE OR REPLACE FUNCTION public.analytics_cover_buckets(p_days integer DEFAULT 28, p_store_id bigint DEFAULT NULL::bigint)
 RETURNS TABLE(bucket text, sort_order integer, sku_rows bigint, units bigint, cost_value numeric, share_pct numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
WITH b AS (SELECT (SELECT MAX(sale_date) FROM sales) t),
w AS (SELECT t, t - (GREATEST(p_days,1) - 1) f FROM b),
d AS (
  SELECT s.store_id sid, s.product_id pid, SUM(s.units)::numeric / GREATEST(p_days,1) daily
  FROM sales s CROSS JOIN w WHERE s.sale_date BETWEEN w.f AND w.t GROUP BY 1,2),
j AS (
  SELECT i.stock_on_hand stock, p.product_cost cost, COALESCE(d.daily,0) daily
  FROM inventory i JOIN products p ON p.product_id = i.product_id
  LEFT JOIN d ON d.sid = i.store_id AND d.pid = i.product_id
  WHERE p_store_id IS NULL OR i.store_id = p_store_id),
k AS (
  SELECT stock, cost, daily,
    CASE
      WHEN stock = 0 THEN 'Out of stock'
      WHEN daily = 0 THEN 'No sales (dead stock)'
      WHEN stock/daily < 7 THEN 'Under 7 days'
      WHEN stock/daily < 30 THEN '7-30 days'
      WHEN stock/daily < 90 THEN '30-90 days'
      ELSE 'Over 90 days'
    END bk,
    CASE
      WHEN stock = 0 THEN 1
      WHEN daily = 0 THEN 6
      WHEN stock/daily < 7 THEN 2
      WHEN stock/daily < 30 THEN 3
      WHEN stock/daily < 90 THEN 4
      ELSE 5
    END so
  FROM j),
g AS (SELECT bk, so, COUNT(*) rows_, SUM(stock) u, SUM(stock*cost) cv FROM k GROUP BY bk, so)
SELECT bk, so::int, rows_::bigint, COALESCE(u,0)::bigint, ROUND(COALESCE(cv,0),2),
       ROUND(COALESCE(cv,0)*100/NULLIF((SELECT SUM(cv) FROM g),0),1)
FROM g ORDER BY so;
$function$;