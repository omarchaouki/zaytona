-- The business is now "معصرة الهداجي لزيت الزيتون" (Huilerie El Hadaji), an olive press.
-- Only values still at the old defaults are changed: anything set in the admin is kept.
UPDATE "settings" SET "value" = "value" || jsonb_build_object('nameAr', 'معصرة الهداجي لزيت الزيتون')
WHERE "key" = 'identity' AND "value"->>'nameAr' = 'تعاونية الزيتون';--> statement-breakpoint
UPDATE "settings" SET "value" = "value" || jsonb_build_object('nameFr', 'Huilerie El Hadaji')
WHERE "key" = 'identity' AND "value"->>'nameFr' = 'Coopérative oléicole';--> statement-breakpoint
UPDATE "settings" SET "value" = "value" || jsonb_build_object('addressAr', 'الوناسدة، قلعة السراغنة 43000، المغرب')
WHERE "key" = 'contact' AND coalesce("value"->>'addressAr', '') = '';--> statement-breakpoint
UPDATE "settings" SET "value" = "value" || jsonb_build_object('addressFr', 'Louanasda, El Kelaâ des Sraghna 43000, Maroc')
WHERE "key" = 'contact' AND coalesce("value"->>'addressFr', '') = '';--> statement-breakpoint
-- WhatsApp message from the admin order page.
UPDATE "settings" SET "value" = jsonb_set("value", '{customerAr}', to_jsonb(replace("value"->>'customerAr', 'من التعاونية', 'من المعصرة')))
WHERE "key" = 'templates' AND "value"->>'customerAr' LIKE '%من التعاونية%';--> statement-breakpoint
-- Privacy page drafts.
UPDATE "content_blocks" SET "value_ar" = replace(replace("value_ar"::text, 'تجمع التعاونية', 'تجمع المعصرة'), 'فريق التعاونية', 'فريق المعصرة')::jsonb
WHERE "value_ar"::text LIKE '%التعاونية%';--> statement-breakpoint
UPDATE "content_blocks" SET "value_fr" = replace(replace("value_fr"::text, 'comment la coopérative collecte', 'comment l’huilerie collecte'), 'L’équipe de la coopérative', 'L’équipe de l’huilerie')::jsonb
WHERE "value_fr"::text LIKE '%coopérative%';
