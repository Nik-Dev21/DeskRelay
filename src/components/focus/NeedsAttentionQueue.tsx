"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ManagerFocusItem } from "@/types";
import { SignOffButton } from "./SignOffButton";
import { InlineEditItem } from "./InlineEditItem";

async function fetchBlockers(): Promise<ManagerFocusItem[]> {
  const res = await fetch("/api/focus?isBlocker=true&status=PENDING_APPROVAL");
  if (!res.ok) throw new Error("Failed to load blockers");
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

export function NeedsAttentionQueue() {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery({ queryKey: ["focus", "blockers"], queryFn: fetchBlockers });

  const mutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<ManagerFocusItem> }) => patchFocus(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: ["focus", "blockers"] });
      const prev = qc.getQueryData<ManagerFocusItem[]>(["focus", "blockers"]);
      qc.setQueryData<ManagerFocusItem[]>(["focus", "blockers"], (old) =>
        old?.map((item) => (item.id === id ? { ...item, ...patch } : item))
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      qc.setQueryData(["focus", "blockers"], ctx?.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["focus"] }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8" style={{ color: "var(--text-muted)" }}>
        <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} />
        <span className="text-sm">Loading blockers...</span>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-10 text-center" style={{ color: "var(--text-muted)" }}>
        <div className="text-3xl mb-2">✓</div>
        <p className="text-sm">No blockers right now.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="rounded-xl p-4"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--red)",
            opacity: item.isSignedOff ? 0.5 : 1,
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(239,68,68,0.15)", color: "var(--red)" }}>
                  BLOCKER
                </span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {item.teamName} · {item.managerName}
                </span>
              </div>
              <div className="text-sm font-medium">
                <InlineEditItem
                  value={item.checklistItem}
                  onSave={(v) => mutation.mutate({ id: item.id, patch: { checklistItem: v } })}
                  placeholder="Checklist item"
                />
              </div>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                {item.contextSummary}
              </p>
            </div>
            <SignOffButton
              isSignedOff={item.isSignedOff}
              onToggle={(signed) => mutation.mutate({ id: item.id, patch: { isSignedOff: signed } })}
              disabled={mutation.isPending}
            />
          </div>
          {item.targetDate && (
            <p className="text-xs mt-2" style={{ color: "var(--amber)" }}>
              Due {new Date(item.targetDate).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
