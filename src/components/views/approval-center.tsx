"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Shield,
  ShieldCheck,
  ShieldX,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
  Terminal,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLocale } from "@/components/locale-provider";
import { approvalDecisionLabel } from "@/lib/i18n-mappers";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ApprovalRequest {
  id: string;
  command?: string;
  cmd?: string;
  request?: {
    command?: string;
    cwd?: string | null;
    agentId?: string | null;
    sessionKey?: string | null;
  };
  cwd?: string;
  agentId?: string;
  agent?: string;
  sessionKey?: string;
  timestamp?: string;
  createdAt?: string;
  status?: string;
  decision?: string;
}

function getRiskLevel(cmd: string): { level: string; color: string; icon: typeof AlertTriangle } {
  const dangerous = ["rm ", "rm -rf", "drop ", "delete ", "kill ", "sudo ", "chmod ", "mkfs"];
  const moderate = ["npm install", "pip install", "apt ", "brew ", "curl ", "wget ", "git push"];
  const cmdLower = cmd.toLowerCase();
  if (dangerous.some((d) => cmdLower.includes(d))) return { level: "HIGH", color: "text-red-400 bg-red-400/10 border-red-400/20", icon: ShieldX };
  if (moderate.some((m) => cmdLower.includes(m))) return { level: "MEDIUM", color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20", icon: AlertTriangle };
  return { level: "LOW", color: "text-green-400 bg-green-400/10 border-green-400/20", icon: ShieldCheck };
}

export function ApprovalCenter() {
  const { t, formatRelativeTime } = useLocale();
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    id: string;
    decision: "approve" | "reject";
    command: string;
  } | null>(null);
  const [history, setHistory] = useState<ApprovalRequest[]>([]);

  const fetchApprovals = useCallback(async () => {
    try {
      const res = await fetch("/api/openclaw/approvals");
      const data = await res.json();
      const items: ApprovalRequest[] = Array.isArray(data.approvals) ? data.approvals : [];
      // Separate pending from resolved
      const pending = items.filter((a) => !a.decision && a.status !== "resolved");
      const resolved = items.filter((a) => a.decision || a.status === "resolved");
      setApprovals(pending);
      setHistory(resolved);
    } catch {
      setApprovals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApprovals();
    const interval = setInterval(fetchApprovals, 3000);
    return () => clearInterval(interval);
  }, [fetchApprovals]);

  const resolveApproval = async (id: string, decision: "approve" | "reject") => {
    setActionLoading(id);
    try {
      await fetch("/api/openclaw/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, decision }),
      });
      await fetchApprovals();
    } finally {
      setActionLoading(null);
      setConfirmDialog(null);
    }
  };

  const pendingCount = approvals.length;

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border bg-card/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{t("approvals.title")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("approvals.subtitle")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {pendingCount > 0 && (
              <Badge className="gap-1.5 px-3 py-1 bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                <AlertTriangle className="w-3.5 h-3.5" />
                {pendingCount} {t("approvals.pending")}
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={fetchApprovals} className="gap-1.5">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              {t("common.refresh")}
            </Button>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 p-6">
        {/* Pending approvals */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : pendingCount > 0 ? (
          <div className="space-y-4 mb-8">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              {t("approvals.pendingApprovals")}
            </h3>
            {approvals.map((req) => {
              const cmd = req.command || req.cmd || req.request?.command || t("approvals.unknownCommand");
              const risk = getRiskLevel(cmd);
              const RiskIcon = risk.icon;
              return (
                <div
                  key={req.id}
                  className="glass-panel rounded-lg p-5 border-l-4 border-l-yellow-500/50"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <Bot className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">
                        {t("approvals.agent")}: {req.agentId || req.agent || req.request?.agentId || t("approvals.main")}
                      </span>
                      <Badge variant="outline" className={`text-[10px] ${risk.color}`}>
                        <RiskIcon className="w-3 h-3 mr-1" />
                        {risk.level === "HIGH" ? t("approvals.riskHigh") : risk.level === "MEDIUM" ? t("approvals.riskMedium") : t("approvals.riskLow")}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {req.timestamp || req.createdAt
                        ? formatRelativeTime(req.timestamp || req.createdAt!)
                        : t("common.justNow")}
                    </span>
                  </div>

                  {/* Command display */}
                  <div className="mb-3">
                    <span className="text-xs text-muted-foreground block mb-1.5">{t("approvals.command")}:</span>
                    <pre className="bg-muted/50 rounded border border-border px-4 py-3 text-sm font-mono overflow-x-auto">
                      {cmd}
                    </pre>
                  </div>

                  {(req.cwd || req.request?.cwd) && (
                    <div className="mb-4 text-xs text-muted-foreground flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5" />
                      {t("approvals.workingDirectory")}: <span className="font-mono">{req.cwd || req.request?.cwd}</span>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() =>
                        setConfirmDialog({ id: req.id, decision: "approve", command: cmd })
                      }
                      disabled={actionLoading === req.id}
                      className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                    >
                      {actionLoading === req.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      {t("approvals.approve")}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        setConfirmDialog({ id: req.id, decision: "reject", command: cmd })
                      }
                      disabled={actionLoading === req.id}
                      className="gap-1.5 text-red-400 border-red-400/20 hover:bg-red-400/10"
                    >
                      <XCircle className="w-4 h-4" />
                      {t("approvals.reject")}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <ShieldCheck className="w-14 h-14 mx-auto mb-3 text-green-500 opacity-40" />
            <p className="text-lg font-medium mb-1">{t("approvals.allClear")}</p>
            <p className="text-sm text-muted-foreground">
              {t("approvals.noCommands")}
            </p>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">
              {t("approvals.history")}
            </h3>
            <div className="space-y-1.5">
              {history.slice(0, 20).map((req, i) => {
                const cmd = req.command || req.cmd || req.request?.command || t("approvals.unknownCommand");
                const approved = req.decision === "approve" || req.decision === "allow-once" || req.decision === "allow-always";
                return (
                  <div
                    key={req.id || i}
                    className="flex items-center gap-3 px-3 py-2 rounded text-sm hover:bg-accent/50 transition-colors"
                  >
                    {approved ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                    )}
                    <span className="font-mono text-xs truncate flex-1">{cmd}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {req.agentId || req.agent || req.request?.agentId || t("approvals.main")}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {approvalDecisionLabel(req.decision, t)}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {req.timestamp || req.createdAt
                        ? formatRelativeTime(req.timestamp || req.createdAt!)
                        : "-"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </ScrollArea>

      {/* Confirm dialog */}
      <Dialog
        open={!!confirmDialog}
        onOpenChange={() => setConfirmDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDialog?.decision === "approve"
                ? t("approvals.confirmApproveQuestion")
                : t("approvals.confirmRejectQuestion")}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog?.decision === "approve"
                ? t("approvals.confirmApproveDesc")
                : t("approvals.confirmRejectDesc")}
            </DialogDescription>
          </DialogHeader>
          <pre className="bg-muted/50 rounded border border-border px-4 py-3 text-sm font-mono overflow-x-auto">
            {confirmDialog?.command}
          </pre>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() =>
                confirmDialog &&
                resolveApproval(confirmDialog.id, confirmDialog.decision)
              }
              className={
                confirmDialog?.decision === "approve"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-500 hover:bg-red-600"
              }
            >
              {confirmDialog?.decision === "approve" ? t("approvals.yesApprove") : t("approvals.yesReject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
