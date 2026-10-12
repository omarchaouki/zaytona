ALTER TABLE "orders" DROP CONSTRAINT "orders_deposit_nonnegative";--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_deposit_received_by_admins_id_fk";
--> statement-breakpoint
DROP INDEX "orders_deposit_idx";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "deposit_amount";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "deposit_percent";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "deposit_status";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "deposit_received_at";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "deposit_received_by";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "deposit_note";--> statement-breakpoint
DROP TYPE "public"."deposit_status";--> statement-breakpoint
-- Bank details were only used for the deposit.
DELETE FROM "settings" WHERE "key" = 'payment';--> statement-breakpoint
-- The confirmation messages mentioned the deposit; drop them so the new defaults apply.
UPDATE "settings" SET "value" = "value" - 'orderAr' - 'orderFr' WHERE "key" = 'templates';

--> statement-breakpoint
-- Cash on delivery only: untouched demo FAQ answer and draft terms lose the deposit text.
UPDATE "faqs" SET "answer_ar" = 'تدفع ثمن طلبك نقداً لعامل التوصيل عند استلامه. لا نطلب منك أي دفع مسبق ولا أي معلومات بنكية.', "answer_fr" = 'Vous payez en espèces au livreur, à la réception de la commande. Aucun paiement à l’avance ni aucune donnée bancaire ne vous est demandé.' WHERE "is_demo" = true AND "answer_ar" = 'لتأكيد طلبك، تحوّل عربوناً قدره 10% من المبلغ إلى حساب التعاونية (تجد رقم الحساب بعد إرسال الطلب)، وترسل صورة الوصل على واتساب. والباقي تدفعه نقداً لعامل التوصيل عند الاستلام. لا نطلب منك أي معلومات بنكية على الموقع.';--> statement-breakpoint
UPDATE "content_blocks" SET "value_ar" = jsonb_set("value_ar", '{html}', to_jsonb(replace(replace("value_ar"->>'html', '<p>ترسل طلبك عبر الاستمارة أو واتساب أو الهاتف. لا يصبح الطلب نهائياً إلا بعد توصلنا بالعربون وتأكيده معك.</p>', '<p>ترسل طلبك عبر الاستمارة أو واتساب أو الهاتف، ثم نتصل بك لتأكيده قبل الإرسال.</p>'), '<p>يُطلب عربون قدره 10% من مبلغ الطلب بتحويل بنكي إلى حساب التعاونية، ويُرسل وصل التحويل على واتساب. يُخصم العربون من المبلغ الإجمالي، ويُؤدى الباقي نقداً عند الاستلام. لا نطلب أي معلومات بنكية على الموقع.</p>
<p>[يحدده العميل مع محاميه: شروط استرجاع العربون في حالة الإلغاء.]</p>', '<p>يُؤدى ثمن الطلب نقداً عند الاستلام. لا نطلب أي دفع مسبق ولا أي معلومات بنكية.</p>'))), "value_fr" = jsonb_set("value_fr", '{html}', to_jsonb(replace(replace("value_fr"->>'html', '<p>Vous passez commande via le formulaire, WhatsApp ou par téléphone. La commande n’est définitive qu’après réception de l’acompte et notre confirmation.</p>', '<p>Vous passez commande via le formulaire, WhatsApp ou par téléphone ; nous vous appelons pour la confirmer avant l’envoi.</p>'), '<p>Un acompte de 10 % du montant de la commande est demandé par virement sur le compte de la coopérative ; le reçu est envoyé sur WhatsApp. L’acompte est déduit du total et le solde se paie en espèces à la livraison. Aucune donnée bancaire n’est demandée sur le site.</p>
<p>[À définir par le client avec son avocat : conditions de remboursement de l’acompte en cas d’annulation.]</p>', '<p>La commande se paie en espèces à la livraison. Aucun paiement à l’avance ni aucune donnée bancaire n’est demandé.</p>'))) WHERE "key" = 'page_terms' AND coalesce("value_ar"->>'reviewed', 'false') = 'false';
