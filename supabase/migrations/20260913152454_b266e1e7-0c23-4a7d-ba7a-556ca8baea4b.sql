
-- ============ PROFIT ============
CREATE OR REPLACE FUNCTION public.analytics_profit_summary(p_from date DEFAULT NULL, p_to date DEFAULT NULL, p_store_id bigint DEFAULT NULL)
RETURNS TABLE(revenue numeric, cost numeric, profit numeric, margin_pct numeric, units bigint, store_count bigint)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
WITH b AS (SELECT COALESCE(p_from,(SELECT MIN(sale_date) FROM sales)) f, COALESCE(p_to,(SELECT MAX(sale_date) FROM sales)) t),
r AS (
  SELECT s.units, s.store_id, s.units*p.product_price amt, s.units*p.product_cost cst
  FROM sales s JOIN products p USING(product_id) CROSS JOIN b
  WHERE s.sale_date BETWEEN b.f AND b.t AND (p_store_id IS NULL OR s.store_id = p_store_id))
SELECT ROUND(COALESCE(SUM(amt),0),2), ROUND(COALESCE(SUM(cst),0),2), ROUND(COALESCE(SUM(amt-cst),0),2),
       ROUND(COALESCE(SUM(amt-cst)*100/NULLIF(SUM(amt),0),0),1), COALESCE(SUM(units),0)::bigint,
       COUNT(DISTINCT store_id)::bigint
FROM r;
$$;

CREATE OR REPLACE FUNCTION public.analytics_category_profit(p_from date DEFAULT NULL, p_to date DEFAULT NULL, p_store_id bigint DEFAULT NULL)
RETURNS TABLE(category text, revenue numeric, cost numeric, profit numeric, margin_pct numeric, units bigint, profit_share numeric, sku_count bigint)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
WITH b AS (SELECT COALESCE(p_from,(SELECT MIN(sale_date) FROM sales)) f, COALESCE(p_to,(SELECT MAX(sale_date) FROM sales)) t),
r AS (
  SELECT p.product_category cat, p.product_id, s.units, s.units*p.product_price amt, s.units*p.product_cost cst
  FROM sales s JOIN products p USING(product_id) CROSS JOIN b
  WHERE s.sale_date BETWEEN b.f AND b.t AND (p_store_id IS NULL OR s.store_id = p_store_id)),
g AS (
  SELECT cat, SUM(amt) rev, SUM(cst) cost, SUM(amt-cst) prof, SUM(units) u, COUNT(DISTINCT product_id) skus
  FROM r GROUP BY cat)
SELECT cat, ROUND(rev,2), ROUND(cost,2), ROUND(prof,2), ROUND(prof*100/NULLIF(rev,0),1), u::bigint,
       ROUND(prof*100/NULLIF((SELECT SUM(prof) FROM g),0),1), skus::bigint
FROM g ORDER BY prof DESC;
$$;

CREATE OR REPLACE FUNCTION public.analytics_store_category_profit(p_from date DEFAULT NULL, p_to date DEFAULT NULL)
RETURNS TABLE(store_id bigint, store_name text, store_city text, store_location text, category text,
              revenue numeric, profit numeric, units bigint, store_profit numeric, share_pct numeric)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
WITH b AS (SELECT COALESCE(p_from,(SELECT MIN(sale_date) FROM sales)) f, COALESCE(p_to,(SELECT MAX(sale_date) FROM sales)) t),
r AS (
  SELECT s.store_id sid, p.product_category cat, s.units, s.units*p.product_price amt, s.units*(p.product_price-p.product_cost) prof
  FROM sales s JOIN products p USING(product_id) CROSS JOIN b
  WHERE s.sale_date BETWEEN b.f AND b.t),
g AS (SELECT sid, cat, SUM(amt) rev, SUM(prof) prof, SUM(units) u FROM r GROUP BY sid, cat),
tot AS (SELECT sid, SUM(prof) sp FROM g GROUP BY sid)
SELECT g.sid, st.store_name, st.store_city, st.store_location, g.cat,
       ROUND(g.rev,2), ROUND(g.prof,2), g.u::bigint, ROUND(tot.sp,2), ROUND(g.prof*100/NULLIF(tot.sp,0),1)
