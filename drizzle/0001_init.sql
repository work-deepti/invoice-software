CREATE TYPE "public"."audit_action" AS ENUM('create', 'update', 'delete', 'cancel', 'restore', 'settings', 'rates', 'users');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('active', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."making_type" AS ENUM('per_g', 'pct', 'flat');--> statement-breakpoint
CREATE TYPE "public"."metal" AS ENUM('Gold', 'Silver', 'Platinum', 'Other');--> statement-breakpoint
CREATE TYPE "public"."pay_mode" AS ENUM('Cash', 'UPI', 'Card', 'Bank transfer', 'Cheque', 'Mixed', 'Credit');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'staff', 'viewer');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid,
	"entity" text NOT NULL,
	"entity_id" text,
	"action" "audit_action" NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text,
	"name" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"gstin" text DEFAULT '' NOT NULL,
	"pan" text DEFAULT '' NOT NULL,
	"state" text DEFAULT '' NOT NULL,
	"first_invoice_at" date,
	"last_invoice_at" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "customers_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "daily_summary" (
	"date" date NOT NULL,
	"metal" text NOT NULL,
	"purity_key" text NOT NULL,
	"gst_on" boolean NOT NULL,
	"pay_mode" text NOT NULL,
	"invoices" integer DEFAULT 0 NOT NULL,
	"sales" numeric(14, 2) DEFAULT '0' NOT NULL,
	"taxable" numeric(14, 2) DEFAULT '0' NOT NULL,
	"cgst" numeric(14, 2) DEFAULT '0' NOT NULL,
	"sgst" numeric(14, 2) DEFAULT '0' NOT NULL,
	"igst" numeric(14, 2) DEFAULT '0' NOT NULL,
	"net_g" numeric(12, 3) DEFAULT '0' NOT NULL,
	"metal_value" numeric(14, 2) DEFAULT '0' NOT NULL,
	"making" numeric(14, 2) DEFAULT '0' NOT NULL,
	"stone" numeric(14, 2) DEFAULT '0' NOT NULL,
	"discount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"exchange_value" numeric(14, 2) DEFAULT '0' NOT NULL,
	"exchange_g" numeric(12, 3) DEFAULT '0' NOT NULL,
	"exchange_fine_g" numeric(12, 3) DEFAULT '0' NOT NULL,
	"paid" numeric(14, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "daily_summary_date_metal_purity_key_gst_on_pay_mode_pk" PRIMARY KEY("date","metal","purity_key","gst_on","pay_mode")
);
--> statement-breakpoint
CREATE TABLE "invoice_exchange" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"row_no" integer NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"metal" "metal" NOT NULL,
	"weight_g" numeric(12, 3) NOT NULL,
	"touch_pct" numeric(6, 2) NOT NULL,
	"fine_g" numeric(12, 3) NOT NULL,
	"fine_rate" numeric(14, 2) NOT NULL,
	"value" numeric(14, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"line_no" integer NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"purity_id" uuid,
	"metal" "metal" NOT NULL,
	"purity_label" text DEFAULT '' NOT NULL,
	"hsn" text DEFAULT '' NOT NULL,
	"pcs" integer DEFAULT 0 NOT NULL,
	"gross_g" numeric(12, 3) NOT NULL,
	"less_g" numeric(12, 3) NOT NULL,
	"net_g" numeric(12, 3) NOT NULL,
	"wastage_pct" numeric(6, 2) NOT NULL,
	"chargeable_g" numeric(12, 3) NOT NULL,
	"rate_per_g" numeric(14, 2) NOT NULL,
	"rate_manual" boolean DEFAULT false NOT NULL,
	"making_type" "making_type" NOT NULL,
	"making_input" numeric(14, 2) NOT NULL,
	"making_amt" numeric(14, 2) NOT NULL,
	"stone_amt" numeric(14, 2) NOT NULL,
	"metal_value" numeric(14, 2) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "invoice_series" (
	"series_key" text PRIMARY KEY NOT NULL,
	"prefix" text NOT NULL,
	"fy" text,
	"last_seq" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"series_key" text NOT NULL,
	"seq" integer NOT NULL,
	"fy" text,
	"invoice_date" date NOT NULL,
	"gst_on" boolean NOT NULL,
	"inter_state" boolean NOT NULL,
	"gst_rate" numeric(6, 2) NOT NULL,
	"customer_id" uuid,
	"customer_name" text DEFAULT '' NOT NULL,
	"customer_phone" text DEFAULT '' NOT NULL,
	"customer_address" text DEFAULT '' NOT NULL,
	"customer_gstin" text DEFAULT '' NOT NULL,
	"customer_pan" text DEFAULT '' NOT NULL,
	"customer_state" text DEFAULT '' NOT NULL,
	"pan_declaration" boolean DEFAULT false NOT NULL,
	"place_of_supply" text DEFAULT '' NOT NULL,
	"place_code" text,
	"pay_mode" "pay_mode" NOT NULL,
	"discount_input" numeric(14, 2) DEFAULT '0' NOT NULL,
	"discount" numeric(14, 2) NOT NULL,
	"items_total" numeric(14, 2) NOT NULL,
	"taxable" numeric(14, 2) NOT NULL,
	"cgst" numeric(14, 2) NOT NULL,
	"sgst" numeric(14, 2) NOT NULL,
	"igst" numeric(14, 2) NOT NULL,
	"exchange_total" numeric(14, 2) NOT NULL,
	"round_off" numeric(14, 2) NOT NULL,
	"grand_total" numeric(14, 2) NOT NULL,
	"received_full" boolean NOT NULL,
	"received" numeric(14, 2) NOT NULL,
	"paid" numeric(14, 2) NOT NULL,
	"change_returned" numeric(14, 2) NOT NULL,
	"balance" numeric(14, 2) NOT NULL,
	"gold_net_g" numeric(12, 3) NOT NULL,
	"silver_net_g" numeric(12, 3) NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"shop_snapshot" jsonb NOT NULL,
	"status" "invoice_status" DEFAULT 'active' NOT NULL,
	"cancelled_reason" text,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" uuid,
	"search_text" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "purities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"metal" "metal" NOT NULL,
	"label" text NOT NULL,
	"purity_pct" numeric(6, 2) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "rate_history" (
	"date" date NOT NULL,
	"purity_id" uuid NOT NULL,
	"label" text NOT NULL,
	"metal" "metal" NOT NULL,
	"purity_pct" numeric(6, 2) NOT NULL,
	"rate_per_g" numeric(14, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "rate_history_date_purity_id_pk" PRIMARY KEY("date","purity_id")
);
--> statement-breakpoint
CREATE TABLE "rates_current" (
	"purity_id" uuid PRIMARY KEY NOT NULL,
	"rate_per_g" numeric(14, 2),
	"effective_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "shop_settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"gstin" text DEFAULT '' NOT NULL,
	"state" text DEFAULT '' NOT NULL,
	"state_code" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"gst_rate" numeric(6, 2) DEFAULT '3' NOT NULL,
	"gst_default" boolean DEFAULT true NOT NULL,
	"prefix_gst" text DEFAULT 'INV' NOT NULL,
	"prefix_nogst" text DEFAULT 'BILL' NOT NULL,
	"nogst_title" text DEFAULT 'INVOICE' NOT NULL,
	"hsn_gold" text DEFAULT '7113' NOT NULL,
	"hsn_silver" text DEFAULT '7113' NOT NULL,
	"fy_numbering" boolean DEFAULT true NOT NULL,
	"terms" text DEFAULT 'Goods once sold will not be taken back.
Subject to local jurisdiction.' NOT NULL,
	"bank_details" text DEFAULT '' NOT NULL,
	"signatory_label" text DEFAULT 'Authorised Signatory' NOT NULL,
	"staff_can_see_dashboard" boolean DEFAULT false NOT NULL,
	"cash_limit" numeric(14, 2) DEFAULT '200000' NOT NULL,
	"pan_limit" numeric(14, 2) DEFAULT '200000' NOT NULL,
	"cash_payout_limit" numeric(14, 2) DEFAULT '10000' NOT NULL,
	"pan_missing_policy" text DEFAULT 'block' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "shop_settings_singleton" CHECK ("shop_settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"login" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"session_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "users_login_unique" UNIQUE("login")
);
--> statement-breakpoint
ALTER TABLE "invoice_exchange" ADD CONSTRAINT "invoice_exchange_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_purity_id_purities_id_fk" FOREIGN KEY ("purity_id") REFERENCES "public"."purities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rates_current" ADD CONSTRAINT "rates_current_purity_id_purities_id_fk" FOREIGN KEY ("purity_id") REFERENCES "public"."purities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_at_idx" ON "audit_log" USING btree ("at");--> statement-breakpoint
CREATE INDEX "invoice_exchange_invoice_idx" ON "invoice_exchange" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_lines_invoice_idx" ON "invoice_lines" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_lines_purity_idx" ON "invoice_lines" USING btree ("purity_label");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_number_uq" ON "invoices" USING btree ("number");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_series_seq_uq" ON "invoices" USING btree ("series_key","seq");--> statement-breakpoint
CREATE INDEX "invoices_date_idx" ON "invoices" USING btree ("invoice_date","created_at");--> statement-breakpoint
CREATE INDEX "invoices_phone_idx" ON "invoices" USING btree ("customer_phone");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invoices_search_trgm_idx" ON "invoices" USING gin ("search_text" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "purities_label_active_uq" ON "purities" USING btree (lower("label")) WHERE "purities"."active";