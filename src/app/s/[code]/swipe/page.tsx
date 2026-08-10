"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { animate, useMotionValue } from "framer-motion";
import { ScreenCenter, ScreenContainer } from "@/components/ScreenContainer";
import { SwipeCard } from "@/components/swipe/SwipeCard";
import { castVote, getLikeCounts, listDeckPlaces, listVotedPlaceIds } from "@/lib/deck/api";
import type { DeckPlace } from "@/lib/deck/types";
import { haversineDistanceMeters, metersToMiles } from "@/lib/geo";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getParticipantByToken, getSessionByShortCode } from "@/lib/session/api";
import { getParticipantToken } from "@/lib/session/storage";
import type { Participant, Session } from "@/lib/session/types";

const FLING_DISTANCE = 460;
const SWIPE_THRESHOLD = 100;
const EASE: [number, number, number, number] = [0.2, 0.8, 0.3, 1];

export default function SwipePage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = params.code.toUpperCase();

  const [session, setSession] = useState<Session | null>(null);
  const [self, setSelf] = useState<Participant | null>(null);
  const [places, setPlaces] = useState<DeckPlace[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreMessage, setLoadMoreMessage] = useState<string | null>(null);

  const x = useMotionValue(0);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const found = await getSessionByShortCode(code);
      if (cancelled || !found) return;

      const token = getParticipantToken(code);
      if (!token) {
        router.replace(`/s/${code}`);
        return;
      }
      const participant = await getParticipantByToken(found.id, token);
      if (cancelled) return;
      if (!participant) {
        router.replace(`/s/${code}`);
        return;
      }

      if (found.status === "lobby") {
        router.replace(`/s/${code}/lobby`);
        return;
      }
      if (found.status === "finished") {
        router.replace(`/s/${code}/results`);
        return;
      }

      const [deck, votedIds, counts] = await Promise.all([
        listDeckPlaces(found.id),
        listVotedPlaceIds(found.id, participant.id),
        getLikeCounts(found.id),
      ]);
      if (cancelled) return;

      const firstUnvoted = deck.findIndex((p) => !votedIds.has(p.id));

      setSession(found);
      setSelf(participant);
      setPlaces(deck);
      setCurrentIndex(firstUnvoted === -1 ? deck.length : firstUnvoted);
      setLikeCounts(counts);
      setLoading(false);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [code, router]);

  // Live leaderboard (other participants' likes) and session-finished redirect.
  useEffect(() => {
    if (!session || !self) return;
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`swipe:${session.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "votes", filter: `session_id=eq.${session.id}` },
        (payload) => {
          const vote = payload.new as { place_id: string; liked: boolean; participant_id: string };
          // Our own votes are already counted optimistically in finalizeVote — counting the
          // realtime echo too would double them.
          if (vote.liked && vote.participant_id !== self.id) {
            setLikeCounts((prev) => ({ ...prev, [vote.place_id]: (prev[vote.place_id] ?? 0) + 1 }));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${session.id}` },
        (payload) => {
          const status = (payload.new as { status: Session["status"] }).status;
          if (status === "finished") router.replace(`/s/${code}/results`);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, self, code, router]);

  const currentPlace = places[currentIndex] ?? null;

  const distanceMiles = useMemo(() => {
    if (!session || !currentPlace) return 0;
    const meters = haversineDistanceMeters(
      { lat: session.originLat, lng: session.originLng },
      { lat: currentPlace.lat, lng: currentPlace.lng }
    );
    return metersToMiles(meters);
  }, [session, currentPlace]);

  const topPlace = useMemo(() => {
    let bestId: string | null = null;
    let bestCount = 0;
    for (const [placeId, count] of Object.entries(likeCounts)) {
      if (count > bestCount) {
        bestCount = count;
        bestId = placeId;
      }
    }
    return bestId ? (places.find((p) => p.id === bestId) ?? null) : null;
  }, [likeCounts, places]);

  function finalizeVote(place: DeckPlace, liked: boolean) {
    if (!session || !self) return;
    if (liked) {
      setLikeCounts((prev) => ({ ...prev, [place.id]: (prev[place.id] ?? 0) + 1 }));
    }
    setCurrentIndex((i) => i + 1);
    x.set(0);
    setVoting(false);

    // Optimistic — UI already advanced; a failed write just means this vote silently doesn't
    // land (no retry UX yet), which is an acceptable v1 gap for a non-critical, idempotent action.
    castVote({ sessionId: session.id, participantId: self.id, placeId: place.id, liked }).catch(() => {});
  }

  function vote(liked: boolean) {
    if (voting || !currentPlace) return;
    setVoting(true);
    animate(x, liked ? FLING_DISTANCE : -FLING_DISTANCE, { duration: 0.3, ease: EASE }).then(() => {
      finalizeVote(currentPlace, liked);
    });
  }

  function handleRelease(offsetX: number) {
    if (voting || !currentPlace) return;
    if (offsetX > SWIPE_THRESHOLD) {
      vote(true);
    } else if (offsetX < -SWIPE_THRESHOLD) {
      vote(false);
    } else {
      animate(x, 0, { duration: 0.38, ease: EASE });
    }
  }

  async function handleLoadMore() {
    if (!session || loadingMore) return;
    setLoadingMore(true);
    setLoadMoreMessage(null);
    try {
      const response = await fetch(`/api/sessions/${session.id}/load-more`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) {
        setLoadMoreMessage("Couldn't load more places. Try again.");
        return;
      }
      if (body.count === 0) {
        setLoadMoreMessage("No more places found nearby.");
        return;
      }
      const deck = await listDeckPlaces(session.id);
      setPlaces(deck);
    } catch {
      setLoadMoreMessage("Couldn't load more places. Try again.");
    } finally {
      setLoadingMore(false);
    }
  }

  if (loading || !session) {
    return (
      <ScreenCenter>
        <span className="text-ink-muted">Loading…</span>
      </ScreenCenter>
    );
  }

  return (
    <ScreenContainer>
      <div className="flex items-center justify-between px-[22px] pb-1 pt-4">
        <div className="text-[18px] font-bold text-ink">Munch</div>
        <div className="text-[13px] font-semibold text-ink-muted">
          {Math.min(currentIndex + 1, places.length)} / {places.length}
        </div>
      </div>

      <div className="px-5 pt-3">
        <button
          type="button"
          onClick={() => router.push(`/s/${code}/results`)}
          className={
            topPlace
              ? "inline-flex items-center gap-2 rounded-full bg-accent-tint px-4 py-2.5 text-[13.5px] font-bold text-accent shadow-elevation-sm active:opacity-80"
              : "inline-flex items-center gap-2 rounded-full bg-surface-alt px-4 py-2.5 text-[13.5px] font-bold text-ink-muted shadow-elevation-sm active:opacity-80"
          }
        >
          {topPlace ? (
            <>
              Top: {topPlace.name} <span className="opacity-70">▲</span>
            </>
          ) : (
            "See leaderboard"
          )}
          <span className="text-[15px] leading-none opacity-60">›</span>
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 px-5 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-4">
        {places.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <div className="text-[19px] font-bold text-ink">No places found</div>
            <div className="text-[14.5px] text-ink-muted">
              The deck didn&apos;t build correctly for this session. Try creating a new one.
            </div>
          </div>
        ) : currentPlace ? (
          <>
            <SwipeCard
              key={currentPlace.id}
              place={currentPlace}
              distanceMiles={distanceMiles}
              x={x}
              active={!voting}
              onRelease={handleRelease}
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => vote(false)}
                disabled={voting}
                className="flex-1 rounded-button bg-pass-tint py-4 text-[16px] font-bold text-pass disabled:opacity-40"
              >
                Pass
              </button>
              <button
                type="button"
                onClick={() => vote(true)}
                disabled={voting}
                className="flex-1 rounded-button bg-like py-4 text-[16px] font-bold text-white shadow-like-glow disabled:opacity-40"
              >
                Like
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <div className="text-[19px] font-bold text-ink">You&apos;re done!</div>
            <div className="text-[14.5px] text-ink-muted">Waiting on the rest of the group…</div>
            {loadMoreMessage && <div className="text-[13px] text-ink-faint">{loadMoreMessage}</div>}
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="mt-2 rounded-button bg-surface-alt px-5 py-3 text-[14px] font-semibold text-ink disabled:opacity-40"
            >
              {loadingMore ? "Loading…" : "Load more places"}
            </button>
          </div>
        )}
      </div>
    </ScreenContainer>
  );
}
