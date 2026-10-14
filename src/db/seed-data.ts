/*
 * Demo content for a fresh install. Every product, FAQ and policy text here is
 * DEMO DATA written for the template: rows are flagged `is_demo` (policies:
 * `reviewed: false`) so the admin lists exactly what the client must check or
 * replace. Prices are placeholders, not the cooperative's real prices, and the
 * reviews are examples, not customers.
 */

/** Placeholder price of one litre (MAD) until the cooperative sets its own in the admin. */
export const DEMO_PRICE_PER_LITER = 90

/** Olive oil only, sold by volume; prices follow the price per litre (auto). */
export const demoProducts = [
  {
    slug: 'huile-olive-30l',
    liters: 30,
    nameAr: 'زيت الزيتون البكر الممتاز',
    nameFr: "Huile d'olive vierge extra",
    taglineAr: 'للاستهلاك العائلي.',
    taglineFr: 'Pour la consommation familiale.',
    sizeLabelAr: '30 لتر',
    sizeLabelFr: '30 litres',
    image: 'static:oil-pour',
    altAr: 'زيت زيتون ذهبي يُسكب في وعاء',
    altFr: 'Huile d’olive dorée versée dans un bol',
  },
  {
    slug: 'huile-olive-60l',
    liters: 60,
    nameAr: 'زيت الزيتون البكر الممتاز',
    nameFr: "Huile d'olive vierge extra",
    taglineAr: 'للأسر الكبيرة أو للتقسيم مع العائلة.',
    taglineFr: 'Pour les grandes familles ou à partager.',
    sizeLabelAr: '60 لتر',
    sizeLabelFr: '60 litres',
    image: 'static:oil-pour',
    altAr: 'زيت زيتون ذهبي يُسكب في وعاء',
    altFr: 'Huile d’olive dorée versée dans un bol',
  },
  {
    slug: 'huile-olive-90l',
    liters: 90,
    nameAr: 'زيت الزيتون البكر الممتاز',
    nameFr: "Huile d'olive vierge extra",
    taglineAr: 'مؤونة السنة.',
    taglineFr: 'La provision de l’année.',
    sizeLabelAr: '90 لتر',
    sizeLabelFr: '90 litres',
    image: 'static:oil-pour',
    altAr: 'زيت زيتون ذهبي يُسكب في وعاء',
    altFr: 'Huile d’olive dorée versée dans un bol',
  },
] as const

/** Products of the first template (1 L, 5 L, table olives): retired while still untouched demo rows. */
export const legacyDemoSlugs = [
  'huile-olive-vierge-extra-1l',
  'huile-olive-vierge-extra-5l',
  'olives-vertes-de-table-1kg',
]

/**
 * Example reviews in Moroccan Darija, flagged `is_demo`: shown with an
 * "example" badge, kept out of structured data and of the hero rating, and
 * listed in the admin so the cooperative deletes them once real reviews arrive.
 */
export const demoReviews = [
  {
    authorName: 'خديجة',
    city: 'مراكش',
    rating: 5,
    comment: 'الزيت بنين بزاف، ريحتو كتعمر الدار. غادي نعاود نطلب إن شاء الله.',
  },
  {
    authorName: 'يوسف بناني',
    city: 'الدار البيضاء',
    rating: 5,
    comment: 'وصلني فالوقت والتغليف مزيان. طعم زيت البلاد ديال بصح.',
  },
  {
    authorName: 'هاجر مرزوق',
    city: 'الرباط',
    rating: 4,
    comment: 'الزيت صافي والثمن معقول، غير التوصيل تعطل شي شوية.',
  },
  {
    authorName: 'عبد الله زروال',
    city: 'قلعة السراغنة',
    rating: 5,
    comment: 'خديت 30 لتر للدار، الحمد لله كلشي عجبو الطعم. الله يعطيكم الصحة.',
  },
] as const

