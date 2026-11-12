// Player-facing text lookup for the view. Core owns the string tables (core/data/i18n.ts); the few view-only keys
// below are kept here so the view never shows a raw key.
import { t as coreT, STRINGS_EN, type Lang } from '../../core/data/i18n';

const VIEW_EN: Record<string, string> = {
  'ui.new': 'New run',
  'ui.erase': 'Erase',
  'ui.yes': 'Yes',
  'ui.no': 'No',
  'ui.close': 'Close',
  'ui.english': 'English',
  'ui.vietnamese': 'Tieng Viet',
  'ui.tapToStart': 'Tap to start',
  'ui.loading': 'Loading',
  'ui.omens': 'Omens',
  'hud.minimap': 'Map',
  'build.total': 'Total',
  'build.level': 'Level {n}',
  'build.refund': 'Refund',
  'build.max': 'Max level',
  'squad.title': 'Squad',
  'end.continue': 'Continue',
};
const VIEW_VI: Record<string, string> = {
  'ui.new': 'Van moi', 'ui.erase': 'Xoa', 'ui.yes': 'Co', 'ui.no': 'Khong', 'ui.close': 'Dong', 'ui.english': 'English',
  'ui.vietnamese': 'Tieng Viet', 'ui.tapToStart': 'Cham de bat dau', 'ui.loading': 'Dang tai', 'ui.omens': 'Diem bao',
  'hud.minimap': 'Ban do', 'build.total': 'Tong', 'build.level': 'Cap {n}', 'build.refund': 'Hoan lai', 'build.max': 'Cap toi da',
  'squad.title': 'Doi', 'end.continue': 'Tiep tuc',
};

let lang: Lang = 'en';
export function setLang(l: Lang): void { lang = l; }
export function getLang(): Lang { return lang; }

export function tr(key: string, params?: Record<string, string | number>): string {
  let s: string | undefined;
  if (key in STRINGS_EN) return coreT(key, lang, params);
  s = (lang === 'vi' ? VIEW_VI[key] : undefined) ?? VIEW_EN[key];
  if (s === undefined) return key;
  if (params) for (const k in params) s = s.split(`{${k}}`).join(String(params[k]));
  return s;
}
