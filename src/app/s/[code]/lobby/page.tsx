"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FiltersEditor } from "@/components/FiltersEditor";
import { ScreenCenter, ScreenContainer } from "@/components/ScreenContainer";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  getParticipantByToken,
  getSessionByShortCode,
  listParticipants,
  startSession,
  updateSessionFilters,
} from "@/lib/session/api";
import { getParticipantToken } from "@/lib/session/storage";
import {
  editorValueToFiltersAndWeights,
  filtersAndWeightsToEditorValue,
  type FiltersEditorValue,
} from "@/lib/session/filters-editor";
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

  const [editingSettings, setEditingSettings] = useState(false);
  const [editorValue, setEditorValue] = useState<FiltersEditorValue | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);

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
      setEditorValue(filtersAndWeightsToEditorValue(found.filters, found.weights));
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

  async function handleSaveSettings() {
    if (!session || !editorValue) return;
    setSavingSettings(true);
    setSettingsMessage(null);
    try {
      const { filters, weights } = editorValueToFiltersAndWeights(editorValue);
      await updateSessionFilters(session.id, filters, weights);
      const response = await fetch(`/api/sessions/${session.id}/build-deck`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) {
        setSettingsMessage("Saved, but couldn't reload places. Try again.");
        return;
      }
      setSession({ ...session, filters, weights });
      setSettingsMessage(`Reloaded — ${body.count} places match now.`);
      setEditingSettings(false);
    } catch {
      setSettingsMessage("Couldn't save settings. Try again.");
    } finally {
      setSavingSettings(false);
    }
  }

  if (loading || !session || !self || !editorValue) {
    return (
      <ScreenCenter>
        <span className="text-ink-muted">Loading…</span>
      </ScreenCenter>
    );
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
            <Avatar name={p.name} size={36} />
            <span className="flex-1 truncate text-[14.5px] font-semibold text-ink">{p.name}</span>
            {p.isHost && (
              <span className="shrink-0 rounded-full bg-accent-tint px-2.5 py-1 text-[11px] font-bold text-accent">
                HOST
              </span>
            )}
          </div>
        ))}

        {self.isHost && (
          <div className="mt-3 flex flex-col gap-3.5 rounded-card bg-surface p-4 shadow-elevation-sm">
            <button
              type="button"
              onClick={() => {
                setSettingsMessage(null);
                setEditingSettings((v) => !v);
              }}
              className="flex items-center justify-between text-left"
            >
              <span className="text-[14.5px] font-semibold text-ink">Session settings</span>
              <span className="text-[13px] font-semibold text-accent">{editingSettings ? "Close" : "Edit"}</span>
            </button>

            {editingSettings && (
              <>
                <FiltersEditor value={editorValue} onChange={setEditorValue} />
                <Button onClick={handleSaveSettings} disabled={savingSettings}>
                  {savingSettings ? "Reloading places…" : "Save & reload places"}
                </Button>
              </>
            )}

            {settingsMessage && <div className="text-[12.5px] font-medium text-ink-muted">{settingsMessage}</div>}
          </div>
        )}
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