export const demoFaqs: Array<{ qAr: string; aAr: string; qFr: string; aFr: string }> = [
  {
    qAr: 'هل توصلون إلى مدينتي؟ وكم تستغرق مدة التوصيل؟',
    aAr: 'نوصل إلى جميع مدن المغرب. تختلف المدة حسب مدينتك، ونؤكد لك موعد التوصيل بالضبط عندما نتصل بك لتأكيد الطلب.',
    qFr: 'Livrez-vous dans ma ville ? En combien de temps ?',
    aFr: 'Nous livrons dans tout le Maroc. Le délai dépend de votre ville : nous vous donnons la date exacte quand nous vous appelons pour confirmer la commande.',
  },
  {
    qAr: 'كيف أدفع ثمن الطلب؟',
    aAr: 'تدفع ثمن طلبك نقداً لعامل التوصيل عند استلامه. لا نطلب منك أي دفع مسبق ولا أي معلومات بنكية.',
    qFr: 'Comment se passe le paiement ?',
    aFr: 'Vous payez en espèces au livreur, à la réception de la commande. Aucun paiement à l’avance ni aucune donnée bancaire ne vous est demandé.',
  },
  {
    qAr: 'ماذا أفعل إذا وصلني المنتج تالفاً أو مختلفاً عما طلبت؟',
    aAr: 'تواصل معنا مباشرة عبر واتساب أو الهاتف، وأرسل لنا صورة إن أمكن، لنجد الحل معك. تجد التفاصيل في صفحة شروط البيع.',
    qFr: 'Que faire si le produit arrive abîmé ou ne correspond pas ?',
    aFr: 'Contactez-nous directement par WhatsApp ou téléphone, avec une photo si possible, et nous trouverons une solution avec vous. Le détail figure dans nos conditions de vente.',
  },
  {
    qAr: 'كيف أحفظ زيت الزيتون؟ وما مدة صلاحيته؟',
    aAr: 'احفظه في مكان بارد ومظلم، بعيداً عن الحرارة والضوء، وأغلق القنينة جيداً بعد كل استعمال. تاريخ الاستهلاك المفضّل مكتوب على ملصق المنتج.',
    qFr: 'Comment conserver l’huile ? Combien de temps se garde-t-elle ?',
    aFr: 'Conservez-la au frais et à l’abri de la lumière, bouteille bien fermée après chaque usage. La date de consommation recommandée figure sur l’étiquette.',
  },
  {
    qAr: 'ما هي حموضة الزيت وكيف تُقاس؟',
    aAr: 'الحموضة هي نسبة الأحماض الدهنية الحرة في الزيت، وهي من مؤشرات جودته وتُقاس في المختبر. ليُصنَّف الزيت «بكراً ممتازاً» يجب ألا تتجاوز حموضته 0.8%. عندما يتوفر تقرير تحليل لمنتج ما، تجده في بطاقة المنتج تحت «تقرير الجودة».',
    qFr: 'Qu’est-ce que l’acidité et comment la mesure-t-on ?',
    aFr: 'L’acidité correspond au taux d’acides gras libres de l’huile ; c’est un indicateur de qualité mesuré en laboratoire. Une huile « vierge extra » doit avoir une acidité de 0,8 % au plus. Quand une analyse est disponible pour un produit, elle figure sur sa fiche sous « Rapport qualité ».',
  },
  {
    qAr: 'ماذا يعني ترخيص ONSSA؟',
    aAr: 'المكتب الوطني للسلامة الصحية للمنتجات الغذائية (ONSSA) هو الهيئة العمومية المكلفة بسلامة المنتجات الغذائية في المغرب. يُمنح الترخيص أو الاعتماد الصحي بعد أن يتحقق المكتب من أن وحدة الإنتاج تستوفي شروط النظافة والسلامة الصحية. تجد رقم ترخيصنا وصورة الشهادة في هذه الصفحة.',
    qFr: 'Que signifie l’autorisation ONSSA ?',
    aFr: 'L’ONSSA (Office National de Sécurité Sanitaire des produits Alimentaires) est l’organisme public chargé de la sécurité sanitaire des aliments au Maroc. L’autorisation ou l’agrément sanitaire est délivré après vérification que l’unité de production respecte les exigences d’hygiène. Notre numéro et le scan du certificat figurent sur cette page.',
  },
  {
    qAr: 'هل هناك حد أدنى للطلب؟',
    aAr: 'لا، يمكنك طلب وحدة واحدة. حدد الكمية التي تناسبك في استمارة الطلب.',
    qFr: 'Y a-t-il un minimum de commande ?',
    aFr: 'Non, vous pouvez commander une seule unité. Indiquez la quantité souhaitée dans le formulaire.',
  },
  {
    qAr: 'هل تقبلون الطلبات بالجملة أو طلبات الهدايا؟',
    aAr: 'نعم، راسلنا على واتساب أو اتصل بنا لنتفق معك على الكمية والثمن وطريقة التوصيل.',
    qFr: 'Acceptez-vous les commandes en gros ou les cadeaux ?',
    aFr: 'Oui : écrivez-nous sur WhatsApp ou appelez-nous pour convenir ensemble de la quantité, du prix et de la livraison.',
  },
  {
    qAr: 'كيف أتابع طلبي؟',
    aAr: 'بعد إرسال الطلب تحصل على رقم مرجعي مثل OL-2026-000123. أرسله لنا على واتساب أو اذكره عند الاتصال، ونخبرك بحالة طلبك.',
    qFr: 'Comment suivre ma commande ?',
    aFr: 'Après l’envoi, vous recevez une référence du type OL-2026-000123. Envoyez-la-nous sur WhatsApp ou citez-la au téléphone et nous vous donnons l’état de votre commande.',
  },
  {
    qAr: 'متى يمكنني التواصل معكم؟',
    aAr: 'تجد أوقات العمل وأرقام الهاتف أسفل هذه الصفحة. يمكنك مراسلتنا على واتساب في أي وقت، ونرد عليك خلال أوقات العمل.',
    qFr: 'Quand peut-on vous joindre ?',
    aFr: 'Nos horaires et numéros figurent en bas de cette page. Vous pouvez nous écrire sur WhatsApp à tout moment : nous répondons pendant nos heures d’ouverture.',
  },
]

