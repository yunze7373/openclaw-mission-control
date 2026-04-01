#!/usr/bin/env node
"use strict";

const { randomUUID } = require("crypto");
const WebSocket = require("ws");

const method = process.argv[2];
const rawParams = process.argv[3] ?? "{}";

if (!method) {
  console.error("Missing method");
  process.exit(2);
}

const params = JSON.parse(rawParams);
const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL || "ws://127.0.0.1:18789";
const authToken = process.env.OPENCLAW_AUTH_TOKEN || "";
const origin =
  process.env.MISSION_CONTROL_ORIGIN ||
  `http://127.0.0.1:${process.env.PORT || "3000"}`;
const instanceId =
  process.env.MISSION_CONTROL_INSTANCE_ID || "mission-control-dashboard";
const timeoutMs = Number(process.env.OPENCLAW_RPC_TIMEOUT_MS || "30000");

function callOnce() {
  return new Promise((resolve, reject) => {
    let settled = false;
    let connectRequestId = null;
    let rpcRequestId = null;

    const ws = new WebSocket(gatewayUrl, {
      maxPayload: 25 * 1024 * 1024,
      origin,
    });

    const timeout = setTimeout(() => {
      finish(() => reject(new Error(`RPC timeout: ${method}`)));
    }, timeoutMs);

    function finish(fn) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try {
        ws.close();
      } catch {}
      fn();
    }

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === "event" && msg.event === "connect.challenge") {
          connectRequestId = randomUUID();
          ws.send(
            JSON.stringify({
              type: "req",
              id: connectRequestId,
              method: "connect",
              params: {
                minProtocol: 3,
                maxProtocol: 3,
                client: {
                  id: "openclaw-control-ui",
                  displayName: "Mission Control Dashboard",
                  version: "1.0.0",
                  platform: "node",
                  mode: "ui",
                  instanceId,
                },
                caps: [],
                auth: authToken ? { token: authToken } : undefined,
                role: "operator",
                scopes: [
                  "operator.admin",
                  "operator.read",
                  "operator.approvals",
                  "operator.pairing",
                ],
              },
            })
          );
          return;
        }

        if (msg.type === "res" && msg.id === connectRequestId) {
          if (!msg.ok) {
            finish(() =>
              reject(
                new Error(msg.error?.message || "Gateway connect failed")
              )
            );
            return;
          }

          rpcRequestId = randomUUID();
          ws.send(
            JSON.stringify({
              type: "req",
              id: rpcRequestId,
              method,
              params,
            })
          );
          return;
        }

        if (msg.type === "res" && msg.id === rpcRequestId) {
          if (msg.ok) {
            finish(() => resolve(msg.payload));
          } else {
            finish(() =>
              reject(new Error(msg.error?.message || `RPC failed: ${method}`))
            );
          }
        }
      } catch {}
    });

    ws.on("error", (err) => {
      finish(() => reject(err));
    });

    ws.on("close", (code, reason) => {
      if (!settled && !rpcRequestId) {
        finish(() =>
          reject(
            new Error(
              `Gateway connection closed before handshake (${code}): ${reason.toString()}`
            )
          )
        );
      }
    });
  });
}

callOnce()
  .then((payload) => {
    process.stdout.write(JSON.stringify(payload));
  })
  .catch((err) => {
    process.stderr.write(String(err));
    process.exit(1);
  });
