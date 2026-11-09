-- pg_trgm powers the substring search index on invoices.search_text (TXN-01 / DATA-03).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
