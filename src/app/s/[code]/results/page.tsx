"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ScreenCenter, ScreenContainer } from "@/components/ScreenContainer";
import { PlacePhotoPlaceholder } from "@/components/PlacePhotoPlaceholder";
import { getLikeCounts, getTotalVoteCount, listDeckPlaces } from "@/lib/deck/api";
import type { DeckPlace } from "@/lib/deck/types";
import { getDirectionsUrl } from "@/lib/directions";
import { getParticipantByToken, getSessionByShortCode, listParticipants } from "@/lib/session/api";
import { getParticipantToken } from "@/lib/session/storage";
import type { Session } from "@/lib/session/types";

interface LeaderboardEntry {
  place: DeckPlace;
  likeCount: number;
}

export default function ResultsPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = params.code.toUpperCase();

  const [session, setSession] = useState<Session | null>(null);
  const [places, setPlaces] = useState<DeckPlace[]>([]);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [totalVotes, setTotalVotes] = useState(0);
  const [participantCount, setParticipantCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [extending, setExtending] = useState(false);
  const [extendMessage, setExtendMessage] = useState<string | null>(null);

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

      // Nothing to show before swiping opens — results is reachable at any point during
      // (or after) swiping, but not from the lobby.
      if (found.status === "lobby") {
        router.replace(`/s/${code}/lobby`);
        return;
      }

      const [deck, counts, votes, participants] = await Promise.all([
        listDeckPlaces(found.id),
        getLikeCounts(found.id),
        getTotalVoteCount(found.id),
        listParticipants(found.id),
      ]);
      if (cancelled) return;

      setSession(found);
      setPlaces(deck);
      setLikeCounts(counts);
      setTotalVotes(votes);
      setParticipantCount(participants.length);
      setLoading(false);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [code, router]);

  const leaderboard = useMemo<LeaderboardEntry[]>(() => {
    return places
      .map((place) => ({ place, likeCount: likeCounts[place.id] ?? 0 }))
      .filter((entry) => entry.likeCount > 0)
      .sort((a, b) => b.likeCount - a.likeCount || b.place.score - a.place.score);
  }, [places, likeCounts]);

  const top = leaderboard[0] ?? null;
  const rest = leaderboard.slice(1);
  const unanimous = top !== null && participantCount > 1 && top.likeCount === participantCount;

  async function handleExtendSearch() {
    if (!session) return;
    setExtending(true);
    setExtendMessage(null);
    try {
      const response = await fetch(`/api/sessions/${session.id}/load-more`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) {
        setExtendMessage("Couldn't extend the search. Try again.");
        setExtending(false);
        return;
      }
      if (body.count === 0) {
        setExtendMessage("No more places found nearby.");
        setExtending(false);
        return;
      }
      router.push(`/s/${code}/swipe`);
    } catch {
      setExtendMessage("Couldn't extend the search. Try again.");
      setExtending(false);
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
      <div className="px-6 pb-1 pt-8">
        <h1 className="text-[26px] font-bold text-ink">Results</h1>
        <div className="mt-0.5 text-[13.5px] text-ink-muted">{totalVotes} votes so far</div>
      </div>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-4">
        {!top ? (
          <div className="flex flex-1 items-center justify-center text-center text-[14.5px] text-ink-muted">
            — no likes yet —
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-card shadow-elevation-md">
              <div className="h-[170px]">
                {top.place.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- provider photo, arbitrary remote URL
                  <img src={top.place.photoUrl} alt={top.place.name} className="h-full w-full object-cover" />
                ) : (
                  <PlacePhotoPlaceholder className="h-full" />
                )}
              </div>
              <div className="flex flex-col gap-2 bg-surface p-4">
                <span className="self-start rounded-full bg-accent-tint px-2.5 py-1 text-[11.5px] font-bold text-accent">
                  {unanimous ? "Everyone agreed! 🎉" : "Top pick"}
                </span>
                <div className="text-[19px] font-bold text-ink">{top.place.name}</div>
                <div className="text-[13.5px] text-ink-muted">
                  {unanimous
                    ? "Everyone who's voted loved it"
                    : `${top.likeCount} of ${participantCount} friends liked it`}
                </div>
                <a
                  href={getDirectionsUrl(top.place)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 rounded-button bg-accent py-3.5 text-center text-[14.5px] font-bold text-white shadow-accent-glow"
                >
                  Get directions
                </a>
              </div>
            </div>

            {rest.length > 0 && (
              <div className="flex flex-col gap-3.5">
                {rest.map((entry, i) => (
                  <div key={entry.place.id} className="flex items-center gap-2.5">
                    <span className="w-[18px] text-[13.5px] font-bold text-ink-muted">{i + 2}</span>
                    <div className="h-[38px] w-[38px] shrink-0 overflow-hidden rounded-thumb">
                      {entry.place.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- provider photo, arbitrary remote URL
                        <img
                          src={entry.place.photoUrl}
                          alt={entry.place.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <PlacePhotoPlaceholder className="h-full w-full text-[8px]" />
                      )}
                    </div>
                    <span className="flex-1 truncate text-[14.5px] font-semibold text-ink">{entry.place.name}</span>
                    <div className="h-2 w-[70px] shrink-0 overflow-hidden rounded-full bg-surface-alt">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${(entry.likeCount / participantCount) * 100}%` }}
                      />
                    </div>
                    <span className="w-[14px] shrink-0 text-right text-[13px] text-ink-muted">
                      {entry.likeCount}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="px-6 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-2">
        {extendMessage && <div className="mb-2 text-center text-[12.5px] font-medium text-ink-muted">{extendMessage}</div>}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push(`/s/${code}/swipe`)}
            className="flex-1 rounded-button bg-surface-alt py-3.5 text-[14.5px] font-semibold text-ink"
          >
            Swipe more
          </button>
          <button
            type="button"
            onClick={handleExtendSearch}
            disabled={extending}
            className="flex-1 rounded-button bg-surface-alt py-3.5 text-[14.5px] font-semibold text-ink disabled:opacity-40"
          >
            {extending ? "Searching…" : "Extend search"}
          </button>
        </div>
      </div>
    </ScreenContainer>
  );
}
