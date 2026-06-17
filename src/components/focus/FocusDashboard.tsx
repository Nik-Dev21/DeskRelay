"use client";

import { useState } from "react";
import { NeedsAttentionQueue } from "./NeedsAttentionQueue";
import { LiveFocusFeed } from "./LiveFocusFeed";
import { EmployeeTaskFeed } from "./EmployeeTaskFeed";

type Tab = "attention" | "feed" | "tasks";

const TABS: { id: Tab; label: string; description: string }[] = [
  { id: "attention", label: "Needs Attention", description: "Blockers requiring sign-off" },
  { id: "feed", label: "Live Focus Feed", description: "Team milestones by manager" },
  { id: "tasks", label: "Employee Tasks", description: "Granular execution queue" },
];

export function FocusDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("attention");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: "var(--text)" }}>
          Executive Focus Layer
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
          Strategic oversight extracted from every meeting — sign-offs, team milestones, and direct task assignments.
        </p>
      </div>

      {/* Tab bar */}
      <div
        className="flex gap-1 p-1 rounded-xl mb-6"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all text-left"
              style={{
                background: isActive ? "var(--surface-2)" : "transparent",
                color: isActive ? "var(--text)" : "var(--text-muted)",
                border: isActive ? "1px solid var(--border)" : "1px solid transparent",
              }}
            >
              <div className="font-semibold text-sm">{tab.label}</div>
              <div className="text-xs hidden sm:block" style={{ color: "var(--text-muted)", opacity: 0.8 }}>
                {tab.description}
              </div>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "attention" && <NeedsAttentionQueue />}
      {activeTab === "feed" && <LiveFocusFeed />}
      {activeTab === "tasks" && <EmployeeTaskFeed />}
    </div>
  );
}
