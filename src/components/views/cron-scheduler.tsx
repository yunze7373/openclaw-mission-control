"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Clock,
  Plus,
  Play,
  Pause,
  RotateCcw,
  Trash2,
  Loader2,
  Calendar,
  Bot,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLocale } from "@/components/locale-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ScheduleObject {
  kind?: string;
  everyMs?: number;
  cron?: string;
  anchorMs?: number;
}

interface CronJob {
  id: string;
  name?: string;
  prompt?: string; // Legacy
  payload?: {
    kind: string;
    message?: string;
  };
  schedule: string | ScheduleObject;
  enabled: boolean;
  agentId?: string;
  state?: {
    lastRunAtMs?: number;
    nextRunAtMs?: number;
    lastError?: string;
    lastRunStatus?: string;
  };
  lastRun?: string; // Legacy
  nextRun?: string; // Legacy
}

// Human-friendly schedule presets
const SCHEDULE_PRESETS = [
  { labelKey: "cron.presets.everyHour", cron: "0 * * * *" },
  { labelKey: "cron.presets.everyDay9", cron: "0 9 * * *" },
  { labelKey: "cron.presets.everyDay18", cron: "0 18 * * *" },
  { labelKey: "cron.presets.weekdays9", cron: "0 9 * * 1-5" },
  { labelKey: "cron.presets.monday9", cron: "0 9 * * 1" },
  { labelKey: "cron.presets.sunday2", cron: "0 2 * * 0" },
  { labelKey: "cron.presets.every15", cron: "*/15 * * * *" },
  { labelKey: "cron.presets.every30", cron: "*/30 * * * *" },
  { labelKey: "cron.presets.twiceDaily", cron: "0 9,18 * * *" },
  { labelKey: "cron.presets.firstDay", cron: "0 9 1 * *" },
];

function formatMs(ms: number, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "always" });
  if (ms < 60_000) return rtf.format(Math.round(ms / 1000), "second").replace(/^[+-]/, "");
  if (ms < 3_600_000) return rtf.format(Math.round(ms / 60_000), "minute").replace(/^[+-]/, "");
  if (ms < 86_400_000) return rtf.format(Math.round(ms / 3_600_000), "hour").replace(/^[+-]/, "");
  return rtf.format(Math.round(ms / 86_400_000), "day").replace(/^[+-]/, "");
}

function scheduleToHuman(schedule: string | ScheduleObject, locale: string, t: (key: string) => string): string {
  if (typeof schedule === "object" && schedule !== null) {
    if (schedule.kind === "every" && schedule.everyMs) {
      return `${t("cron.scheduleLabel")}: ${formatMs(schedule.everyMs, locale)}`;
    }
    if (schedule.kind === "cron" && schedule.cron) {
      return cronToHuman(schedule.cron, t);
    }
    if (schedule.everyMs) {
      return `${t("cron.scheduleLabel")}: ${formatMs(schedule.everyMs, locale)}`;
    }
    return t("cron.customSchedule");
  }
  if (typeof schedule !== "string") return t("cron.customSchedule");
  return cronToHuman(schedule, t);
}

