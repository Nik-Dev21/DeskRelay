"use client";

import { useState } from "react";
import type { ExtractedAction } from "@/types";
import { TimeSlotPicker } from "./TimeSlotPicker";

interface Props {
  action: ExtractedAction;
  onDecision: (id: string, decision: "approved" | "rejected") => void;
}

const INTENT_LABELS: Record<ExtractedAction["intent"], string> = {
  BOOK_MEETING: "Book Meeting",
  SEND_EMAIL: "Send Email",
  CREATE_TASK: "Create Task",
  UPLOAD_NOTES: "Upload Notes",
  SET_REMINDER: "Set Reminder",
};

const INTENT_ICONS: Record<ExtractedAction["intent"], string> = {
  BOOK_MEETING: "📅",
  SEND_EMAIL: "✉️",
  CREATE_TASK: "✅",
  UPLOAD_NOTES: "📎",
  SET_REMINDER: "⏰",
};

const PRIORITY_COLORS = {
  high: "var(--red)",
  medium: "var(--amber)",
  low: "var(--text-muted)",
};

export function ActionCard({ action, onDecision }: Props) {
  const [showSlots, setShowSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | undefined>(action.inferredDate);
  const [deciding, setDeciding] = useState(false);

  const hasConflict = (action.conflictsWith?.length ?? 0) > 0;

  const handleDecision = async (decision: "approved" | "rejected") => {
    setDeciding(true);
    onDecision(action.id, decision);
  };

  return (
    <div
      className="rounded-xl p-5 transition-all"
      style={{
        background: "var(--surface)",
        border: `1px solid ${hasConflict ? "var(--amber)" : "var(--border)"}`,
      }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl flex-shrink-0">{INTENT_ICONS[action.intent]}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "var(--surface-2)", color: "var(--accent)" }}
              >
                {INTENT_LABELS[action.intent]}
              </span>
              {action.priority && (
                <span
                  className="text-xs font-medium"
                  style={{ color: PRIORITY_COLORS[action.priority] }}
                >
                  {action.priority.toUpperCase()}
                </span>
              )}
              {hasConflict && (
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(245,158,11,0.15)", color: "var(--amber)" }}
                >
                  CONFLICT
                </span>
              )}
            </div>
            <p className="text-sm font-medium mt-1 truncate" style={{ color: "var(--text)" }}>
              {action.subject ?? action.taskDescription ?? action.intent}
            </p>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="mt-3 space-y-1.5 text-sm" style={{ color: "var(--text-muted)" }}>
        {action.attendees.length > 0 && (
          <p>
            <span className="font-medium" style={{ color: "var(--text)" }}>With:</span>{" "}
            {action.attendees.join(", ")}
          </p>
        )}
        {selectedSlot && (
          <p>
            <span className="font-medium" style={{ color: "var(--text)" }}>When:</span>{" "}
            {new Date(selectedSlot).toLocaleString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {action.durationMinutes && ` (${action.durationMinutes} min)`}
          </p>
        )}
        {action.location && (
          <p>
            <span className="font-medium" style={{ color: "var(--text)" }}>Location:</span>{" "}
            {action.location}
          </p>
        )}
        {action.body && (
          <p className="line-clamp-2 text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            {action.body}
          </p>
        )}
      </div>

      {/* Transcript quote */}
      {action.rawTranscriptRef && (
        <blockquote
          className="mt-3 text-xs italic px-3 py-2 rounded-lg border-l-2"
          style={{
            borderColor: "var(--accent)",
            background: "var(--surface-2)",
            color: "var(--text-muted)",
          }}
        >
          &ldquo;{action.rawTranscriptRef}&rdquo;
        </blockquote>
      )}

      {/* Conflict resolution */}
      {hasConflict && (
        <div className="mt-4">
          <p className="text-xs font-medium mb-2" style={{ color: "var(--amber)" }}>
            Conflicts with: {action.conflictsWith!.map((c) => c.conflictTitle).join(", ")}
          </p>
          <button
            onClick={() => setShowSlots(!showSlots)}
            className="text-xs px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
            style={{ background: "var(--surface-2)", color: "var(--accent)", border: "1px solid var(--border)" }}
          >
            {showSlots ? "Hide" : "Show"} alternative slots
          </button>
          {showSlots && action.suggestedAlternatives && (
            <TimeSlotPicker
              slots={action.suggestedAlternatives}
              selected={selectedSlot}
              onSelect={setSelectedSlot}
            />
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 mt-4">
        <button
          disabled={deciding}
          onClick={() => handleDecision("approved")}
          className="flex-1 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
          style={{ background: "var(--green)", color: "#fff" }}
        >
          Approve & Send
        </button>
        <button
          disabled={deciding}
          onClick={() => handleDecision("rejected")}
          className="px-5 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
          style={{ background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