/* Policy page drafts. Written in plain language for Law 09-08 (CNDP) and
 * Law 31-08 (consumer protection); MUST be reviewed by the client's lawyer. */

export const privacyDraft = {
  ar: {
    title: 'سياسة الخصوصية',
    html: `<p>تشرح هذه الصفحة كيف تجمع المعصرة معطياتك الشخصية وتستعملها، طبقاً للقانون رقم 09-08 المتعلق بحماية الأشخاص الذاتيين تجاه معالجة المعطيات ذات الطابع الشخصي.</p>
<h2>المعطيات التي نجمعها</h2>
<ul><li>عند الطلب: الاسم، رقم الهاتف، المدينة، والعنوان والملاحظة إذا أضفتهما.</li><li>عند كتابة رأي: الاسم، المدينة إن أردت، ورقم الهاتف إن أردت (لا يُعرض أبداً، ونستعمله فقط للتحقق من أنك اشتريت منا).</li><li>معطيات تقنية: نحفظ عنوان IP في شكل مشفّر غير قابل للاسترجاع، لحماية الموقع من الرسائل المزعجة.</li></ul>
<h2>لماذا نستعملها</h2>
<ul><li>لمعالجة طلبك والتواصل معك لتأكيده وتوصيله.</li><li>لنشر رأيك بعد مراجعته إذا كتبت رأياً.</li><li>لحماية الموقع من الاستعمال المسيء.</li></ul>
<h2>من يطّلع عليها</h2>
<p>فريق المعصرة المكلف بالطلبات، وشركة التوصيل في حدود ما تحتاجه لإيصال الطلب (الاسم، الهاتف، العنوان). لا نبيع معطياتك ولا نؤجرها.</p>
<h2>مدة الحفظ</h2>
<p>نحتفظ بمعطيات الطلب طوال المدة اللازمة لمعالجته وتتبعه، ثم وفق ما تفرضه الالتزامات القانونية والمحاسبية.</p>
<h2>حقوقك</h2>
<p>لك الحق في الولوج إلى معطياتك وتصحيحها والتعرض على معالجتها لأسباب مشروعة. لممارسة هذه الحقوق، تواصل معنا عبر الهاتف أو واتساب أو البريد الإلكتروني المذكور أسفل الصفحة. يمكنك أيضاً تقديم شكاية إلى اللجنة الوطنية لمراقبة حماية المعطيات ذات الطابع الشخصي (CNDP).</p>
<h2>ملفات تعريف الارتباط (الكوكيز)</h2>
<p>لا يستعمل الموقع العام أي كوكيز للتتبع أو الإشهار.</p>`,
    reviewed: false,
  },
  fr: {
    title: 'Politique de confidentialité',
    html: `<p>Cette page explique comment l’huilerie collecte et utilise vos données personnelles, conformément à la loi n° 09-08 relative à la protection des personnes physiques à l’égard du traitement des données à caractère personnel.</p>
<h2>Les données collectées</h2>
<ul><li>Lors d’une commande : nom, téléphone, ville, et l’adresse et la note si vous les indiquez.</li><li>Lors d’un avis : nom, ville (facultative) et téléphone (facultatif, jamais affiché, utilisé uniquement pour vérifier que vous avez acheté chez nous).</li><li>Données techniques : votre adresse IP est conservée sous forme chiffrée et irréversible, pour protéger le site contre le spam.</li></ul>
<h2>À quoi elles servent</h2>
<ul><li>Traiter votre commande et vous contacter pour la confirmer et la livrer.</li><li>Publier votre avis après modération, si vous en écrivez un.</li><li>Protéger le site contre les abus.</li></ul>
<h2>Qui y a accès</h2>
<p>L’équipe de l’huilerie chargée des commandes, et le transporteur pour ce dont il a besoin pour livrer (nom, téléphone, adresse). Nous ne vendons ni ne louons vos données.</p>
<h2>Durée de conservation</h2>
<p>Les données de commande sont conservées le temps nécessaire à son traitement et à son suivi, puis selon nos obligations légales et comptables.</p>
<h2>Vos droits</h2>
<p>Vous disposez d’un droit d’accès, de rectification et d’opposition pour motifs légitimes. Pour les exercer, contactez-nous par téléphone, WhatsApp ou e-mail (coordonnées en bas de page). Vous pouvez aussi saisir la Commission Nationale de contrôle de la protection des Données à caractère Personnel (CNDP).</p>
<h2>Cookies</h2>
<p>Le site public n’utilise aucun cookie de suivi ou publicitaire.</p>`,
    reviewed: false,
  },
}