FROM g JOIN tot USING(sid) JOIN stores st ON st.store_id = g.sid
ORDER BY tot.sp DESC, g.prof DESC;
$$;

CREATE OR REPLACE FUNCTION public.analytics_location_category_profit(p_from date DEFAULT NULL, p_to date DEFAULT NULL)
RETURNS TABLE(store_location text, category text, profit numeric, revenue numeric, share_pct numeric, store_count bigint)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
WITH b AS (SELECT COALESCE(p_from,(SELECT MIN(sale_date) FROM sales)) f, COALESCE(p_to,(SELECT MAX(sale_date) FROM sales)) t),
r AS (
  SELECT st.store_location loc, st.store_id sid, p.product_category cat,
         s.units*p.product_price amt, s.units*(p.product_price-p.product_cost) prof
  FROM sales s JOIN products p USING(product_id) JOIN stores st ON st.store_id = s.store_id CROSS JOIN b
  WHERE s.sale_date BETWEEN b.f AND b.t),
g AS (SELECT loc, cat, SUM(prof) prof, SUM(amt) rev, COUNT(DISTINCT sid) sc FROM r GROUP BY loc, cat),
tot AS (SELECT loc, SUM(prof) lp FROM g GROUP BY loc)
SELECT g.loc, g.cat, ROUND(g.prof,2), ROUND(g.rev,2), ROUND(g.prof*100/NULLIF(tot.lp,0),1), g.sc::bigint
FROM g JOIN tot USING(loc) ORDER BY tot.lp DESC, g.prof DESC;
$$;

CREATE OR REPLACE FUNCTION public.analytics_product_profit(p_from date DEFAULT NULL, p_to date DEFAULT NULL, p_store_id bigint DEFAULT NULL, p_limit int DEFAULT 12)
RETURNS TABLE(product_id bigint, product_name text, category text, revenue numeric, profit numeric, margin_pct numeric, units bigint)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
WITH b AS (SELECT COALESCE(p_from,(SELECT MIN(sale_date) FROM sales)) f, COALESCE(p_to,(SELECT MAX(sale_date) FROM sales)) t),
r AS (
  SELECT p.product_id pid, p.product_name pn, p.product_category cat, s.units,
         s.units*p.product_price amt, s.units*(p.product_price-p.product_cost) prof
  FROM sales s JOIN products p USING(product_id) CROSS JOIN b
  WHERE s.sale_date BETWEEN b.f AND b.t AND (p_store_id IS NULL OR s.store_id = p_store_id))
SELECT pid, pn, cat, ROUND(SUM(amt),2), ROUND(SUM(prof),2),
       ROUND(SUM(prof)*100/NULLIF(SUM(amt),0),1), SUM(units)::bigint
FROM r GROUP BY pid, pn, cat ORDER BY 5 DESC LIMIT LEAST(GREATEST(p_limit,1),100);
$$;

-- ============ AVAILABILITY / LOST SALES ============
CREATE OR REPLACE FUNCTION public.analytics_availability_summary(p_days int DEFAULT 28, p_store_id bigint DEFAULT NULL)
RETURNS TABLE(out_of_stock bigint, at_risk bigint, tracked_pairs bigint, availability_pct numeric,
              lost_units_week numeric, lost_revenue_week numeric, lost_profit_week numeric, affected_stores bigint)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
WITH b AS (SELECT (SELECT MAX(sale_date) FROM sales) t),
w AS (SELECT t, t - (GREATEST(p_days,1) - 1) f FROM b),
d AS (
  SELECT s.store_id sid, s.product_id pid, SUM(s.units)::numeric / GREATEST(p_days,1) daily
  FROM sales s CROSS JOIN w
  WHERE s.sale_date BETWEEN w.f AND w.t AND (p_store_id IS NULL OR s.store_id = p_store_id)
  GROUP BY 1,2),
j AS (
  SELECT d.sid, d.pid, d.daily, COALESCE(i.stock_on_hand,0) stock, p.product_price price, p.product_cost cost
  FROM d JOIN products p ON p.product_id = d.pid
  LEFT JOIN inventory i ON i.store_id = d.sid AND i.product_id = d.pid),
k AS (
  SELECT *, CASE WHEN daily > 0 THEN stock/daily END cover,
         GREATEST(daily*7 - stock, 0) lost_units
  FROM j)
