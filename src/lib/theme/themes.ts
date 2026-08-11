export interface ThemeOption {
  id: string;
  label: string;
  bg: string;
  accent: string;
}

// Keep swatch hexes in sync with the `[data-theme]` blocks in globals.css —
// "terracotta" has no data-theme attribute, it's just the :root default.
export const THEMES: ThemeOption[] = [
  { id: "terracotta", label: "Terracotta", bg: "#f6f3ee", accent: "#c1602a" },
  { id: "midnight", label: "Midnight", bg: "#14161c", accent: "#e8a33d" },
  { id: "ocean", label: "Ocean", bg: "#eef5f7", accent: "#1478a3" },
  { id: "forest", label: "Forest", bg: "#f2f5ec", accent: "#4c7a34" },
  { id: "grape", label: "Grape", bg: "#f5f1f9", accent: "#7c3fae" },
  { id: "sunset", label: "Sunset", bg: "#fdf1f2", accent: "#e0447e" },
  { id: "slate", label: "Slate", bg: "#f4f5f7", accent: "#3355d8" },
  { id: "citrus", label: "Citrus", bg: "#fdf8ec", accent: "#d99a12" },
];

export const DEFAULT_THEME_ID = THEMES[0].id;
export const THEME_STORAGE_KEY = "munch-theme";
