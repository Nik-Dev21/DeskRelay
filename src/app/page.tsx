"use client";

import { useState } from "react";
import { Header } from "@/components/dashboard/Header";
import { ApprovalQueue } from "@/components/dashboard/ApprovalQueue";
import { FocusDashboard } from "@/components/focus/FocusDashboard";

type View = "approvals" | "focus";

export default function DashboardPage() {
  const [view, setView] = useState<View>("approvals");

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      {/* View switcher */}
      <div style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
        <div className="max-w-5xl mx-auto px-4 flex gap-6">
          {(["approvals", "focus"] as View[]).map((v) => {
            const label = v === "approvals" ? "Action Approvals" : "Executive Focus";
            return (
              <button
                key={v}
                onClick={() => setView(v)}
                className="py-3 text-sm font-medium border-b-2 transition-colors"
                style={{
                  borderColor: view === v ? "var(--accent)" : "transparent",
                  color: view === v ? "var(--accent)" : "var(--text-muted)",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        {view === "approvals" ? <ApprovalQueue /> : <FocusDashboard />}
      </main>
    </div>
  );
}