SELECT COUNT(*) FILTER (WHERE stock = 0)::bigint,
       COUNT(*) FILTER (WHERE stock > 0 AND cover < 7)::bigint,
       COUNT(*)::bigint,
       ROUND(COUNT(*) FILTER (WHERE stock > 0)*100.0/NULLIF(COUNT(*),0),1),
       ROUND(COALESCE(SUM(lost_units),0),1),
       ROUND(COALESCE(SUM(lost_units*price),0),2),
       ROUND(COALESCE(SUM(lost_units*(price-cost)),0),2),
       COUNT(DISTINCT sid) FILTER (WHERE stock = 0)::bigint
FROM k;
$$;

CREATE OR REPLACE FUNCTION public.analytics_stockout_items(p_days int DEFAULT 28, p_store_id bigint DEFAULT NULL, p_limit int DEFAULT 20)
RETURNS TABLE(store_id bigint, product_id bigint, store_name text, store_city text, product_name text, category text,
              stock_on_hand integer, daily_units numeric, days_cover numeric, lost_units_week numeric, lost_revenue_week numeric)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
WITH b AS (SELECT (SELECT MAX(sale_date) FROM sales) t),
w AS (SELECT t, t - (GREATEST(p_days,1) - 1) f FROM b),
d AS (
  SELECT s.store_id sid, s.product_id pid, SUM(s.units)::numeric / GREATEST(p_days,1) daily
  FROM sales s CROSS JOIN w
  WHERE s.sale_date BETWEEN w.f AND w.t AND (p_store_id IS NULL OR s.store_id = p_store_id)
  GROUP BY 1,2),
j AS (
  SELECT d.sid, d.pid, d.daily, COALESCE(i.stock_on_hand,0) stock, p.product_name pn, p.product_category cat, p.product_price price
  FROM d JOIN products p ON p.product_id = d.pid
  LEFT JOIN inventory i ON i.store_id = d.sid AND i.product_id = d.pid)
SELECT j.sid, j.pid, st.store_name, st.store_city, j.pn, j.cat, j.stock::integer,
       ROUND(j.daily,2), ROUND(j.stock/NULLIF(j.daily,0),1),
       ROUND(GREATEST(j.daily*7 - j.stock,0),1),
       ROUND(GREATEST(j.daily*7 - j.stock,0)*j.price,2)
FROM j JOIN stores st ON st.store_id = j.sid
WHERE GREATEST(j.daily*7 - j.stock,0) > 0
ORDER BY 11 DESC LIMIT LEAST(GREATEST(p_limit,1),200);
$$;

CREATE OR REPLACE FUNCTION public.analytics_store_availability(p_days int DEFAULT 28, p_limit int DEFAULT 50)
RETURNS TABLE(store_id bigint, store_name text, store_city text, store_location text,
              tracked_pairs bigint, out_of_stock bigint, availability_pct numeric,
              lost_revenue_week numeric, revenue_week numeric, loss_ratio_pct numeric)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
WITH b AS (SELECT (SELECT MAX(sale_date) FROM sales) t),
w AS (SELECT t, t - (GREATEST(p_days,1) - 1) f FROM b),
d AS (
  SELECT s.store_id sid, s.product_id pid, SUM(s.units)::numeric / GREATEST(p_days,1) daily,
         SUM(s.units)::numeric * 7 / GREATEST(p_days,1) wk_units
  FROM sales s CROSS JOIN w WHERE s.sale_date BETWEEN w.f AND w.t GROUP BY 1,2),
j AS (
  SELECT d.sid, d.daily, d.wk_units, COALESCE(i.stock_on_hand,0) stock, p.product_price price
  FROM d JOIN products p ON p.product_id = d.pid
  LEFT JOIN inventory i ON i.store_id = d.sid AND i.product_id = d.pid),
g AS (
  SELECT sid, COUNT(*) pairs, COUNT(*) FILTER (WHERE stock = 0) oos,
         SUM(GREATEST(daily*7 - stock,0)*price) lost, SUM(wk_units*price) rev
  FROM j GROUP BY sid)
