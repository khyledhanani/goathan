"use client";

import { useEffect, useState } from "react";

type Choice = "system" | "light" | "dark";

const STORAGE_KEY = "receipts.theme";

function apply(choice: Choice) {
  document.documentElement.dataset.theme = choice;
}

export function ThemeToggle() {
  const [choice, setChoice] = useState<Choice>("light");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let initial: Choice = "light";
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "light" || stored === "dark" || stored === "system")
        initial = stored;
    } catch {
      /* */
    }
    setChoice(initial);
    setHydrated(true);
  }, []);

  const onChoose = (next: Choice) => {
    setChoice(next);
    apply(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* */
    }
  };

  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Theme">
      {(["system", "light", "dark"] as const).map((c) => (
        <button
          key={c}
          role="radio"
          type="button"
          aria-checked={hydrated && choice === c}
          className={`theme-toggle-opt ${hydrated && choice === c ? "active" : ""}`}
          onClick={() => onChoose(c)}
        >
          <span className="theme-toggle-glyph" aria-hidden>
            {c === "system" && <SystemIcon />}
            {c === "light" && <SunIcon />}
            {c === "dark" && <MoonIcon />}
          </span>
          <span className="theme-toggle-label">
            {c === "system" ? "System" : c === "light" ? "Light" : "Dark"}
          </span>
        </button>
      ))}
    </div>
  );
}

function SystemIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect
        x="3.5"
        y="4.5"
        width="17"
        height="13"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M8 20.5h8M12 17.5v3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M20 14.5A8 8 0 019.5 4a1 1 0 00-1.3 1.3A8 8 0 0020 14.5z"
        fill="currentColor"
      />
    </svg>
  );
}
