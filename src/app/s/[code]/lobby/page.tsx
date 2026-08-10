"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ScreenCenter, ScreenContainer } from "@/components/ScreenContainer";
import { Button } from "@/components/ui/Button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getParticipantByToken, getSessionByShortCode, listParticipants, startSession } from "@/lib/session/api";
import { getParticipantToken } from "@/lib/session/storage";
import type { Participant, Session } from "@/lib/session/types";

export default function LobbyPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = params.code.toUpperCase();

  const [session, setSession] = useState<Session | null>(null);
  const [self, setSelf] = useState<Participant | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

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

      if (found.status !== "lobby") {
        router.replace(`/s/${code}/${found.status === "active" ? "swipe" : "results"}`);
        return;
      }

      setSession(found);
      setSelf(participant);
      setParticipants(await listParticipants(found.id));
      setLoading(false);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [code, router]);

  // Live roster (participants join) and live status (host starts, from any device).
  useEffect(() => {
    if (!session) return;
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`lobby:${session.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "participants", filter: `session_id=eq.${session.id}` },
        () => {
          listParticipants(session.id).then(setParticipants);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${session.id}` },
        (payload) => {
          const status = (payload.new as { status: Session["status"] }).status;
          if (status === "active") router.replace(`/s/${code}/swipe`);
          if (status === "finished") router.replace(`/s/${code}/results`);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, code, router]);

  async function handleStart() {
    if (!session) return;
    setStarting(true);
    try {
      await startSession(session.id);
      router.replace(`/s/${code}/swipe`);
    } catch {
      setStarting(false);
    }
  }

  if (loading || !session || !self) {
    return <ScreenCenter><span className="text-ink-muted">Loading…</span></ScreenCenter>;
  }

  return (
    <ScreenContainer>
      <div className="px-6 pb-1 pt-8">
        <h1 className="text-[26px] font-bold text-ink">Lobby</h1>
        <div className="mt-0.5 text-[13.5px] text-ink-muted">
          {participants.length} {participants.length === 1 ? "person" : "people"} joined · code {code}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-6 py-5">
        {participants.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-card bg-surface px-4 py-3 shadow-elevation-sm">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-tint text-[14px] font-bold text-accent">
              {p.name.charAt(0).toUpperCase()}
            </div>
            <span className="flex-1 truncate text-[14.5px] font-semibold text-ink">{p.name}</span>
            {p.isHost && (
              <span className="shrink-0 rounded-full bg-accent-tint px-2.5 py-1 text-[11px] font-bold text-accent">
                HOST
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="px-6 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3.5">
        {self.isHost ? (
          <Button onClick={handleStart} disabled={starting}>
            {starting ? "Starting…" : "Start swiping"}
          </Button>
        ) : (
          <div className="text-center text-[13.5px] text-ink-muted">Waiting for the host to start…</div>
        )}
      </div>
    </ScreenContainer>
  );
}
