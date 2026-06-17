"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { EmployeeActionItem, TaskStatus } from "@/types";
import { InlineEditItem } from "./InlineEditItem";

async function fetchTasks(): Promise<EmployeeActionItem[]> {
  const res = await fetch("/api/tasks");
  if (!res.ok) throw new Error("Failed to load tasks");
  return res.json();
}

async function patchTask(id: string, patch: Partial<EmployeeActionItem>): Promise<EmployeeActionItem> {
  const res = await fetch(`/api/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Update failed");
  return res.json();
}

const PRIORITY_COLORS = { HIGH: "var(--red)", MEDIUM: "var(--amber)", LOW: "var(--green)" };
const STATUS_CYCLE: TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE", "BLOCKED"];

export function EmployeeTaskFeed() {
  const qc = useQueryClient();
  const { data: tasks = [], isLoading } = useQuery({ queryKey: ["tasks"], queryFn: fetchTasks });

  const mutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<EmployeeActionItem> }) => patchTask(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const prev = qc.getQueryData<EmployeeActionItem[]>(["tasks"]);
      qc.setQueryData<EmployeeActionItem[]>(["tasks"], (old) =>
        old?.map((t) => (t.id === id ? { ...t, ...patch } : t))
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => qc.setQueryData(["tasks"], ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const advanceStatus = (task: EmployeeActionItem) => {
    const idx = STATUS_CYCLE.indexOf(task.status);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    mutation.mutate({ id: task.id, patch: { status: next } });
  };

  if (isLoading) {
    return <div className="text-sm py-6" style={{ color: "var(--text-muted)" }}>Loading tasks...</div>;
  }

  if (tasks.length === 0) {
    return <div className="text-sm py-6 text-center" style={{ color: "var(--text-muted)" }}>No employee tasks yet.</div>;
  }

  // Group by assignee
  const byAssignee = new Map<string, EmployeeActionItem[]>();
  for (const t of tasks) {
    if (!byAssignee.has(t.assignedTo)) byAssignee.set(t.assignedTo, []);
    byAssignee.get(t.assignedTo)!.push(t);
  }

  return (
    <div className="flex flex-col gap-5">
      {Array.from(byAssignee.entries()).map(([assignee, assigneeTasks]) => (
        <div key={assignee}>
          <h3 className="text-xs font-semibold mb-2 uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
            {assignee}
          </h3>
          <div className="flex flex-col gap-2">
            {assigneeTasks.map((task) => (
              <div
                key={task.id}
                className="rounded-lg p-3.5 flex items-start gap-3"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  opacity: task.status === "DONE" ? 0.55 : 1,
                }}
              >
                {/* Status cycle button */}
                <button
                  onClick={() => advanceStatus(task)}
                  title="Advance status"
                  className="mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all hover:opacity-80"
                  style={{
                    borderColor: task.status === "DONE" ? "var(--green)" : "var(--border)",
                    background: task.status === "DONE" ? "var(--green)" : "transparent",
                  }}
                >
                  {task.status === "DONE" && (
                    <svg viewBox="0 0 10 10" fill="none" className="w-2.5 h-2.5">
                      <path d="M1.5 5l2.5 2.5 4.5-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold" style={{ color: PRIORITY_COLORS[task.priority] }}>
                      {task.priority}
                    </span>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
                    >
                      {task.status.replace("_", " ")}
                    </span>
                    {task.jiraTicketUrl && (
                      <a
                        href={task.jiraTicketUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs hover:opacity-80"
                        style={{ color: "var(--accent)" }}
                      >
                        Jira
                      </a>
                    )}
                  </div>
                  <div className="text-sm font-medium mt-0.5">
                    <InlineEditItem
                      value={task.taskName}
                      onSave={(v) => mutation.mutate({ id: task.id, patch: { taskName: v } })}
                      placeholder="Task name"
                    />
                  </div>
                  <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--text-muted)" }}>
                    {task.taskDetails}
                  </p>
                  {task.deadline && (
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                      Due {new Date(task.deadline).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
