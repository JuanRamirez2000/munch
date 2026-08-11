"use client";

import { useState } from "react";
import { motion, useTransform, type MotionValue, type PanInfo } from "framer-motion";
import { PlacePhotoPlaceholder } from "@/components/PlacePhotoPlaceholder";
import { priceLevelToLabel } from "@/lib/price";
import type { DeckPlace } from "@/lib/deck/types";

interface SwipeCardProps {
  place: DeckPlace;
  distanceMiles: number;
  x: MotionValue<number>;
  active: boolean;
  onRelease: (offsetX: number) => void;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function formatRatingCount(count: number | null): string {
  if (count === null) return "";
  const compact = count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count);
  return ` (${compact})`;
}

// Parent (swipe/page.tsx) mounts this with key={place.id}, so photoIndex resets to 0 whenever
// the card underneath changes rather than carrying over a stale index from the previous place.
export function SwipeCard({ place, distanceMiles, x, active, onRelease }: SwipeCardProps) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const rotate = useTransform(x, (v) => v / 16);
  const likeOpacity = useTransform(x, (v) => clamp01(v / 100));
  const passOpacity = useTransform(x, (v) => clamp01(-v / 100));

  function handleDragEnd(_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    onRelease(info.offset.x);
  }

  function cyclePhoto() {
    setPhotoIndex((i) => (i + 1) % place.photoUrls.length);
  }

  return (
    <>
      <motion.div
        drag={active ? "x" : false}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        style={{ x, rotate }}
        className="relative min-h-0 flex-1 touch-pan-y overflow-hidden rounded-hero shadow-elevation-md"
      >
        {place.photoUrls[photoIndex] ? (
          // eslint-disable-next-line @next/next/no-img-element -- provider photo, arbitrary remote URL
          <img
            src={place.photoUrls[photoIndex]}
            alt={place.name}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <PlacePhotoPlaceholder className="absolute inset-0" />
        )}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to bottom, transparent 45%, rgba(20,14,10,.78) 100%)" }}
        />

        <div className="absolute left-4 top-4 flex flex-wrap gap-1.5">
          {place.cuisines[0] && (
            <span className="rounded-full bg-white/90 px-2.5 py-1 text-[12px] font-semibold text-[#201c40]">
              {place.cuisines[0]}
            </span>
          )}
          {place.priceLevel !== null && (
            <span className="rounded-full bg-white/90 px-2.5 py-1 text-[12px] font-semibold text-[#201c40]">
              {priceLevelToLabel(place.priceLevel)}
            </span>
          )}
          {place.openNow && (
            <span className="rounded-full bg-[rgba(229,243,231,.95)] px-2.5 py-1 text-[12px] font-semibold text-[#1e9a5a]">
              Open now
            </span>
          )}
        </div>

        <motion.div
          style={{ opacity: likeOpacity }}
          className="absolute right-4 top-4 -rotate-[10deg] rounded-md border-[2.5px] border-[#1e9a5a] bg-white/90 px-2.5 py-1 text-[15px] font-bold text-[#1e9a5a]"
        >
          LIKE
        </motion.div>
        <motion.div
          style={{ opacity: passOpacity }}
          className="absolute right-4 top-4 rotate-[10deg] rounded-md border-[2.5px] border-[#c0433a] bg-white/90 px-2.5 py-1 text-[15px] font-bold text-[#c0433a]"
        >
          PASS
        </motion.div>

        <div className="absolute inset-x-0 bottom-0 p-5 text-white">
          <div className="text-[22px] font-bold">{place.name}</div>
          <div className="mt-1 text-[14px] opacity-90">
            {place.rating !== null ? `★${place.rating.toFixed(1)}${formatRatingCount(place.ratingCount)} · ` : ""}
            {distanceMiles.toFixed(1)} mi
          </div>
        </div>
      </motion.div>

      {place.photoUrls.length > 1 && (
        <button
          type="button"
          onClick={cyclePhoto}
          aria-label={`Show next photo (${photoIndex + 1} of ${place.photoUrls.length})`}
          className="flex shrink-0 items-center justify-center gap-1.5 self-center rounded-full bg-surface-alt px-3.5 py-2.5 shadow-elevation-sm active:opacity-80"
        >
          {place.photoUrls.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === photoIndex ? "w-4 bg-accent" : "w-1.5 bg-ink-faint"
              }`}
            />
          ))}
        </button>
      )}
    </>
  );
}
