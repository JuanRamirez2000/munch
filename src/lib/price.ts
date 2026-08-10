// 0 -> "$", 1 -> "$$", 2 -> "$$$", 3 -> "$$$$"
export function priceLevelToLabel(level: number | null): string {
  if (level === null) return "";
  return "$".repeat(Math.max(1, Math.min(4, level + 1)));
}
