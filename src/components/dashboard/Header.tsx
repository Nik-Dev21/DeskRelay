"use client";

export function Header() {
  return (
    <header
      style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
      className="px-6 py-4 flex items-center justify-between"
    >
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
          style={{ background: "var(--accent)" }}
        >
          W
        </div>
        <span className="font-semibold text-base" style={{ color: "var(--text)" }}>
          WorkBoard
        </span>
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
        >
          AI Meeting Assistant
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          Live
        </span>
      </div>
    </header>
  );
}