SELECT g.sid, st.store_name, st.store_city, st.store_location, g.pairs::bigint, g.oos::bigint,
       ROUND((g.pairs - g.oos)*100.0/NULLIF(g.pairs,0),1),
       ROUND(COALESCE(g.lost,0),2), ROUND(COALESCE(g.rev,0),2),
       ROUND(COALESCE(g.lost,0)*100/NULLIF(g.rev,0),1)
FROM g JOIN stores st ON st.store_id = g.sid
ORDER BY 8 DESC LIMIT LEAST(GREATEST(p_limit,1),200);
$$;

CREATE OR REPLACE FUNCTION public.analytics_assortment_gaps(p_days int DEFAULT 28, p_limit int DEFAULT 20)
RETURNS TABLE(store_id bigint, store_name text, store_city text, product_id bigint, product_name text,
              category text, chain_daily_units numeric, est_revenue_week numeric, stores_selling bigint)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
WITH b AS (SELECT (SELECT MAX(sale_date) FROM sales) t),
w AS (SELECT t, t - (GREATEST(p_days,1) - 1) f FROM b),
chain AS (
  SELECT s.product_id pid, COUNT(DISTINCT s.store_id) stores_selling,
         SUM(s.units)::numeric / GREATEST(p_days,1) / NULLIF(COUNT(DISTINCT s.store_id),0) daily_per_store
  FROM sales s CROSS JOIN w WHERE s.sale_date BETWEEN w.f AND w.t GROUP BY 1),
pairs AS (SELECT st.store_id sid, c.pid, c.daily_per_store, c.stores_selling FROM stores st CROSS JOIN chain c),
gaps AS (
  SELECT pr.* FROM pairs pr
  WHERE NOT EXISTS (SELECT 1 FROM inventory i WHERE i.store_id = pr.sid AND i.product_id = pr.pid AND i.stock_on_hand > 0)
    AND NOT EXISTS (SELECT 1 FROM sales s CROSS JOIN w WHERE s.store_id = pr.sid AND s.product_id = pr.pid AND s.sale_date BETWEEN w.f AND w.t))
SELECT g.sid, st.store_name, st.store_city, g.pid, p.product_name, p.product_category,
       ROUND(g.daily_per_store,2), ROUND(g.daily_per_store*7*p.product_price,2), g.stores_selling::bigint
FROM gaps g JOIN stores st ON st.store_id = g.sid JOIN products p ON p.product_id = g.pid
WHERE g.daily_per_store > 0 AND g.stores_selling >= 5
ORDER BY 8 DESC LIMIT LEAST(GREATEST(p_limit,1),200);
$$;

CREATE OR REPLACE FUNCTION public.analytics_lost_by_category(p_days int DEFAULT 28)
RETURNS TABLE(category text, out_of_stock bigint, lost_units_week numeric, lost_revenue_week numeric, revenue_week numeric, loss_ratio_pct numeric)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
WITH b AS (SELECT (SELECT MAX(sale_date) FROM sales) t),
w AS (SELECT t, t - (GREATEST(p_days,1) - 1) f FROM b),
d AS (
  SELECT s.store_id sid, s.product_id pid, SUM(s.units)::numeric / GREATEST(p_days,1) daily
  FROM sales s CROSS JOIN w WHERE s.sale_date BETWEEN w.f AND w.t GROUP BY 1,2),
j AS (
  SELECT p.product_category cat, d.daily, COALESCE(i.stock_on_hand,0) stock, p.product_price price
  FROM d JOIN products p ON p.product_id = d.pid
  LEFT JOIN inventory i ON i.store_id = d.sid AND i.product_id = d.pid)
SELECT cat, COUNT(*) FILTER (WHERE stock = 0)::bigint,
       ROUND(SUM(GREATEST(daily*7 - stock,0)),1),
       ROUND(SUM(GREATEST(daily*7 - stock,0)*price),2),
       ROUND(SUM(daily*7*price),2),
       ROUND(SUM(GREATEST(daily*7 - stock,0)*price)*100/NULLIF(SUM(daily*7*price),0),1)
FROM j GROUP BY cat ORDER BY 4 DESC;
$$;

-- ============ INVENTORY CAPITAL / COVERAGE ============
CREATE OR REPLACE FUNCTION public.analytics_inventory_summary(p_days int DEFAULT 28, p_store_id bigint DEFAULT NULL)
RETURNS TABLE(units bigint, sku_rows bigint, cost_value numeric, retail_value numeric, locked_profit numeric,
              daily_cost_burn numeric, days_cover numeric, dead_cost_value numeric, dead_rows bigint)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
