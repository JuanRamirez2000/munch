"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ScreenCenter, ScreenContainer } from "@/components/ScreenContainer";
import { Button } from "@/components/ui/Button";
import { getParticipantByToken, getSessionByShortCode, joinSession, verifyHost } from "@/lib/session/api";
import { clearParticipantToken, getHostToken, getParticipantToken, setParticipantToken } from "@/lib/session/storage";
import type { Session } from "@/lib/session/types";

type Phase = "checking" | "join" | "joining" | "not-found";

function destinationFor(status: Session["status"]) {
  if (status === "active") return "swipe";
  if (status === "finished") return "results";
  return "lobby";
}

export default function SessionEntryPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = params.code.toUpperCase();

  const [phase, setPhase] = useState<Phase>("checking");
  const [session, setSession] = useState<Session | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const found = await getSessionByShortCode(code);
      if (cancelled) return;
      if (!found) {
        setPhase("not-found");
        return;
      }
      setSession(found);

      // Returning participant (refresh, rejoin) — skip straight to where they belong.
      const participantToken = getParticipantToken(code);
      if (participantToken) {
        const participant = await getParticipantByToken(found.id, participantToken);
        if (cancelled) return;
        if (participant) {
          router.replace(`/s/${code}/${destinationFor(found.status)}`);
          return;
        }
        clearParticipantToken(code);
      }

      // The host hasn't picked a name yet either — they go through the same join form,
      // just flagged so their participant row gets is_host = true.
      const hostToken = getHostToken(code);
      if (hostToken) {
        const confirmedHost = await verifyHost(found.id, hostToken);
        if (cancelled) return;
        setIsHost(confirmedHost);
      }

      setPhase("join");
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [code, router]);

  async function handleJoin() {
    if (!session || !name.trim()) return;
    setPhase("joining");
    setError(null);
    try {
      const { participantToken } = await joinSession({
        sessionId: session.id,
        name: name.trim(),
        isHost,
      });
      setParticipantToken(code, participantToken);
      router.replace(`/s/${code}/${destinationFor(session.status)}`);
    } catch {
      setError("Couldn't join the session. Please try again.");
      setPhase("join");
    }
  }

  if (phase === "checking") {
    return <ScreenCenter><span className="text-ink-muted">Loading…</span></ScreenCenter>;
  }

  if (phase === "not-found") {
    return (
      <ScreenCenter>
        <div className="text-[19px] font-bold text-ink">Session not found</div>
        <div className="text-[14.5px] text-ink-muted">This link may be wrong or the session has expired.</div>
      </ScreenCenter>
    );
  }

  return (
    <ScreenContainer>
      <div className="px-6 pb-1 pt-8">
        <h1 className="text-[26px] font-bold text-ink">{isHost ? "You're hosting!" : "Join session"}</h1>
        <div className="mt-0.5 text-[13.5px] text-ink-muted">What should we call you?</div>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-6 py-6">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleJoin()}
          placeholder="Your name"
          maxLength={40}
          autoFocus
          className="rounded-button bg-surface px-4 py-3.5 text-[15px] text-ink shadow-elevation-sm outline-none"
        />
        {error && <div className="text-[12.5px] font-medium text-pass">{error}</div>}
      </div>

      <div className="px-6 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3.5">
        <Button onClick={handleJoin} disabled={!name.trim() || phase === "joining"}>
          {phase === "joining" ? "Joining…" : "Join lobby"}
        </Button>
      </div>
    </ScreenContainer>
  );
}
