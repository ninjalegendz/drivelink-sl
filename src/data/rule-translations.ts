import type { ExplanationLanguage } from "@/lib/i18n/explanations";

// The standard house rules, keyed and translated.
//
// Listings store the ENGLISH label in vehicles.rules (a string[]), which is why
// this catalogue is matched by English text rather than by key: existing rows
// keep working with no migration, and a host who picked "No smoking inside the
// vehicle" last month gets the Sinhala version today.
//
// Anything a host typed themselves has no entry here. That text is shown
// verbatim and marked as the host's own words, because silently leaving it in
// one language inside an otherwise translated list is what makes a
// half-translated screen misleading rather than merely incomplete.
//
// Sinhala and Tamil produced with Gemini 3.7 Flash, not yet checked by a native
// speaker.

export const RULE_TRANSLATIONS = {
  licence_required: {
    en: "Valid licence or IDP required for self-drive",
    si: "ස්වයං ධාවනයට වලංගු රියදුරු බලපත්‍රයක් හෝ IDP අවශ්‍යයි",
    ta: "சுயமாக ஓட்ட செல்லுபடியான சாரதி அனுமதிப்பத்திரம் அல்லது IDP தேவை",
  },
  same_fuel_level: {
    en: "Return with the same fuel level",
    si: "ලබාගත් ඉන්ධන මට්ටමෙන්ම ආපසු භාරදෙන්න",
    ta: "எடுத்த அதே எரிபொருள் அளவில் திருப்பியளிக்கவும்",
  },
  no_smoking: {
    en: "No smoking inside the vehicle",
    si: "රථය තුළ දුම්පානය තහනම්",
    ta: "வாகனத்தினுள் புகைபிடிக்கத் தடை",
  },
  no_pets: {
    en: "No pets inside the vehicle",
    si: "රථය තුළ සුරතල් සතුන් තහනම්",
    ta: "வாகனத்தினுள் செல்லப்பிராணிகள் தடை",
  },
  mileage_cap: {
    en: "Daily mileage cap applies, extra km charged",
    si: "දෛනික කි.මී. සීමාවක් ඇත, අමතර කි.මී. සඳහා අය කෙරේ",
    ta: "தினசரி தூர வரம்பு உண்டு, கூடுதல் கி.மீட்டருக்கு கட்டணம்",
  },
  no_offroad: {
    en: "No off-road or beach driving",
    si: "Off-road හෝ වෙරළේ ධාවනය තහනම්",
    ta: "Off-road அல்லது கடற்கரையில் ஓட்டத் தடை",
  },
  deposit_at_handover: {
    en: "Refundable deposit collected at handover",
    si: "භාරදීමේදී ආපසු ලැබෙන ඇප මුදලක් අය කෙරේ",
    ta: "ஒப்படைக்கும்போது மீளளிக்கப்படும் வைப்புப்பணம் பெறப்படும்",
  },
  renter_pays_running: {
    en: "Renter pays fuel, parking and fines",
    si: "ඉන්ධන, පාකිං සහ දඩ මුදල් කුලීකරු විසින් ගෙවිය යුතුය",
    ta: "எரிபொருள், பாக்கிங் மற்றும் அபராதங்களை வாடகைதாரரே செலுத்த வேண்டும்",
  },
  condition_photos: {
    en: "Condition photos taken at handover and return",
    si: "භාරදීමේදී සහ ආපසු ගැනීමේදී ඡායාරූප ගනු ලැබේ",
    ta: "ஒப்படைக்கும்போதும் திரும்பப் பெறும்போதும் புகைப்படங்கள் எடுக்கப்படும்",
  },
  island_wide: {
    en: "Island-wide travel allowed",
    si: "දිවයින පුරා ධාවනය කළ හැක",
    ta: "நாடு முழுவதும் பயணிக்கலாம்",
  },
  min_age_21: {
    en: "Minimum age 21 for self-drive",
    si: "ස්වයං ධාවනයට අවම වයස අවුරුදු 21යි",
    ta: "சுயமாக ஓட்ட குறைந்தபட்ச வயது 21",
  },
  late_return_hourly: {
    en: "Late return charged per extra hour",
    si: "ප්‍රමාද වී භාරදීමට අමතර පැයකට අය කෙරේ",
    ta: "தாமதமாக ஒப்படைக்க மணித்தியால அடிப்படையில் கட்டணம்",
  },
} as const;

export type RuleKey = keyof typeof RULE_TRANSLATIONS;

/** English label -> key, for matching what listings already store. */
const BY_ENGLISH = new Map<string, RuleKey>(
  (Object.keys(RULE_TRANSLATIONS) as RuleKey[]).map((key) => [
    RULE_TRANSLATIONS[key].en.toLowerCase().trim(),
    key,
  ]),
);

export interface ResolvedRule {
  text: string;
  /** False when this is the host's own wording and was not translated. */
  standard: boolean;
}

/**
 * Turn a stored rule string into display text in the reader's language.
 * Unknown (host-written) rules come back untouched and flagged.
 */
export function resolveRule(stored: string, language: ExplanationLanguage): ResolvedRule {
  const key = BY_ENGLISH.get(stored.toLowerCase().trim());
  if (!key) return { text: stored, standard: false };
  return { text: RULE_TRANSLATIONS[key][language], standard: true };
}
