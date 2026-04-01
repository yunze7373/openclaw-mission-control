"use client";

import { Languages } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { Locale } from "@/i18n/messages";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLocale();

  return (
    <label className="flex items-center gap-2 rounded border border-border bg-card/50 px-3 py-1.5 text-xs text-muted-foreground">
      <Languages className="h-3.5 w-3.5" />
      <span>{t("nav.language")}</span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className="bg-transparent text-foreground outline-none"
      >
        <option value="zh-CN">{t("nav.chinese")}</option>
        <option value="en">{t("nav.english")}</option>
      </select>
    </label>
  );
}
