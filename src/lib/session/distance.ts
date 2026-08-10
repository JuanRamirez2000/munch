// Mirrors the exact mapping from the design prototype's slider (0-100) to a human label,
// so a slider at e.g. 45 always reads "27 min · 11 mi" as specified in the handoff.
export function sliderToMiles(value: number): number {
  return Math.max(1, Math.round((value / 100) * 25));
}

export function sliderToMinutes(value: number): number {
  return Math.max(5, Math.round((value / 100) * 60));
}

// Approximate inverse of sliderToMiles, for re-opening the editor against a stored radius —
// rounding means this won't always land on the exact original slider position, which is fine
// since the display (miles/minutes) is what matters, not pixel-perfect slider recall.
export function milesToSlider(miles: number): number {
  return Math.max(0, Math.min(100, Math.round((miles / 25) * 100)));
}
