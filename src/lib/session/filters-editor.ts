import { milesToSlider, sliderToMiles } from "./distance";
import { CUISINE_OPTIONS, type CuisineState, type SessionFilters, type SessionWeights } from "./types";

// The shape the chip/slider UI edits directly — distinct from SessionFilters/SessionWeights
// (the storage shape) because cuisine chips are a 3-state cycle per cuisine, not two arrays,
// and distance is a raw 0-100 slider position, not miles.
export interface FiltersEditorValue {
  cuisines: Record<string, CuisineState>;
  price: number;
  distance: number;
  distImportance: number;
  cuisineImportance: number;
}

export const CUISINE_CYCLE: Record<CuisineState, CuisineState> = {
  none: "include",
  include: "exclude",
  exclude: "none",
};

export function defaultFiltersEditorValue(): FiltersEditorValue {
  return {
    cuisines: Object.fromEntries(CUISINE_OPTIONS.map((c) => [c, "none" as CuisineState])),
    price: 1,
    distance: 45,
    distImportance: 65,
    cuisineImportance: 50,
  };
}

export function filtersAndWeightsToEditorValue(
  filters: SessionFilters,
  weights: SessionWeights
): FiltersEditorValue {
  const cuisines = Object.fromEntries(
    CUISINE_OPTIONS.map((c) => {
      const state: CuisineState = filters.cuisineIncludes.includes(c)
        ? "include"
        : filters.cuisineExcludes.includes(c)
          ? "exclude"
          : "none";
      return [c, state];
    })
  );

  return {
    cuisines,
    price: filters.price,
    distance: milesToSlider(filters.radiusMiles),
    distImportance: weights.distanceImportance,
    cuisineImportance: weights.cuisineImportance,
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
      price: value.price,
      radiusMiles: sliderToMiles(value.distance),
    },
    weights: {
      distanceImportance: value.distImportance,
      cuisineImportance: value.cuisineImportance,
    },
  };
}
