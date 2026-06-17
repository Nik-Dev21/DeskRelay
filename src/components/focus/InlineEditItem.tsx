"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  value: string;
  onSave: (newValue: string) => void;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
}

export function InlineEditItem({ value, onSave, placeholder, className, multiline }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    else setDraft(value);
    setEditing(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !multiline) { e.preventDefault(); commit(); }
    if (e.key === "Escape") { setDraft(value); setEditing(false); }
  };

  const sharedStyle: React.CSSProperties = {
    background: "var(--surface-2)",
    color: "var(--text)",
    border: "1px solid var(--accent)",
    borderRadius: "6px",
    padding: "4px 8px",
    outline: "none",
    width: "100%",
    resize: multiline ? "vertical" : undefined,
    fontSize: "inherit",
    fontFamily: "inherit",
  };

  if (editing) {
    if (multiline) {
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          rows={3}
          style={sharedStyle}
          className={className}
        />
      );
    }
    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        style={sharedStyle}
        className={className}
      />
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={() => setEditing(true)}
      onKeyDown={(e) => e.key === "Enter" && setEditing(true)}
      title="Click to edit"
      className={`cursor-text hover:underline decoration-dashed underline-offset-2 transition-opacity ${className ?? ""}`}
      style={{ color: "var(--text)" }}
    >
      {value || <span style={{ color: "var(--text-muted)" }}>{placeholder}</span>}
    </span>
  );
}
