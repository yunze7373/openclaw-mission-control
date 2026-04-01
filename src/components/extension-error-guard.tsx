"use client";

import { useEffect } from "react";

function isKnownExtensionEthereumError(eventLike: unknown): boolean {
  const message =
    eventLike && typeof eventLike === "object" && "message" in eventLike
      ? String((eventLike as { message?: unknown }).message || "")
      : "";
  const filename =
    eventLike && typeof eventLike === "object" && "filename" in eventLike
      ? String((eventLike as { filename?: unknown }).filename || "")
      : "";

  return (
    message.includes("Cannot redefine property: ethereum") &&
    filename.startsWith("chrome-extension://")
  );
}

export function ExtensionErrorGuard() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      if (isKnownExtensionEthereumError(event)) {
        event.preventDefault();
      }
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        reason instanceof Error ? reason.message : String(reason ?? "");
      if (message.includes("Cannot redefine property: ethereum")) {
        event.preventDefault();
      }
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}

