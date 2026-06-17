"use client";

import { useState } from "react";

interface Props {
  isSignedOff: boolean;
  onToggle: (signed: boolean) => void;
  disabled?: boolean;
}

export function SignOffButton({ isSignedOff, onToggle, disabled }: Props) {
  const [animating, setAnimating] = useState(false);

  const handleClick = () => {
    if (disabled) return;
    setAnimating(true);
    onToggle(!isSignedOff);
    setTimeout(() => setAnimating(false), 600);
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      title={isSignedOff ? "Revoke sign-off" : "Sign off on this item"}
      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
      style={{
        background: isSignedOff ? "rgba(34,197,94,0.15)" : "var(--surface-2)",
        color: isSignedOff ? "var(--green)" : "var(--text-muted)",
        border: `1px solid ${isSignedOff ? "var(--green)" : "var(--border)"}`,
        transform: animating ? "scale(0.96)" : "scale(1)",
      }}
    >
      <span
        className="w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all"
        style={{
          borderColor: isSignedOff ? "var(--green)" : "var(--text-muted)",
          background: isSignedOff ? "var(--green)" : "transparent",
        }}
      >
        {isSignedOff && (
          <svg viewBox="0 0 12 12" fill="none" className="w-2.5 h-2.5">
            <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      {isSignedOff ? "Signed Off" : "Sign Off"}
    </button>
  );
}
