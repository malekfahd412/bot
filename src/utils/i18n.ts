import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { logger } from './logger.js';

/* ─────────────────────────────────────────────────────────────────────────
   CENTRALIZED LOCALIZATION ENGINE
   - Loads all locale files once at startup (synchronous, cached)
   - t(lang, key, vars?) — never throws, always returns a string
   - Auto-fallback: ar → en → key itself
   - Variable interpolation: {{varName}}
   - Supports dot-notation: "commands.daily.title"
───────────────────────────────────────────────────────────────────────── */

export type SupportedLang = 'en' | 'ar';
export const SUPPORTED_LANGS: SupportedLang[] = ['en', 'ar'];
export const DEFAULT_LANG: SupportedLang = 'en';

type LocaleBundle = Record<string, unknown>;
type LangMap = Record<string, LocaleBundle>;

const LOCALE_FILES = ['common', 'commands', 'shop', 'crew', 'events'] as const;
type LocaleFile = (typeof LOCALE_FILES)[number];

/* ── In-memory cache ─────────────────────────────────────────────────── */
const _cache: Record<SupportedLang, Record<LocaleFile, LocaleBundle>> = {
  en: {} as Record<LocaleFile, LocaleBundle>,
  ar: {} as Record<LocaleFile, LocaleBundle>,
};

/* ── Load all locale files at module load (synchronous, one-time) ─────── */
function loadLocales(): void {
  const localesRoot = join(process.cwd(), 'locales');

  for (const lang of SUPPORTED_LANGS) {
    for (const file of LOCALE_FILES) {
      const filePath = join(localesRoot, lang, `${file}.json`);
      try {
        if (!existsSync(filePath)) {
          logger.warn(`[i18n] Missing locale file: ${filePath}`);
          _cache[lang][file] = {};
          continue;
        }
        const raw = readFileSync(filePath, 'utf-8');
        _cache[lang][file] = JSON.parse(raw) as LocaleBundle;
      } catch (err) {
        logger.error(`[i18n] Failed to load ${filePath}:`, err);
        _cache[lang][file] = {};
      }
    }
  }

  logger.info('[i18n] Locale files loaded — en + ar ready');
}

loadLocales();

/* ── Deep key resolver ───────────────────────────────────────────────── */
function resolvePath(obj: unknown, parts: string[]): string | undefined {
  let current = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : undefined;
}

/* ── Variable interpolation: "Hello {{name}}" + { name: "World" } ──────── */
function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = vars[key];
    return val !== undefined ? String(val) : `{{${key}}}`;
  });
}

/* ── Main translation function ───────────────────────────────────────── */

/**
 * Translate a dot-notation key for a given language.
 * Key format: "file.section.key" e.g. "common.errors.generic"
 * Falls back: requested lang → English → raw key string
 *
 * @param lang  - 'en' | 'ar' (or null/undefined → defaults to 'en')
 * @param key   - dot-notation path, first segment is the locale file name
 * @param vars  - optional interpolation variables
 */
export function t(
  lang: string | null | undefined,
  key: string,
  vars?: Record<string, string | number>
): string {
  const resolvedLang: SupportedLang = (lang === 'ar' ? 'ar' : 'en');
  const parts = key.split('.');
  const [file, ...rest] = parts;

  if (!LOCALE_FILES.includes(file as LocaleFile)) {
    logger.warn(`[i18n] Unknown locale file segment: "${file}" in key "${key}"`);
    return interpolate(key, vars);
  }

  const f = file as LocaleFile;

  // Try requested language first
  let value = resolvePath(_cache[resolvedLang][f], rest);

  // Fallback to English
  if (value === undefined && resolvedLang !== DEFAULT_LANG) {
    value = resolvePath(_cache[DEFAULT_LANG][f], rest);
    if (value !== undefined) {
      logger.debug(`[i18n] Fallback to EN for key: "${key}" (lang=${resolvedLang})`);
    }
  }

  // Final fallback: return the key itself (never undefined)
  if (value === undefined) {
    logger.warn(`[i18n] Missing translation key: "${key}" (lang=${resolvedLang})`);
    return interpolate(key, vars);
  }

  return interpolate(value, vars);
}

/* ── Convenience: translate from a Player object's language field ─────── */
export function tPlayer(
  playerLang: string | null | undefined,
  key: string,
  vars?: Record<string, string | number>
): string {
  return t(playerLang ?? DEFAULT_LANG, key, vars);
}

/* ── Reload locales at runtime (useful for hot-reload without restart) ── */
export function reloadLocales(): void {
  loadLocales();
  logger.info('[i18n] Locales reloaded.');
}

/* ── Validation: list all missing keys in a language vs English ─────── */
export function getMissingKeys(lang: SupportedLang): string[] {
  if (lang === 'en') return [];
  const missing: string[] = [];

  function traverse(enObj: unknown, langObj: unknown, path: string): void {
    if (typeof enObj !== 'object' || enObj == null) return;
    for (const key of Object.keys(enObj as Record<string, unknown>)) {
      const fullPath = path ? `${path}.${key}` : key;
      const enVal = (enObj as Record<string, unknown>)[key];
      const langVal = langObj != null ? (langObj as Record<string, unknown>)[key] : undefined;
      if (typeof enVal === 'string') {
        if (langVal === undefined) missing.push(fullPath);
      } else {
        traverse(enVal, langVal, fullPath);
      }
    }
  }

  for (const file of LOCALE_FILES) {
    traverse(_cache.en[file], _cache[lang][file], file);
  }

  return missing;
}
