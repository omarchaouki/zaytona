import type { Locale } from '~/i18n/config'

/**
 * Moroccan cities and towns for the order form's city search, roughly by size.
 * Visitors can still type any place not in the list (free text is accepted).
 */
export const CITIES: ReadonlyArray<{ ar: string; fr: string }> = [
  { ar: 'الدار البيضاء', fr: 'Casablanca' },
  { ar: 'الرباط', fr: 'Rabat' },
  { ar: 'مراكش', fr: 'Marrakech' },
  { ar: 'فاس', fr: 'Fès' },
  { ar: 'طنجة', fr: 'Tanger' },
  { ar: 'سلا', fr: 'Salé' },
  { ar: 'مكناس', fr: 'Meknès' },
  { ar: 'أكادير', fr: 'Agadir' },
  { ar: 'وجدة', fr: 'Oujda' },
  { ar: 'القنيطرة', fr: 'Kénitra' },
  { ar: 'تطوان', fr: 'Tétouan' },
  { ar: 'تمارة', fr: 'Témara' },
  { ar: 'آسفي', fr: 'Safi' },
  { ar: 'المحمدية', fr: 'Mohammedia' },
  { ar: 'خريبكة', fr: 'Khouribga' },
  { ar: 'الجديدة', fr: 'El Jadida' },
  { ar: 'بني ملال', fr: 'Béni Mellal' },
  { ar: 'آيت ملول', fr: 'Aït Melloul' },
  { ar: 'الناظور', fr: 'Nador' },
  { ar: 'تازة', fr: 'Taza' },
  { ar: 'سطات', fr: 'Settat' },
  { ar: 'برشيد', fr: 'Berrechid' },
  { ar: 'الخميسات', fr: 'Khémisset' },
  { ar: 'إنزكان', fr: 'Inezgane' },
  { ar: 'القصر الكبير', fr: 'Ksar El Kébir' },
  { ar: 'العرائش', fr: 'Larache' },
  { ar: 'كلميم', fr: 'Guelmim' },
  { ar: 'خنيفرة', fr: 'Khénifra' },
  { ar: 'بركان', fr: 'Berkane' },
  { ar: 'تاوريرت', fr: 'Taourirt' },
  { ar: 'بوسكورة', fr: 'Bouskoura' },
  { ar: 'الفقيه بن صالح', fr: 'Fquih Ben Salah' },
  { ar: 'الداخلة', fr: 'Dakhla' },
  { ar: 'العيون', fr: 'Laâyoune' },
  { ar: 'سيدي سليمان', fr: 'Sidi Slimane' },
  { ar: 'سيدي قاسم', fr: 'Sidi Kacem' },
  { ar: 'الرشيدية', fr: 'Errachidia' },
  { ar: 'ورزازات', fr: 'Ouarzazate' },
  { ar: 'الصويرة', fr: 'Essaouira' },
  { ar: 'تارودانت', fr: 'Taroudant' },
  { ar: 'تزنيت', fr: 'Tiznit' },
  { ar: 'وادي زم', fr: 'Oued Zem' },
  { ar: 'سوق الأربعاء الغرب', fr: 'Souk El Arbaâ du Gharb' },
  { ar: 'يوسفية', fr: 'Youssoufia' },
  { ar: 'ابن جرير', fr: 'Benguerir' },
  { ar: 'قلعة السراغنة', fr: 'El Kelaâ des Sraghna' },
  { ar: 'العطاوية', fr: 'Attaouia' },
  { ar: 'تملالت', fr: 'Tamellalt' },
  { ar: 'سيدي رحال', fr: 'Sidi Rahal' },
  { ar: 'الصخور الرحامنة', fr: 'Skhour Rehamna' },
  { ar: 'شيشاوة', fr: 'Chichaoua' },
  { ar: 'أمزميز', fr: 'Amizmiz' },
  { ar: 'تحناوت', fr: 'Tahannaout' },
  { ar: 'آيت أورير', fr: 'Aït Ourir' },
  { ar: 'دمنات', fr: 'Demnate' },
  { ar: 'أزيلال', fr: 'Azilal' },
  { ar: 'قصبة تادلة', fr: 'Kasba Tadla' },
  { ar: 'سوق السبت أولاد النمة', fr: 'Souk Sebt Oulad Nemma' },
  { ar: 'الفنيدق', fr: 'Fnideq' },
  { ar: 'المضيق', fr: "M'diq" },
  { ar: 'مرتيل', fr: 'Martil' },
  { ar: 'شفشاون', fr: 'Chefchaouen' },
  { ar: 'وزان', fr: 'Ouezzane' },
  { ar: 'الحسيمة', fr: 'Al Hoceïma' },
  { ar: 'إفران', fr: 'Ifrane' },
  { ar: 'أزرو', fr: 'Azrou' },
  { ar: 'الحاجب', fr: 'El Hajeb' },
  { ar: 'صفرو', fr: 'Sefrou' },
  { ar: 'ميدلت', fr: 'Midelt' },
  { ar: 'جرادة', fr: 'Jerada' },
  { ar: 'الدريوش', fr: 'Driouch' },
  { ar: 'زايو', fr: 'Zaïo' },
  { ar: 'بنسليمان', fr: 'Benslimane' },
  { ar: 'بوزنيقة', fr: 'Bouznika' },
  { ar: 'الصخيرات', fr: 'Skhirat' },
  { ar: 'سيدي بنور', fr: 'Sidi Bennour' },
  { ar: 'أزمور', fr: 'Azemmour' },
  { ar: 'آسفي', fr: 'Safi' },
  { ar: 'زاكورة', fr: 'Zagora' },
  { ar: 'تنغير', fr: 'Tinghir' },
  { ar: 'طانطان', fr: 'Tan-Tan' },
  { ar: 'سيدي إفني', fr: 'Sidi Ifni' },
  { ar: 'بوجدور', fr: 'Boujdour' },
  { ar: 'السمارة', fr: 'Smara' },
  { ar: 'الفقيه بن صالح', fr: 'Fquih Ben Salah' },
  { ar: 'المحمدية', fr: 'Mohammedia' },
].filter((c, i, all) => all.findIndex((o) => o.fr === c.fr) === i)

/** Fold case, accents and Arabic letter variants so "fes", "Fès" and "فاس" match loosely. */
export function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // accents, Arabic harakat
    .replace(/ـ/g, '') // tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[گ]/g, 'ك')
    .replace(/[ک]/g, 'ك')
    .toLowerCase()
    .replace(/[\s'’-]+/g, ' ')
    .trim()
}

/** Cities matching the query in either language, labelled in the active one. */
export function searchCities(query: string, locale: Locale, limit = 8): string[] {
  const q = normalizeForSearch(query)
  const label = (c: { ar: string; fr: string }) => c[locale]
  if (!q) return CITIES.slice(0, limit).map(label)
  const starts: string[] = []
  const contains: string[] = []
  for (const c of CITIES) {
    const keys = [normalizeForSearch(c.ar), normalizeForSearch(c.fr)]
    if (keys.some((k) => k.startsWith(q))) starts.push(label(c))
    else if (keys.some((k) => k.includes(q))) contains.push(label(c))
  }
  return [...starts, ...contains].slice(0, limit)
}
