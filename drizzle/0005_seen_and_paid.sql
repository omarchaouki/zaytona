ALTER TABLE "orders" ADD COLUMN "seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "paid_by" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_paid_by_admins_id_fk" FOREIGN KEY ("paid_by") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_unseen_idx" ON "orders" USING btree ("seen_at","created_at");--> statement-breakpoint
CREATE INDEX "orders_paid_idx" ON "orders" USING btree ("paid_at");--> statement-breakpoint
-- Orders that existed before notifications count as already seen.
UPDATE "orders" SET "seen_at" = "created_at" WHERE "seen_at" IS NULL;