export const termsDraft = {
  ar: {
    title: 'شروط البيع',
    html: `<h2>الطلب</h2>
<p>ترسل طلبك عبر الاستمارة أو واتساب أو الهاتف، ثم نتصل بك لتأكيده قبل الإرسال.</p>
<h2>الأثمنة</h2>
<p>الأثمنة معروضة بالدرهم المغربي. يُضاف ثمن التوصيل كما هو مبين في الموقع أو كما نؤكده معك قبل الإرسال.</p>
<h2>الأداء</h2>
<p>يُؤدى ثمن الطلب نقداً عند الاستلام. لا نطلب أي دفع مسبق ولا أي معلومات بنكية.</p>
<h2>التوصيل</h2>
<p>نوصل إلى جميع مدن المغرب. نؤكد معك موعد التوصيل عند تأكيد الطلب. افحص الطلب عند الاستلام.</p>
<h2>المنتج التالف أو غير المطابق</h2>
<p>إذا وصلك منتج تالف أو غير مطابق لطلبك، تواصل معنا في أقرب وقت مع صورة إن أمكن، لنتفق معك على الاستبدال أو الاسترجاع.</p>
<h2>حماية المستهلك</h2>
<p>تخضع هذه الشروط للقانون رقم 31-08 القاضي بتحديد تدابير لحماية المستهلك.</p>`,
    reviewed: false,
  },
  fr: {
    title: 'Conditions de vente',
    html: `<h2>Commande</h2>
<p>Vous passez commande via le formulaire, WhatsApp ou par téléphone ; nous vous appelons pour la confirmer avant l’envoi.</p>
<h2>Prix</h2>
<p>Les prix sont indiqués en dirhams marocains. Les frais de livraison s’ajoutent, tels qu’affichés sur le site ou confirmés avec vous avant l’envoi.</p>
<h2>Paiement</h2>
<p>La commande se paie en espèces à la livraison. Aucun paiement à l’avance ni aucune donnée bancaire n’est demandé.</p>
<h2>Livraison</h2>
<p>Nous livrons dans tout le Maroc. La date de livraison est confirmée avec vous au moment de la confirmation. Vérifiez votre colis à la réception.</p>
<h2>Produit abîmé ou non conforme</h2>
<p>Si un produit arrive abîmé ou ne correspond pas à votre commande, contactez-nous rapidement, avec une photo si possible, pour convenir d’un échange ou d’un remboursement.</p>
<h2>Protection du consommateur</h2>
<p>Les présentes conditions sont soumises à la loi n° 31-08 édictant des mesures de protection du consommateur.</p>`,
    reviewed: false,
  },
}
