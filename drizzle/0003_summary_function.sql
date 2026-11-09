-- daily_summary rebuild as one database function, shared by every save / edit /
-- cancel / delete / restore. Invoice-level rows now carry the bill's metal mix in
-- purity_key ('mix:gold' | 'mix:silver' | 'mix:mixed' | 'mix:none') so dashboards
-- can filter by metal from the pre-aggregated table (DSH-08).
CREATE OR REPLACE FUNCTION gsb_rebuild_daily_summary(d date) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('gsb:summary:' || d::text));
  DELETE FROM daily_summary WHERE date = d;
  INSERT INTO daily_summary (date, metal, purity_key, gst_on, pay_mode, invoices, sales, taxable, cgst, sgst, igst,
                             net_g, metal_value, making, stone, discount, exchange_value, exchange_g, exchange_fine_g, paid)
  SELECT d, metal, purity_key, gst_on, pay_mode,
         sum(invoices), sum(sales), sum(taxable), sum(cgst), sum(sgst), sum(igst),
         sum(net_g), sum(metal_value), sum(making), sum(stone), sum(discount),
         sum(exchange_value), sum(exchange_g), sum(exchange_fine_g), sum(paid)
  FROM (
    SELECT 'ALL'::text AS metal,
           CASE WHEN i.gold_net_g > 0 AND i.silver_net_g > 0 THEN 'mix:mixed'
                WHEN i.gold_net_g > 0 THEN 'mix:gold'
                WHEN i.silver_net_g > 0 THEN 'mix:silver'
                ELSE 'mix:none' END AS purity_key,
           i.gst_on, i.pay_mode::text AS pay_mode,
           1 AS invoices, i.grand_total AS sales, i.taxable, i.cgst, i.sgst, i.igst,
           0::numeric AS net_g,
           coalesce((SELECT sum(l.metal_value) FROM invoice_lines l WHERE l.invoice_id = i.id), 0) AS metal_value,
           coalesce((SELECT sum(l.making_amt)  FROM invoice_lines l WHERE l.invoice_id = i.id), 0) AS making,
           coalesce((SELECT sum(l.stone_amt)   FROM invoice_lines l WHERE l.invoice_id = i.id), 0) AS stone,
           i.discount, i.exchange_total AS exchange_value,
           coalesce((SELECT sum(x.weight_g) FROM invoice_exchange x WHERE x.invoice_id = i.id), 0) AS exchange_g,
           coalesce((SELECT sum(x.fine_g)   FROM invoice_exchange x WHERE x.invoice_id = i.id), 0) AS exchange_fine_g,
           i.paid
    FROM invoices i
    WHERE i.invoice_date = d AND i.status = 'active'
    UNION ALL
    SELECT l.metal::text, l.purity_label, i.gst_on, i.pay_mode::text,
           count(DISTINCT i.id), sum(l.amount), 0, 0, 0, 0,
           sum(l.net_g), sum(l.metal_value), sum(l.making_amt), sum(l.stone_amt), 0, 0, 0, 0, 0
    FROM invoices i JOIN invoice_lines l ON l.invoice_id = i.id
    WHERE i.invoice_date = d AND i.status = 'active'
    GROUP BY l.metal, l.purity_label, i.gst_on, i.pay_mode
    UNION ALL
    SELECT x.metal::text, '~exchange', i.gst_on, i.pay_mode::text,
           count(DISTINCT i.id), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
           sum(x.value), sum(x.weight_g), sum(x.fine_g), 0
    FROM invoices i JOIN invoice_exchange x ON x.invoice_id = i.id
    WHERE i.invoice_date = d AND i.status = 'active'
    GROUP BY x.metal, i.gst_on, i.pay_mode
  ) s
  GROUP BY metal, purity_key, gst_on, pay_mode;
END;
$$;
--> statement-breakpoint
-- Rebuild every existing day with the new invoice-level grain.
DELETE FROM daily_summary;
--> statement-breakpoint
SELECT gsb_rebuild_daily_summary(d) FROM (SELECT DISTINCT invoice_date AS d FROM invoices) t;
