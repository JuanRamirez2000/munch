import { milesToSlider, sliderToMiles } from "./distance";
import {
  CUISINE_OPTIONS,
  DINING_STYLE_OPTIONS,
  type PreferenceState,
  type SessionFilters,
  type SessionWeights,
} from "./types";

// The shape the chip/slider UI edits directly — distinct from SessionFilters/SessionWeights
// (the storage shape) because cuisine/style chips are a 3-state cycle per option, not arrays,
// and distance is a raw 0-100 slider position, not miles.
export interface FiltersEditorValue {
  cuisines: Record<string, PreferenceState>;
  // Dining-style only ever holds "none" | "include" — see cycleStyle in FiltersEditor.tsx.
  styles: Record<string, PreferenceState>;
  price: number;
  distance: number;
  distImportance: number;
  preferenceImportance: number;
}

export const CUISINE_CYCLE: Record<PreferenceState, PreferenceState> = {
  none: "include",
  include: "exclude",
  exclude: "none",
};

export function defaultFiltersEditorValue(): FiltersEditorValue {
  return {
    cuisines: Object.fromEntries(CUISINE_OPTIONS.map((c) => [c, "none" as PreferenceState])),
    styles: Object.fromEntries(DINING_STYLE_OPTIONS.map((s) => [s, "none" as PreferenceState])),
    price: 1,
    distance: 45,
    distImportance: 65,
    preferenceImportance: 50,
  };
}

export function filtersAndWeightsToEditorValue(
  filters: SessionFilters,
  weights: SessionWeights
): FiltersEditorValue {
  const cuisines = Object.fromEntries(
    CUISINE_OPTIONS.map((c) => {
      const state: PreferenceState = filters.cuisineIncludes.includes(c)
        ? "include"
        : filters.cuisineExcludes.includes(c)
          ? "exclude"
          : "none";
      return [c, state];
    })
  );
  const styles = Object.fromEntries(
    DINING_STYLE_OPTIONS.map((s) => [s, filters.styleIncludes.includes(s) ? "include" : "none"] as const)
  );

  return {
    cuisines,
    styles,
    price: filters.price,
    distance: milesToSlider(filters.radiusMiles),
    distImportance: weights.distanceImportance,
    preferenceImportance: weights.preferenceImportance,
  };
}

export function editorValueToFiltersAndWeights(value: FiltersEditorValue): {
  filters: SessionFilters;
  weights: SessionWeights;
} {
  return {
    filters: {
      cuisineIncludes: Object.entries(value.cuisines)
        .filter(([, v]) => v === "include")
        .map(([k]) => k),
      cuisineExcludes: Object.entries(value.cuisines)
        .filter(([, v]) => v === "exclude")
        .map(([k]) => k),
      styleIncludes: Object.entries(value.styles)
        .filter(([, v]) => v === "include")
        .map(([k]) => k),
      price: value.price,
      radiusMiles: sliderToMiles(value.distance),
    },
    weights: {
      distanceImportance: value.distImportance,
      preferenceImportance: value.preferenceImportance,
    },
  };
}
