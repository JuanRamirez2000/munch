"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FiltersEditor } from "@/components/FiltersEditor";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Button } from "@/components/ui/Button";
import { createSession } from "@/lib/session/api";
import { defaultFiltersEditorValue, editorValueToFiltersAndWeights } from "@/lib/session/filters-editor";
import { setHostToken } from "@/lib/session/storage";

type LocationState =
  | { mode: "none" }
  | { mode: "resolving" }
  | { mode: "resolved"; lat: number; lng: number; label: string }
  | { mode: "error"; message: string };

export default function CreateSessionPage() {
  const router = useRouter();
  const [location, setLocation] = useState<LocationState>({ mode: "none" });
  const [addressMode, setAddressMode] = useState(false);
  const [addressQuery, setAddressQuery] = useState("");
  const [editorValue, setEditorValue] = useState(defaultFiltersEditorValue);
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

  async function handleCreate() {
    if (location.mode !== "resolved") return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { filters, weights } = editorValueToFiltersAndWeights(editorValue);
      const { session, hostToken } = await createSession({
        originLat: location.lat,
        originLng: location.lng,
        filters,
        weights,
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

        <FiltersEditor value={editorValue} onChange={setEditorValue} />
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
