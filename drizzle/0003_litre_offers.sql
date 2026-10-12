ALTER TABLE "products" ADD COLUMN "liters" numeric(7, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "auto_price" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;