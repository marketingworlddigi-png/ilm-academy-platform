export const locales = ["en-pk", "ur-pk", "ar"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en-pk";
export const rtlLocales: readonly Locale[] = ["ur-pk", "ar"];

export const isLocale = (v: string): v is Locale => (locales as readonly string[]).includes(v);
export const dirOf = (l: Locale): "rtl" | "ltr" => (rtlLocales.includes(l) ? "rtl" : "ltr");
export const htmlLangOf = (l: Locale): string => (l === "en-pk" ? "en-PK" : l === "ur-pk" ? "ur-PK" : "ar");
/** Locale-prefixed internal path. */
export const href = (l: Locale, p = "/") => `/${l}${p === "/" ? "" : p}`;
