// Mirrors the exact mapping from the design prototype's slider (0-100) to a human label,
// so a slider at e.g. 45 always reads "27 min · 11 mi" as specified in the handoff.
export function sliderToMiles(value: number): number {
  return Math.max(1, Math.round((value / 100) * 25));
}

export function sliderToMinutes(value: number): number {
  return Math.max(5, Math.round((value / 100) * 60));
}
