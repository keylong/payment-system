CREATE TABLE "demo_orders" (
	"order_id" text PRIMARY KEY NOT NULL,
	"product_name" text NOT NULL,
	"amount" real NOT NULL,
	"payment_method" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payment_id" text,
	"merchant_id" text DEFAULT 'default',
	"customer_info" jsonb,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text,
	"callback_url" text,
	"api_key" text,
	"name" text DEFAULT '默认商户',
	"description" text,
	"webhook_secret" text,
	"allowed_ips" text,
	"callback_retry_times" integer DEFAULT 3,
	"callback_timeout" integer DEFAULT 30,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "merchants_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"amount" real NOT NULL,
	"uid" text NOT NULL,
	"payment_method" text NOT NULL,
	"status" text DEFAULT 'success' NOT NULL,
	"source" text DEFAULT 'webhook' NOT NULL,
	"customer_type" text,
	"raw_message" text,
	"match_confidence" real,
	"callback_status" text DEFAULT 'pending',
	"callback_url" text,
	"merchant_id" text DEFAULT 'default',
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pending_orders" (
	"order_id" text PRIMARY KEY NOT NULL,
	"amount" real NOT NULL,
	"payment_method" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"custom_amount" real,
	"merchant_id" text DEFAULT 'default',
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qr_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"image_url" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text,
	"description" text,
	"type" text DEFAULT 'string',
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unmatched_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"amount" real NOT NULL,
	"uid" text NOT NULL,
	"payment_method" text NOT NULL,
	"customer_type" text,
	"raw_message" text,
	"source" text DEFAULT 'webhook' NOT NULL,
	"is_processed" boolean DEFAULT false,
	"processed_order_id" text,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "demo_orders_status_idx" ON "demo_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "demo_orders_merchant_id_idx" ON "demo_orders" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "demo_orders_payment_id_idx" ON "demo_orders" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "demo_orders_expires_at_idx" ON "demo_orders" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "merchants_is_active_idx" ON "merchants" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "payments_callback_status_idx" ON "payments" USING btree ("callback_status");--> statement-breakpoint
CREATE INDEX "payments_merchant_id_idx" ON "payments" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "payments_timestamp_idx" ON "payments" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "payments_status_callback_idx" ON "payments" USING btree ("status","callback_status");--> statement-breakpoint
CREATE INDEX "pending_orders_status_idx" ON "pending_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pending_orders_expires_at_idx" ON "pending_orders" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "pending_orders_amount_method_idx" ON "pending_orders" USING btree ("amount","payment_method");--> statement-breakpoint
CREATE INDEX "qr_codes_type_active_idx" ON "qr_codes" USING btree ("type","is_active");--> statement-breakpoint
CREATE INDEX "unmatched_payments_is_processed_idx" ON "unmatched_payments" USING btree ("is_processed");--> statement-breakpoint
CREATE INDEX "unmatched_payments_amount_method_idx" ON "unmatched_payments" USING btree ("amount","payment_method");