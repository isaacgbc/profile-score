import type { Locale } from "../types";
import en from "./en.json";
import es from "./es.json";

export type TranslationKeys = typeof en;

const translations: Record<Locale, TranslationKeys> = { en, es };

export function getTranslations(locale: Locale): TranslationKeys {
  return translations[locale];
}

export function detectLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const lang = navigator.language.slice(0, 2);
  return lang === "es" ? "es" : "en";
}