WITH b AS (SELECT (SELECT MAX(sale_date) FROM sales) t),
w AS (SELECT t, t - (GREATEST(p_days,1) - 1) f FROM b),
d AS (
  SELECT s.store_id sid, s.product_id pid, SUM(s.units)::numeric / GREATEST(p_days,1) daily
  FROM sales s CROSS JOIN w WHERE s.sale_date BETWEEN w.f AND w.t GROUP BY 1,2),
j AS (
  SELECT i.store_id sid, i.stock_on_hand stock, p.product_cost cost, p.product_price price, COALESCE(d.daily,0) daily
  FROM inventory i JOIN products p ON p.product_id = i.product_id
  LEFT JOIN d ON d.sid = i.store_id AND d.pid = i.product_id
  WHERE p_store_id IS NULL OR i.store_id = p_store_id)
SELECT COALESCE(SUM(stock),0)::bigint, COUNT(*)::bigint,
       ROUND(COALESCE(SUM(stock*cost),0),2), ROUND(COALESCE(SUM(stock*price),0),2),
       ROUND(COALESCE(SUM(stock*(price-cost)),0),2),
       ROUND(COALESCE(SUM(daily*cost),0),2),
       ROUND(COALESCE(SUM(stock*cost),0)/NULLIF(SUM(daily*cost),0),1),
       ROUND(COALESCE(SUM(stock*cost) FILTER (WHERE daily = 0 AND stock > 0),0),2),
       COUNT(*) FILTER (WHERE daily = 0 AND stock > 0)::bigint
FROM j;
$$;

CREATE OR REPLACE FUNCTION public.analytics_inventory_by_category(p_days int DEFAULT 28, p_store_id bigint DEFAULT NULL)
RETURNS TABLE(category text, units bigint, cost_value numeric, retail_value numeric, daily_cost_burn numeric, days_cover numeric, share_pct numeric)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
WITH b AS (SELECT (SELECT MAX(sale_date) FROM sales) t),
w AS (SELECT t, t - (GREATEST(p_days,1) - 1) f FROM b),
d AS (
  SELECT s.store_id sid, s.product_id pid, SUM(s.units)::numeric / GREATEST(p_days,1) daily
  FROM sales s CROSS JOIN w WHERE s.sale_date BETWEEN w.f AND w.t GROUP BY 1,2),
j AS (
  SELECT p.product_category cat, i.stock_on_hand stock, p.product_cost cost, p.product_price price, COALESCE(d.daily,0) daily
  FROM inventory i JOIN products p ON p.product_id = i.product_id
  LEFT JOIN d ON d.sid = i.store_id AND d.pid = i.product_id
  WHERE p_store_id IS NULL OR i.store_id = p_store_id),
g AS (SELECT cat, SUM(stock) u, SUM(stock*cost) cv, SUM(stock*price) rv, SUM(daily*cost) burn FROM j GROUP BY cat)
SELECT cat, u::bigint, ROUND(cv,2), ROUND(rv,2), ROUND(burn,2), ROUND(cv/NULLIF(burn,0),1),
       ROUND(cv*100/NULLIF((SELECT SUM(cv) FROM g),0),1)
FROM g ORDER BY cv DESC;
$$;

CREATE OR REPLACE FUNCTION public.analytics_inventory_by_store(p_days int DEFAULT 28, p_limit int DEFAULT 50)
RETURNS TABLE(store_id bigint, store_name text, store_city text, store_location text,
              units bigint, cost_value numeric, daily_cost_burn numeric, days_cover numeric, dead_cost_value numeric)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
WITH b AS (SELECT (SELECT MAX(sale_date) FROM sales) t),
w AS (SELECT t, t - (GREATEST(p_days,1) - 1) f FROM b),
d AS (
  SELECT s.store_id sid, s.product_id pid, SUM(s.units)::numeric / GREATEST(p_days,1) daily
  FROM sales s CROSS JOIN w WHERE s.sale_date BETWEEN w.f AND w.t GROUP BY 1,2),
