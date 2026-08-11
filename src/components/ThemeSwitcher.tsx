"use client";

import { useState, useSyncExternalStore } from "react";
import { DEFAULT_THEME_ID, THEME_STORAGE_KEY, THEMES } from "@/lib/theme/themes";

const listeners = new Set<() => void>();
let currentTheme = DEFAULT_THEME_ID;

function readStoredTheme(): string {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored && THEMES.some((t) => t.id === stored) ? stored : DEFAULT_THEME_ID;
}

if (typeof window !== "undefined") {
  currentTheme = readStoredTheme();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return currentTheme;
}

function getServerSnapshot() {
  return DEFAULT_THEME_ID;
}

function selectTheme(id: string) {
  currentTheme = id;
  if (id === DEFAULT_THEME_ID) {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", id);
  }
  localStorage.setItem(THEME_STORAGE_KEY, id);
  listeners.forEach((listener) => listener());
}

export function ThemeSwitcher() {
  const [open, setOpen] = useState(false);
  const themeId = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const active = THEMES.find((t) => t.id === themeId) ?? THEMES[0];

  return (
    <div className="fixed right-3 top-[calc(env(safe-area-inset-top)+12px)] z-50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Switch color theme"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 shadow-elevation-md"
        style={{ background: active.bg }}
      >
        <span
          className="block h-4 w-4 rounded-full border border-black/10"
          style={{ background: active.accent }}
        />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-52 rounded-card bg-surface p-2 shadow-elevation-lg">
          <div className="px-1.5 pb-1.5 pt-1 text-[11px] font-bold uppercase tracking-wide text-ink-faint">
            Theme
          </div>
          <div className="flex flex-col gap-0.5">
            {THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => selectTheme(theme.id)}
                className={`flex items-center gap-2.5 rounded-control px-2 py-1.5 text-left text-[13.5px] font-medium ${
                  theme.id === themeId ? "bg-surface-alt text-ink" : "text-ink-muted"
                }`}
              >
                <span
                  className="h-5 w-5 shrink-0 rounded-full border border-black/10"
                  style={{ background: theme.bg }}
                >
                  <span
                    className="block h-full w-full scale-50 rounded-full"
                    style={{ background: theme.accent }}
                  />
                </span>
                {theme.label}
                {theme.id === themeId && <span className="ml-auto text-accent">✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
