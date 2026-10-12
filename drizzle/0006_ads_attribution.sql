ALTER TABLE "orders" ADD COLUMN "attribution" jsonb;--> statement-breakpoint
-- One photo for every olive-oil offer (the same golden pour on all cards).
UPDATE "product_images" SET "url" = 'static:oil-pour', "alt_ar" = 'زيت زيتون ذهبي يُسكب في وعاء', "alt_fr" = 'Huile d’olive dorée versée dans un bol'
WHERE "product_id" IN (SELECT "id" FROM "products" WHERE "liters" IS NOT NULL) AND "url" LIKE 'static:%';