function cronToHuman(cron: string, t: (key: string) => string): string {
  const preset = SCHEDULE_PRESETS.find((p) => p.cron === cron);
  if (preset) return t(preset.labelKey);

  const parts = cron.split(" ");
  if (parts.length !== 5) return cron;

  const [min, hour, dom, , dow] = parts;

  if (min === "0" && hour !== "*" && dom === "*" && dow === "*") {
    const h = parseInt(hour);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${t("cron.presets.everyDay9").split("9:00")[0]}${h12}:00 ${ampm}`;
  }
  if (min.startsWith("*/")) return `${t("cron.scheduleLabel")}: */${min.slice(2)}`;
  if (hour.startsWith("*/")) return `${t("cron.scheduleLabel")}: */${hour.slice(2)}h`;
  return cron;
}

export function CronScheduler() {
  const { t, locale, formatRelativeTime } = useLocale();
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  // Create form state
  const [newPrompt, setNewPrompt] = useState("");
  const [newSchedule, setNewSchedule] = useState(SCHEDULE_PRESETS[1].cron);
  const [newAgent, setNewAgent] = useState("main");
  const [creating, setCreating] = useState(false);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/openclaw/cron");
      const data = await res.json();
      setJobs(Array.isArray(data.jobs) ? data.jobs : []);
    } catch {
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 10000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const createJob = async () => {
    if (!newPrompt.trim()) return;
    setCreating(true);
    try {
      await fetch("/api/openclaw/cron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          prompt: newPrompt,
          schedule: newSchedule,
          agentId: newAgent,
          enabled: true,
        }),
      });
      setNewPrompt("");
      setShowCreate(false);
      await fetchJobs();
    } finally {
      setCreating(false);
    }
  };

  const toggleJob = async (id: string, enabled: boolean) => {
    setActionLoading(id);
    try {
      await fetch("/api/openclaw/cron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", id, enabled: !enabled }),
      });
      await fetchJobs();
    } finally {
      setActionLoading(null);
    }
  };

  const runNow = async (id: string) => {
    setActionLoading(id);
    try {
      await fetch("/api/openclaw/cron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run", id, mode: "force" }),
      });
      await fetchJobs();
    } finally {
      setActionLoading(null);
    }
  };

  const removeJob = async (id: string) => {
    setActionLoading(id);
    try {
      await fetch("/api/openclaw/cron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", id }),
      });
      await fetchJobs();
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border bg-card/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{t("cron.title")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("cron.subtitle")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="font-mono">
              {t("cron.activeCount", { count: jobs.filter((j) => j.enabled).length })}
            </Badge>
            <Button onClick={() => setShowCreate(true)} className="gap-1.5">
              <Plus className="w-4 h-4" />
              {t("common.newTask")}
            </Button>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-16">
            <Clock className="w-14 h-14 mx-auto mb-3 text-muted-foreground opacity-30" />
            <p className="text-lg font-medium mb-1">{t("cron.noTasks")}</p>
            <p className="text-sm text-muted-foreground mb-4">
              {t("cron.createFirst")}
            </p>
            <Button onClick={() => setShowCreate(true)} className="gap-1.5">
              <Plus className="w-4 h-4" />
              {t("cron.createTask")}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => {
              const isExpanded = expandedJob === job.id;
              const isLoading = actionLoading === job.id;
              return (
                <div
                  key={job.id}
                  className={`glass-panel rounded-lg overflow-hidden transition-all ${
                    job.enabled
                      ? "border-l-4 border-l-green-500/50"
                      : "border-l-4 border-l-muted/50 opacity-70"
                  }`}
                >
                  <div className="p-4 flex items-center gap-4">
                    {/* Status indicator */}
                    <div
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        job.enabled ? "bg-green-500" : "bg-muted-foreground"
                      }`}
                    />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {job.name || job.payload?.message || job.prompt || t("cron.unnamedTask")}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {scheduleToHuman(job.schedule, locale, t)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Bot className="w-3 h-3" />
                          {job.agentId || "main"}
                        </span>
                        {(job.state?.nextRunAtMs || job.nextRun) && (
                          <span>{t("cron.next")}: {formatRelativeTime((job.state?.nextRunAtMs || job.nextRun)!)}</span>
                        )}
                        {job.state?.lastRunStatus === "error" && (
                          <Badge variant="destructive" className="h-4 px-1 text-[10px] animate-pulse">
                            ERROR
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => runNow(job.id)}
                        disabled={isLoading}
                        className="gap-1 text-xs h-8"
                        title={t("cron.runNowTitle")}
                      >
                        {isLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Play className="w-3.5 h-3.5" />
                        )}
                        {t("cron.runNow")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleJob(job.id, job.enabled)}
                        disabled={isLoading}
                        className="gap-1 text-xs h-8"
                        title={job.enabled ? t("cron.pause") : t("cron.resume")}
                      >
                        {job.enabled ? (
                          <Pause className="w-3.5 h-3.5" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5" />
                        )}
                        {job.enabled ? t("cron.pause") : t("cron.resume")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setExpandedJob(isExpanded ? null : job.id)
                        }
                        className="h-8 w-8 p-0"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0 border-t border-border ml-6">
                      <div className="grid grid-cols-2 gap-3 py-3 text-xs">
                        <div className="col-span-2 bg-muted/30 p-2 rounded border border-border/50 mb-1">
                          <div className="text-muted-foreground mb-1 font-semibold">{t("cron.prompt")}:</div>
                          <div className="font-mono whitespace-pre-wrap break-all opacity-80">
                            {job.payload?.message || job.prompt || t("common.noData")}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t("cron.scheduleLabel")}:</span>{" "}
                          <span className="font-mono">{scheduleToHuman(job.schedule, locale, t)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t("cron.agent")}:</span>{" "}
                          {job.agentId || "main"}
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t("cron.lastRunLabel")}:</span>{" "}
                          {(job.state?.lastRunAtMs || job.lastRun) ? formatRelativeTime((job.state?.lastRunAtMs || job.lastRun)!) : t("cron.never")}
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t("cron.nextRunLabel")}:</span>{" "}
                          {(job.state?.nextRunAtMs || job.nextRun) ? formatRelativeTime((job.state?.nextRunAtMs || job.nextRun)!) : t("cron.never")}
                        </div>
                      </div>
                      
                      {job.state?.lastError && (
                        <div className="mb-3 p-2 bg-red-500/10 border border-red-500/20 rounded text-[11px] text-red-400 font-mono">
                          <div className="font-bold mb-1 uppercase text-[9px] opacity-70">Last Error:</div>
                          {job.state.lastError}
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeJob(job.id)}
                          disabled={isLoading}
                          className="gap-1 text-xs text-red-400 border-red-400/20 hover:bg-red-400/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {t("cron.delete")}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("cron.createDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("cron.createDialogDesc")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Prompt */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                {t("cron.whatShouldDo")}
              </label>
              <textarea
                value={newPrompt}
                onChange={(e) => setNewPrompt(e.target.value)}
                placeholder={t("cron.promptExample")}
                rows={3}
                className="w-full px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>

            {/* Schedule */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                {t("cron.howOften")}
              </label>
              <Select value={newSchedule} onValueChange={setNewSchedule}>
                <SelectTrigger>
                  <SelectValue placeholder={t("cron.chooseSchedule")} />
                </SelectTrigger>
                <SelectContent>
                  {SCHEDULE_PRESETS.map((p) => (
                    <SelectItem key={p.cron} value={p.cron}>
                      {t(p.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Agent */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                {t("cron.whichAgent")}
              </label>
              <input
                type="text"
                value={newAgent}
                onChange={(e) => setNewAgent(e.target.value)}
                placeholder="main"
                className="w-full px-3 py-2 bg-background border border-border rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={createJob}
              disabled={creating || !newPrompt.trim()}
              className="gap-1.5"
            >
              {creating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {t("cron.createTask")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
