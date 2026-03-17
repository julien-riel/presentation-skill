/**
 * Locale utilities for the PPTX renderer.
 * Maps locale codes to default currency symbols and OOXML language tags.
 */

/** Map of locale prefixes to default currency symbols. */
const CURRENCY_MAP: Record<string, string> = {
  'en-US': '$',
  'en-GB': '£',
  'en-AU': 'A$',
  'en-CA': 'CA$',
  'fr': '€',
  'de': '€',
  'es': '€',
  'it': '€',
  'nl': '€',
  'pt': '€',
  'pt-BR': 'R$',
  'ja': '¥',
  'zh': '¥',
  'ko': '₩',
  'ru': '₽',
  'tr': '₺',
  'in': '₹',
  'hi': '₹',
  'pl': 'zł',
  'sv': 'kr',
  'da': 'kr',
  'nb': 'kr',
  'no': 'kr',
  'fi': '€',
  'cs': 'Kč',
  'ar': 'د.إ',
  'he': '₪',
  'th': '฿',
};

/**
 * Returns the default currency symbol for a locale string.
 * Tries exact match first (e.g. "pt-BR"), then language prefix (e.g. "pt").
 * Falls back to "$" if no match.
 */
export function getDefaultCurrencySymbol(locale?: string): string {
  if (!locale) return '$';
  const normalized = locale.trim();
  if (CURRENCY_MAP[normalized]) return CURRENCY_MAP[normalized];
  const lang = normalized.split('-')[0].toLowerCase();
  if (CURRENCY_MAP[lang]) return CURRENCY_MAP[lang];
  return '$';
}

/**
 * Returns a valid OOXML language tag for a locale string.
 * If the locale is a simple 2-letter code, appends a default region.
 * Falls back to "en-US" if not provided.
 */
export function getOoxmlLang(locale?: string): string {
  if (!locale) return 'en-US';
  const trimmed = locale.trim();
  if (trimmed.includes('-')) return trimmed;
  // Common 2-letter to full BCP 47 mappings
  const LANG_MAP: Record<string, string> = {
    en: 'en-US', fr: 'fr-FR', de: 'de-DE', es: 'es-ES',
    it: 'it-IT', pt: 'pt-PT', nl: 'nl-NL', ja: 'ja-JP',
    zh: 'zh-CN', ko: 'ko-KR', ru: 'ru-RU', ar: 'ar-SA',
    tr: 'tr-TR', pl: 'pl-PL', sv: 'sv-SE', da: 'da-DK',
    nb: 'nb-NO', fi: 'fi-FI', cs: 'cs-CZ', hi: 'hi-IN',
    he: 'he-IL', th: 'th-TH',
  };
  return LANG_MAP[trimmed.toLowerCase()] ?? `${trimmed}-${trimmed.toUpperCase()}`;
}
