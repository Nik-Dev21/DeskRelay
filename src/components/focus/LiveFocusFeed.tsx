"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ManagerFocusItem } from "@/types";
import { SignOffButton } from "./SignOffButton";
import { InlineEditItem } from "./InlineEditItem";

async function fetchAllFocus(): Promise<ManagerFocusItem[]> {
  const res = await fetch("/api/focus");
  if (!res.ok) throw new Error("Failed to load focus items");
  return res.json();
}

async function patchFocus(id: string, patch: Partial<ManagerFocusItem>): Promise<ManagerFocusItem> {
  const res = await fetch(`/api/focus/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Update failed");
  return res.json();
}

const STATUS_COLORS: Record<ManagerFocusItem["status"], string> = {
  PENDING_APPROVAL: "var(--amber)",
  IN_REVIEW: "var(--accent)",
  SIGNED_OFF: "var(--green)",
  DEFERRED: "var(--text-muted)",
};

export function LiveFocusFeed() {
  const qc = useQueryClient();
  const [activeTeam, setActiveTeam] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["focus", "all"],
    queryFn: fetchAllFocus,
  });

  const mutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<ManagerFocusItem> }) => patchFocus(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: ["focus", "all"] });
      const prev = qc.getQueryData<ManagerFocusItem[]>(["focus", "all"]);
      qc.setQueryData<ManagerFocusItem[]>(["focus", "all"], (old) =>
        old?.map((item) => (item.id === id ? { ...item, ...patch } : item))
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => qc.setQueryData(["focus", "all"], ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ["focus"] }),
  });

  // Group by team
  const teamMap = new Map<string, ManagerFocusItem[]>();
  for (const item of items) {
    const team = item.teamName || "General";
    if (!teamMap.has(team)) teamMap.set(team, []);
    teamMap.get(team)!.push(item);
  }
  const teams = Array.from(teamMap.keys()).sort();

  if (isLoading) {
    return <div className="text-sm py-6" style={{ color: "var(--text-muted)" }}>Loading teams...</div>;
  }

  if (teams.length === 0) {
    return <div className="text-sm py-6 text-center" style={{ color: "var(--text-muted)" }}>No items yet — process a meeting to see team focus items.</div>;
  }

  const visibleTeam = activeTeam ?? teams[0];
  const visibleItems = teamMap.get(visibleTeam) ?? [];

  return (
    <div>
      {/* Team tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {teams.map((team) => {
          const teamItems = teamMap.get(team) ?? [];
          const manager = teamItems[0]?.managerName ?? "";
          const pending = teamItems.filter((i) => !i.isSignedOff).length;
          const isActive = team === visibleTeam;
          return (
            <button
              key={team}
              onClick={() => setActiveTeam(team)}
              className="text-left px-3 py-2 rounded-lg text-xs transition-all hover:opacity-80"
              style={{
                background: isActive ? "var(--accent)" : "var(--surface-2)",
                color: isActive ? "#fff" : "var(--text-muted)",
                border: `1px solid ${isActive ? "var(--accent)" : "var(--border)"}`,
              }}
            >
              <div className="font-semibold">{team}</div>
              <div style={{ color: isActive ? "rgba(255,255,255,0.7)" : "var(--text-muted)", fontSize: "10px" }}>
                Manager: {manager} · {pending} open
              </div>
            </button>
          );
        })}
      </div>

      {/* Item list for active team */}
      <div className="flex flex-col gap-2">
        {visibleItems.map((item) => (
          <div
            key={item.id}
            className="rounded-lg p-3.5"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              opacity: item.isSignedOff ? 0.6 : 1,
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{
                      background: `${STATUS_COLORS[item.status]}22`,
                      color: STATUS_COLORS[item.status],
                    }}
                  >
                    {item.status.replace("_", " ")}
                  </span>
                  {item.isBlocker && (
                    <span className="text-xs font-semibold" style={{ color: "var(--red)" }}>
                      BLOCKER
                    </span>
                  )}
                </div>
                <div className="text-sm font-medium">
                  <InlineEditItem
                    value={item.checklistItem}
                    onSave={(v) => mutation.mutate({ id: item.id, patch: { checklistItem: v } })}
                    placeholder="Checklist item"
                  />
                </div>
                <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--text-muted)" }}>
                  <InlineEditItem
                    value={item.contextSummary}
                    multiline
                    onSave={(v) => mutation.mutate({ id: item.id, patch: { contextSummary: v } })}
                    placeholder="Add context..."
                  />
                </p>
                {item.targetDate && (
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    Due {new Date(item.targetDate).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                  </p>
                )}
              </div>
              <SignOffButton
                isSignedOff={item.isSignedOff}
                onToggle={(signed) => mutation.mutate({ id: item.id, patch: { isSignedOff: signed } })}
                disabled={mutation.isPending}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
