"use client";

import { useEffect, useState, useCallback } from "react";
import type { ExtractedAction } from "@/types";
import { ActionCard } from "./ActionCard";

export function ApprovalQueue() {
  const [actions, setActions] = useState<ExtractedAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActions = useCallback(async () => {
    try {
      const res = await fetch("/api/actions");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ExtractedAction[];
      setActions(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load actions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActions();
    const interval = setInterval(fetchActions, 8000);
    return () => clearInterval(interval);
  }, [fetchActions]);

  const handleDecision = async (id: string, decision: "approved" | "rejected") => {
    setActions((prev) => prev.filter((a) => a.id !== id));
    try {
      await fetch(`/api/actions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
    } catch (e) {
      console.error("Decision failed:", e);
      fetchActions();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div
          className="w-8 h-8 border-2 rounded-full animate-spin"
          style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-xl p-6 text-center"
        style={{ background: "var(--surface)", border: "1px solid var(--red)" }}
      >
        <p style={{ color: "var(--red)" }} className="text-sm font-medium">
          {error}
        </p>
        <button
          onClick={fetchActions}
          className="mt-3 text-xs px-4 py-1.5 rounded-lg transition-opacity hover:opacity-80"
          style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--text)" }}>
            Pending Actions
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            {actions.length === 0
              ? "All clear — no pending actions"
              : `${actions.length} action${actions.length !== 1 ? "s" : ""} awaiting your approval`}
          </p>
        </div>
        <button
          onClick={fetchActions}
          className="text-xs px-3 py-1.5 rounded-lg transition-opacity hover:opacity-70"
          style={{ background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
        >
          Refresh
        </button>
      </div>

      {actions.length === 0 ? (
        <div
          className="rounded-xl p-12 text-center"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="text-4xl mb-3">✓</div>
          <p className="font-medium" style={{ color: "var(--text)" }}>
            Inbox zero
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            New AI actions will appear here automatically after meetings end.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {actions.map((action) => (
            <ActionCard key={action.id} action={action} onDecision={handleDecision} />
          ))}
        </div>
      )}
    </div>
  );
}
