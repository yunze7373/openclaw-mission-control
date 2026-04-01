import type { ComponentType } from "react";
import type { Locale } from "@/i18n/messages";

export type Translate = (key: string, vars?: Record<string, string | number>) => string;

export function taskStatusLabel(status: string, t: Translate): string {
  switch (status) {
    case "inbox":
      return t("dashboard.columns.inbox");
    case "assigned":
      return t("dashboard.columns.assigned");
    case "in_progress":
      return t("dashboard.columns.inProgress");
    case "review":
      return t("dashboard.columns.review");
    case "done":
      return t("dashboard.columns.done");
    default:
      return status.replace(/_/g, " ");
  }
}

export function approvalDecisionLabel(decision: string | undefined, t: Translate): string {
  if (decision === "approve" || decision === "allow-once" || decision === "allow-always") {
    return t("approvals.approve");
  }
  if (decision === "reject" || decision === "deny") return t("approvals.reject");
  return decision ?? "-";
}

export function logLevelLabel(level: string, t: Translate): string {
  switch (level.toUpperCase()) {
    case "INFO":
      return t("common.status");
    case "WARN":
    case "WARNING":
      return "WARN";
    case "ERROR":
    case "ERR":
      return t("tools.error").toUpperCase();
    case "DEBUG":
      return "DEBUG";
    default:
      return level.toUpperCase();
  }
}

export type ToolCatalogEntry = {
  tool: string;
  icon: ComponentType<{ className?: string }>;
  categoryKey: string;
  labelKey: string;
  descKey: string;
  params: Array<{
    name: string;
    labelKey: string;
    type: string;
    placeholderKey?: string;
    placeholder?: string;
    optional?: boolean;
  }>;
};

export function toolCategoryLabel(categoryKey: string, t: Translate): string {
  return t(categoryKey);
}

export function scheduleHumanEvery(ms: number, locale: Locale, t: Translate): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "always" });
  if (ms < 60_000) return `${t("cron.scheduleLabel")}: ${rtf.format(Math.round(ms / 1000), "second").replace(/^[+-]/, "")}`;
  if (ms < 3_600_000) return `${t("cron.scheduleLabel")}: ${rtf.format(Math.round(ms / 60_000), "minute").replace(/^[+-]/, "")}`;
  if (ms < 86_400_000) return `${t("cron.scheduleLabel")}: ${rtf.format(Math.round(ms / 3_600_000), "hour").replace(/^[+-]/, "")}`;
  return `${t("cron.scheduleLabel")}: ${rtf.format(Math.round(ms / 86_400_000), "day").replace(/^[+-]/, "")}`;
}
