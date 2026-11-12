import { STRINGS_EN } from './strings.en';
import { STRINGS_VI } from './strings.vi';

export type Lang = 'en' | 'vi';
const TABLES: Record<Lang, Record<string, string>> = { en: STRINGS_EN, vi: STRINGS_VI };

/** Look up a player-facing string. Falls back to English, then to the key itself. */
export function t(key: string, lang: Lang = 'en', params?: Record<string, string | number>): string {
  let s = TABLES[lang]?.[key] ?? STRINGS_EN[key] ?? key;
  if (params) for (const k in params) s = s.split(`{${k}}`).join(String(params[k]));
  return s;
}

export { STRINGS_EN, STRINGS_VI };
