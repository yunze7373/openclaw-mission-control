import { NextRequest, NextResponse } from "next/server";
import { getOpenClawClient } from "@/lib/openclaw-client";

export const dynamic = "force-dynamic";

function isApprovalRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && (
    typeof record.command === "string" ||
    typeof record.cmd === "string" ||
    typeof record.request === "object"
  );
}

function normalizeApprovalsPayload(payload: unknown) {
  if (Array.isArray(payload)) {
    return payload.filter(isApprovalRecord);
  }
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const record = payload as Record<string, unknown>;

  // `exec.approvals.get` returns the exec approval configuration snapshot,
  // not pending approval requests. Treat that as "no queue data" instead of
  // rendering `path/hash/file` as fake approval rows.
  if (
    typeof record.path === "string" &&
    typeof record.exists === "boolean" &&
    typeof record.hash === "string" &&
    typeof record.file === "object"
  ) {
    return [];
  }

  return Object.values(record).filter(isApprovalRecord);
}

export async function GET() {
  try {
    const client = getOpenClawClient();
    await client.connect();
    const approvals = await client.getExecApprovals();
    const pending = normalizeApprovalsPayload(approvals);
    return NextResponse.json({ approvals: pending });
  } catch (error) {
    return NextResponse.json(
      { error: String(error), approvals: [] },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, decision } = body;

    if (!id || !decision) {
      return NextResponse.json(
        { error: "Missing id or decision" },
        { status: 400 }
      );
    }

    const gatewayDecision =
      decision === "approve"
        ? "allow-once"
        : decision === "reject"
          ? "deny"
          : decision;

    const client = getOpenClawClient();
    await client.connect();
    const result = await client.resolveExecApproval({ id, decision: gatewayDecision });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
