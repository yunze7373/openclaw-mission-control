import { randomUUID } from "crypto";
import { execFile } from "child_process";
import { accessSync, constants } from "fs";
import path from "path";

// --- Types ---

export interface OpenClawAgent {
  id: string;
  name?: string;
  model?: string;
  status?: string;
  sessionKey?: string;
}

export interface OpenClawSession {
  key: string;
  agentId?: string;
  model?: string;
  provider?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  lastActivity?: string;
}

export interface OpenClawCronJob {
  id: string;
  agentId?: string;
  schedule: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  prompt?: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
}

type EventCallback = (data: unknown) => void;

// --- Client ---

export class OpenClawClient {
  private url: string;
  private authToken?: string;
  private origin: string;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connected = false;
  private authenticated = false;

  constructor(url = "ws://127.0.0.1:18789", opts?: { authToken?: string }) {
    this.url = url;
    this.authToken = opts?.authToken;
    this.origin = process.env.MISSION_CONTROL_ORIGIN || "http://127.0.0.1:3000";
  }

  // --- Connection with proper Gateway protocol ---

  async connect(): Promise<void> {
    await this.callOnce("health", {}, 15000);
    this.connected = true;
    this.authenticated = true;
  }

  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.connected = false;
    this.authenticated = false;
  }

  isConnected(): boolean {
    return this.authenticated;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(() => {});
    }, 3000);
  }

  // --- JSON-RPC calls ---

  async call(
    method: string,
    params?: unknown,
    timeoutMs = 30000
  ): Promise<unknown> {
    return this.callOnce(method, params ?? {}, timeoutMs);
  }

  private async callOnce(
    method: string,
    params: unknown,
    timeoutMs: number
  ): Promise<unknown> {
    const helperPath = this.resolveRpcHelperPath();

    return new Promise((resolve, reject) => {
      execFile(process.execPath, [helperPath, method, JSON.stringify(params)], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          OPENCLAW_GATEWAY_URL: this.url,
          OPENCLAW_AUTH_TOKEN: this.authToken ?? "",
          MISSION_CONTROL_ORIGIN: this.origin,
          OPENCLAW_RPC_TIMEOUT_MS: String(timeoutMs),
        },
        timeout: timeoutMs + 2000,
        maxBuffer: 25 * 1024 * 1024,
      }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
          return;
        }

        try {
          this.connected = true;
          this.authenticated = true;
          resolve(stdout ? JSON.parse(stdout) : null);
        } catch (parseError) {
          reject(
            parseError instanceof Error
              ? parseError
              : new Error(String(parseError))
          );
        }
      });
    });
  }

  private resolveRpcHelperPath(): string {
    const candidates = [
      path.resolve(process.cwd(), "scripts/openclaw-rpc.cjs"),
      path.resolve(process.cwd(), "../scripts/openclaw-rpc.cjs"),
      path.resolve(process.cwd(), "../../scripts/openclaw-rpc.cjs"),
    ];

    for (const candidate of candidates) {
      try {
        accessSync(candidate, constants.R_OK);
        return candidate;
      } catch {
        // try next candidate
      }
    }

    throw new Error("openclaw-rpc helper not found");
  }

  // --- Events ---

  onEvent(type: string, callback: EventCallback): () => void {
    void type;
    void callback;
    return () => {};
  }

  // --- Agents ---

  async listAgents(): Promise<OpenClawAgent[]> {
    const result = (await this.call("agents.list", {})) as {
      agents?: OpenClawAgent[];
    };
    return result?.agents ?? [];
  }

  async createAgent(params: {
    name: string;
    workspace: string;
    emoji?: string;
    avatar?: string;
  }): Promise<unknown> {
    return this.call("agents.create", params);
  }

  async updateAgent(params: {
    agentId: string;
    patch: Record<string, unknown>;
  }): Promise<unknown> {
    return this.call("agents.update", params);
  }

  async deleteAgent(agentId: string): Promise<unknown> {
    return this.call("agents.delete", { agentId });
  }

  async getAgentFile(agentId: string, name: string): Promise<string> {
    const result = (await this.call("agents.files.get", {
      agentId,
      name,
    })) as { file?: { content?: string } };
    return result?.file?.content ?? "";
  }

  async setAgentFile(
    agentId: string,
    name: string,
    content: string
  ): Promise<unknown> {
    return this.call("agents.files.set", { agentId, name, content });
  }

  // --- Chat ---

  async sendMessage(
    sessionKey: string,
    message: string,
    opts?: { idempotencyKey?: string }
  ): Promise<unknown> {
    return this.call("chat.send", {
      sessionKey,
      message,
      idempotencyKey: opts?.idempotencyKey ?? randomUUID(),
    });
  }

  async getChatHistory(
    sessionKey: string,
    opts?: { limit?: number }
  ): Promise<ChatMessage[]> {
    const result = (await this.call("chat.history", {
      sessionKey,
      ...opts,
    })) as { messages?: ChatMessage[] };
    return result?.messages ?? [];
  }

  async abortChat(sessionKey: string, runId?: string): Promise<unknown> {
    return this.call("chat.abort", { sessionKey, runId });
  }

  // --- Sessions ---

  async listSessions(opts?: {
    agentId?: string;
  }): Promise<OpenClawSession[]> {
    const result = (await this.call("sessions.list", opts ?? {})) as {
      sessions?: OpenClawSession[];
    };
    return result?.sessions ?? [];
  }

  async previewSessions(keys: string[]): Promise<unknown> {
    return this.call("sessions.preview", { keys });
  }

  async resetSession(key: string): Promise<unknown> {
    return this.call("sessions.reset", { key });
  }

  async deleteSession(key: string): Promise<unknown> {
    return this.call("sessions.delete", { key });
  }

  async patchSession(
    key: string,
    patch: { model?: string | null; [k: string]: unknown }
  ): Promise<unknown> {
    return this.call("sessions.patch", { key, ...patch });
  }

  // --- Cron ---

  async listCronJobs(): Promise<OpenClawCronJob[]> {
    const result = (await this.call("cron.list", {
      includeDisabled: true,
    })) as { jobs?: OpenClawCronJob[] };
    return result?.jobs ?? [];
  }

  async addCronJob(params: {
    prompt: string;
    schedule: string;
    agentId?: string;
    sessionKey?: string;
    enabled?: boolean;
  }): Promise<OpenClawCronJob> {
    return (await this.call("cron.add", params)) as OpenClawCronJob;
  }

  async updateCronJob(
    id: string,
    patch: Partial<{
      prompt: string;
      schedule: string;
      enabled: boolean;
    }>
  ): Promise<OpenClawCronJob> {
    return (await this.call("cron.update", {
      id,
      patch,
    })) as OpenClawCronJob;
  }

  async removeCronJob(id: string): Promise<unknown> {
    return this.call("cron.remove", { id });
  }

  async runCronJob(id: string, mode?: "due" | "force"): Promise<unknown> {
    return this.call("cron.run", { id, mode: mode ?? "force" });
  }

  // --- System ---

  async health(): Promise<unknown> {
    return this.call("health", {});
  }

  async status(): Promise<unknown> {
    return this.call("status", {});
  }

  async getUsage(): Promise<unknown> {
    return this.call("usage.status", {});
  }

  async listModels(): Promise<unknown> {
    return this.call("models.list", {});
  }

  // --- Send to agent session (the `send` method) ---

  async sendToAgent(params: {
    message: string;
    session?: string;
    agentId?: string;
  }): Promise<unknown> {
    return this.call("send", params);
  }

  // --- Usage & Costs ---

  async getUsageCost(): Promise<unknown> {
    return this.call("usage.cost", {});
  }

  // --- TTS ---

  async ttsStatus(): Promise<unknown> {
    return this.call("tts.status", {});
  }

  async ttsProviders(): Promise<unknown> {
    return this.call("tts.providers", {});
  }

  async ttsConvert(params: {
    text: string;
    provider?: string;
  }): Promise<unknown> {
    return this.call("tts.convert", params);
  }

  // --- Config ---

  async configGet(): Promise<unknown> {
    return this.call("config.get", {});
  }

  async configSchema(): Promise<unknown> {
    return this.call("config.schema", {});
  }

  async configPatch(patch: Record<string, unknown>): Promise<unknown> {
    return this.call("config.patch", { patch });
  }

  // --- Exec Approvals ---

  async getExecApprovals(): Promise<unknown> {
    return this.call("exec.approvals.get", {});
  }

  async setExecApprovals(params: Record<string, unknown>): Promise<unknown> {
    return this.call("exec.approvals.set", params);
  }

  async resolveExecApproval(params: {
    id: string;
    decision: "allow-once" | "allow-always" | "deny";
  }): Promise<unknown> {
    return this.call("exec.approval.resolve", params);
  }

  // --- Nodes ---

  async listNodes(): Promise<unknown> {
    return this.call("node.list", {});
  }

  async describeNode(nodeId: string): Promise<unknown> {
    return this.call("node.describe", { nodeId });
  }

  // --- Logs ---

  async tailLogs(): Promise<unknown> {
    return this.call("logs.tail", {});
  }

  // --- Channels ---

  async channelsStatus(): Promise<unknown> {
    return this.call("channels.status", {});
  }

  // --- Skills ---

  async skillsStatus(): Promise<unknown> {
    return this.call("skills.status", {});
  }

  // --- Cron Runs ---

  async cronRuns(id: string): Promise<unknown> {
    return this.call("cron.runs", { id });
  }

  async cronStatus(): Promise<unknown> {
    return this.call("cron.status", {});
  }
}

export function getOpenClawClient(): OpenClawClient {
  const url =
    process.env.OPENCLAW_GATEWAY_URL || "ws://127.0.0.1:18789";
  const authToken = process.env.OPENCLAW_AUTH_TOKEN;
  return new OpenClawClient(url, { authToken });
}
