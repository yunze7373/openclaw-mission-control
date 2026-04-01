"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Locale, messages, SUPPORTED_LOCALES } from "@/i18n/messages";

const STORAGE_KEY = "mc:locale";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  formatRelativeTime: (val: string | number) => string;
  formatClockTime: (val: string | number) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function resolveMessage(locale: Locale, key: string): string {
  const parts = key.split(".");
  let current: unknown = messages[locale];
  for (const part of parts) {
    if (!current || typeof current !== "object" || !(part in current)) {
      current = undefined;
      break;
    }
    current = (current as Record<string, unknown>)[part];
  }
  if (typeof current === "string") return current;

  if (locale !== "en") {
    return resolveMessage("en", key);
  }
  return key;
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? `{${name}}`));
}

function relativeTime(locale: Locale, val: string | number): string {
  if (!val) return resolveMessage(locale, "cron.never");
  const date = typeof val === "number" ? new Date(val) : new Date(val.endsWith("Z") ? val : `${val}Z`);
  const diffSeconds = Math.floor((date.getTime() - Date.now()) / 1000);
  if (!Number.isFinite(diffSeconds)) return resolveMessage(locale, "common.justNow");
  if (Math.abs(diffSeconds) < 10) return resolveMessage(locale, "common.justNow");

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const divisions: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
    ["second", 1],
  ];

  for (const [unit, secondsInUnit] of divisions) {
    if (Math.abs(diffSeconds) >= secondsInUnit || unit === "second") {
      return rtf.format(Math.round(diffSeconds / secondsInUnit), unit);
    }
  }
  return resolveMessage(locale, "common.justNow");
}

function clockTime(locale: Locale, val: string | number): string {
  if (!val) return "";
  const date = typeof val === "number" ? new Date(val) : new Date(val.endsWith("Z") ? val : `${val}Z`);
  if (Number.isNaN(date.getTime())) return String(val);
  return date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("zh-CN");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Locale | null;
    const nextLocale = stored && SUPPORTED_LOCALES.includes(stored) ? stored : "zh-CN";
    setLocaleState(nextLocale);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    window.localStorage.setItem(STORAGE_KEY, locale);
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => interpolate(resolveMessage(locale, key), vars),
    [locale]
  );

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t,
      formatRelativeTime: (val: string | number) => relativeTime(locale, val),
      formatClockTime: (val: string | number) => clockTime(locale, val),
    }),
    [locale, setLocale, t]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useLocale must be used inside LocaleProvider");
  return value;
}