j AS (
  SELECT i.store_id sid, i.stock_on_hand stock, p.product_cost cost, COALESCE(d.daily,0) daily
  FROM inventory i JOIN products p ON p.product_id = i.product_id
  LEFT JOIN d ON d.sid = i.store_id AND d.pid = i.product_id),
g AS (SELECT sid, SUM(stock) u, SUM(stock*cost) cv, SUM(daily*cost) burn,
             SUM(stock*cost) FILTER (WHERE daily = 0 AND stock > 0) dead
      FROM j GROUP BY sid)
SELECT g.sid, st.store_name, st.store_city, st.store_location, g.u::bigint,
       ROUND(g.cv,2), ROUND(g.burn,2), ROUND(g.cv/NULLIF(g.burn,0),1), ROUND(COALESCE(g.dead,0),2)
FROM g JOIN stores st ON st.store_id = g.sid
ORDER BY g.cv DESC LIMIT LEAST(GREATEST(p_limit,1),200);
$$;

CREATE OR REPLACE FUNCTION public.analytics_cover_buckets(p_days int DEFAULT 28, p_store_id bigint DEFAULT NULL)
RETURNS TABLE(bucket text, sort_order int, sku_rows bigint, units bigint, cost_value numeric, share_pct numeric)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
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
      WHEN stock = 0 THEN 'Нет в наличии'
      WHEN daily = 0 THEN 'Нет продаж (мёртвый запас)'
      WHEN stock/daily < 7 THEN 'Меньше 7 дней'
      WHEN stock/daily < 30 THEN '7–30 дней'
      WHEN stock/daily < 90 THEN '30–90 дней'
      ELSE 'Более 90 дней'
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
$$;

CREATE OR REPLACE FUNCTION public.analytics_slow_movers(p_days int DEFAULT 28, p_store_id bigint DEFAULT NULL, p_limit int DEFAULT 20)
RETURNS TABLE(store_id bigint, product_id bigint, store_name text, store_city text, product_name text, category text,
              stock_on_hand integer, cost_value numeric, daily_units numeric, days_cover numeric)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
WITH b AS (SELECT (SELECT MAX(sale_date) FROM sales) t),
w AS (SELECT t, t - (GREATEST(p_days,1) - 1) f FROM b),
d AS (
  SELECT s.store_id sid, s.product_id pid, SUM(s.units)::numeric / GREATEST(p_days,1) daily
  FROM sales s CROSS JOIN w WHERE s.sale_date BETWEEN w.f AND w.t GROUP BY 1,2),
j AS (
  SELECT i.store_id sid, i.product_id pid, i.stock_on_hand stock, p.product_name pn, p.product_category cat,
         p.product_cost cost, COALESCE(d.daily,0) daily
  FROM inventory i JOIN products p ON p.product_id = i.product_id
  LEFT JOIN d ON d.sid = i.store_id AND d.pid = i.product_id
  WHERE (p_store_id IS NULL OR i.store_id = p_store_id) AND i.stock_on_hand > 0)
SELECT j.sid, j.pid, st.store_name, st.store_city, j.pn, j.cat, j.stock::integer,
       ROUND(j.stock*j.cost,2), ROUND(j.daily,2),
       CASE WHEN j.daily > 0 THEN ROUND(j.stock/j.daily,1) END
FROM j JOIN stores st ON st.store_id = j.sid
WHERE j.daily = 0 OR j.stock/j.daily > 90
ORDER BY 8 DESC LIMIT LEAST(GREATEST(p_limit,1),200);
$$;

GRANT EXECUTE ON FUNCTION
  public.analytics_profit_summary(date,date,bigint),
  public.analytics_category_profit(date,date,bigint),
  public.analytics_store_category_profit(date,date),
  public.analytics_location_category_profit(date,date),
  public.analytics_product_profit(date,date,bigint,int),
  public.analytics_availability_summary(int,bigint),
  public.analytics_stockout_items(int,bigint,int),
  public.analytics_store_availability(int,int),
  public.analytics_assortment_gaps(int,int),
  public.analytics_lost_by_category(int),
  public.analytics_inventory_summary(int,bigint),
  public.analytics_inventory_by_category(int,bigint),
  public.analytics_inventory_by_store(int,int),
  public.analytics_cover_buckets(int,bigint),
  public.analytics_slow_movers(int,bigint,int)
TO anon, authenticated, service_role;
