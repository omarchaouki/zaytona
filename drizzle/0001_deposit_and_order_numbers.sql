CREATE TYPE "public"."deposit_status" AS ENUM('not_required', 'pending', 'received', 'waived');--> statement-breakpoint
ALTER SEQUENCE "public"."order_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 10001 CACHE 1;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "deposit_amount" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "deposit_percent" smallint;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "deposit_status" "deposit_status" DEFAULT 'not_required' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "deposit_received_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "deposit_received_by" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "deposit_note" text;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_deposit_received_by_admins_id_fk" FOREIGN KEY ("deposit_received_by") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_deposit_idx" ON "orders" USING btree ("deposit_status","created_at");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_deposit_nonnegative" CHECK ("orders"."deposit_amount" is null or "orders"."deposit_amount" >= 0);--> statement-breakpoint
-- Existing databases: START WITH does not move the current value, so jump
-- to 10001 (or past the highest number already used, if that is larger).
SELECT setval('order_number_seq', GREATEST(10000, (SELECT COALESCE(MAX("number"), 0) FROM "orders")), true);
