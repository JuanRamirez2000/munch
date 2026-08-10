"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { PriceControl } from "@/components/ui/PriceControl";
import { RangeSlider } from "@/components/ui/RangeSlider";
import { createSession } from "@/lib/session/api";
import { sliderToMiles, sliderToMinutes } from "@/lib/session/distance";
import { setHostToken } from "@/lib/session/storage";
import { CUISINE_OPTIONS, type CuisineState } from "@/lib/session/types";

type LocationState =
  | { mode: "none" }
  | { mode: "resolving" }
  | { mode: "resolved"; lat: number; lng: number; label: string }
  | { mode: "error"; message: string };

const CUISINE_CYCLE: Record<CuisineState, CuisineState> = {
  none: "include",
  include: "exclude",
  exclude: "none",
};

export default function CreateSessionPage() {
  const router = useRouter();
  const [location, setLocation] = useState<LocationState>({ mode: "none" });
  const [addressMode, setAddressMode] = useState(false);
  const [addressQuery, setAddressQuery] = useState("");
  const [cuisines, setCuisines] = useState<Record<string, CuisineState>>(() =>
    Object.fromEntries(CUISINE_OPTIONS.map((c) => [c, "none" as CuisineState]))
  );
  const [price, setPrice] = useState(1);
  const [distance, setDistance] = useState(45);
  const [distImportance, setDistImportance] = useState(65);
  const [cuisineImportance, setCuisineImportance] = useState(50);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setLocation({ mode: "error", message: "Geolocation isn't available in this browser." });
      return;
    }
    setLocation({ mode: "resolving" });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setAddressMode(false);
        setLocation({
          mode: "resolved",
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          label: "Using your current location",
        });
      },
      () => {
        setLocation({
          mode: "error",
          message: "Couldn't get your location. Try entering an address instead.",
        });
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }

  async function resolveAddress() {
    if (!addressQuery.trim()) return;
    setLocation({ mode: "resolving" });
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(addressQuery)}`);
      const data = await response.json();
      if (!response.ok) {
        setLocation({ mode: "error", message: data.error ?? "Couldn't find that address." });
        return;
      }
      setLocation({ mode: "resolved", lat: data.lat, lng: data.lng, label: data.label });
    } catch {
      setLocation({ mode: "error", message: "Couldn't reach the geocoding service. Try again." });
    }
  }

  function cycleCuisine(name: string) {
    setCuisines((prev) => ({ ...prev, [name]: CUISINE_CYCLE[prev[name]] }));
  }

  async function handleCreate() {
    if (location.mode !== "resolved") return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { session, hostToken } = await createSession({
        originLat: location.lat,
        originLng: location.lng,
        filters: {
          cuisineIncludes: Object.entries(cuisines)
            .filter(([, v]) => v === "include")
            .map(([k]) => k),
          cuisineExcludes: Object.entries(cuisines)
            .filter(([, v]) => v === "exclude")
            .map(([k]) => k),
          price,
          radiusMiles: sliderToMiles(distance),
        },
        weights: { distanceImportance: distImportance, cuisineImportance },
      });
      setHostToken(session.shortCode, hostToken);
      try {
        await fetch(`/api/sessions/${session.id}/build-deck`, { method: "POST" });
      } catch {
        // Deck build failed — share/lobby still work fine; swiping will just see an empty
        // deck until this is retried (no retry UX yet, that lands with the swipe screen).
      }
      router.push(`/s/${session.shortCode}/share`);
    } catch {
      setSubmitError("Couldn't create the session. Please try again.");
      setSubmitting(false);
    }
  }

  const miles = sliderToMiles(distance);
  const minutes = sliderToMinutes(distance);

  return (
    <ScreenContainer>
      <div className="px-6 pb-2 pt-8">
        <h1 className="text-[26px] font-bold text-ink">New session</h1>
      </div>

      <div className="flex flex-1 flex-col gap-[22px] overflow-y-auto px-6 pb-6">
        <div className="flex flex-col gap-2.5">
          <Button onClick={useMyLocation} disabled={location.mode === "resolving"}>
            {location.mode === "resolving" && !addressMode ? "Locating…" : "Use my location"}
          </Button>
          <Button variant="tonal" onClick={() => setAddressMode((v) => !v)} type="button">
            Enter address
          </Button>
          {addressMode && (
            <div className="flex gap-2">
              <input
                value={addressQuery}
                onChange={(e) => setAddressQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && resolveAddress()}
                placeholder="Street, city, zip…"
                className="flex-1 rounded-button bg-surface px-3.5 py-3 text-[14.5px] text-ink shadow-elevation-sm outline-none"
              />
              <button
                type="button"
                onClick={resolveAddress}
                className="rounded-button bg-accent-tint px-4 text-[13px] font-bold text-accent"
              >
                Find
              </button>
            </div>
          )}
          {location.mode === "resolved" && (
            <div className="text-[12.5px] font-medium text-like">✓ {location.label}</div>
          )}
          {location.mode === "error" && (
            <div className="text-[12.5px] font-medium text-pass">{location.message}</div>
          )}
        </div>

        <div className="flex flex-col gap-2.5">
          <div className="text-[13px] font-bold uppercase tracking-[0.04em] text-ink-muted">Cuisines</div>
          <div className="flex flex-wrap gap-2">
            {CUISINE_OPTIONS.map((cuisine) => (
              <Chip key={cuisine} label={cuisine} state={cuisines[cuisine]} onClick={() => cycleCuisine(cuisine)} />
            ))}
          </div>
          <div className="text-[11.5px] text-ink-faint">Tap to include, tap again to exclude</div>
        </div>

        <div className="flex flex-col gap-2.5">
          <div className="text-[13px] font-bold uppercase tracking-[0.04em] text-ink-muted">Price</div>
          <PriceControl value={price} onChange={setPrice} />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex justify-between">
            <span className="text-[13px] font-bold uppercase tracking-[0.04em] text-ink-muted">Distance</span>
            <span className="text-[13px] font-semibold text-accent">
              {minutes} min · {miles} mi
            </span>
          </div>
          <RangeSlider value={distance} onChange={setDistance} />
        </div>

        <div className="flex flex-col gap-3.5 pb-2">
          <div className="text-[13px] leading-snug text-ink-faint">
            Weights nudge places that work well for the whole group toward the top of the deck.
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="text-[14px] font-semibold text-ink">Distance importance</div>
            <RangeSlider value={distImportance} onChange={setDistImportance} />
            <div className="flex justify-between text-[11px] text-ink-faint">
              <span>Low</span>
              <span>High</span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="text-[14px] font-semibold text-ink">Cuisine-match importance</div>
            <RangeSlider value={cuisineImportance} onChange={setCuisineImportance} />
            <div className="flex justify-between text-[11px] text-ink-faint">
              <span>Low</span>
              <span>High</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3.5">
        {submitError && <div className="mb-2 text-[12.5px] font-medium text-pass">{submitError}</div>}
        <Button onClick={handleCreate} disabled={location.mode !== "resolved" || submitting}>
          {submitting ? "Creating…" : "Create session"}
        </Button>
      </div>
    </ScreenContainer>
  );
}
