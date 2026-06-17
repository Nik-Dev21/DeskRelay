"use client";

import type { CalendarSlot } from "@/types";

interface Props {
  slots: CalendarSlot[];
  selected?: string;
  onSelect: (isoDate: string) => void;
}

export function TimeSlotPicker({ slots, selected, onSelect }: Props) {
  const available = slots.filter((s) => s.isAvailable);

  if (available.length === 0) {
    return (
      <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
        No available slots found in the suggested window.
      </p>
    );
  }

  return (
    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
      {available.map((slot) => {
        const isSelected = selected === slot.start;
        return (
          <button
            key={slot.start}
            onClick={() => onSelect(slot.start)}
            className="text-left px-3 py-2.5 rounded-lg text-xs transition-all hover:opacity-80"
            style={{
              background: isSelected ? "var(--accent)" : "var(--surface-2)",
              color: isSelected ? "#fff" : "var(--text)",
              border: `1px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
            }}
          >
            <div className="font-medium">
              {new Date(slot.start).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
            </div>
            <div className="mt-0.5" style={{ color: isSelected ? "rgba(255,255,255,0.8)" : "var(--text-muted)" }}>
              {new Date(slot.start).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
              {" – "}
              {new Date(slot.end).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
            </div>
          </button>
        );
      })}
    </div>
  );
}
