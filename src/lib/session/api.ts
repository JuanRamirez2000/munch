import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import { generateShortCode } from "./short-code";
import type { Participant, Session, SessionFilters, SessionStatus, SessionWeights } from "./types";

type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];
type ParticipantRow = Database["public"]["Tables"]["participants"]["Row"];

// Deliberately excludes host_token — general reads never pull it back out over the wire.
// See verifyHost() for the one place a locally-stored host_token is used (as a query filter,
// never as a returned column) to confirm "is this browser the host".
const SESSION_COLUMNS =
  "id, short_code, origin_lat, origin_lng, filters, weights, status, deck_size, created_at, expires_at";

type PublicSessionRow = Omit<SessionRow, "host_token">;

function rowToSession(row: PublicSessionRow): Session {
  return {
    id: row.id,
    shortCode: row.short_code,
    originLat: row.origin_lat,
    originLng: row.origin_lng,
    filters: row.filters as unknown as SessionFilters,
    weights: row.weights as unknown as SessionWeights,
    status: row.status as SessionStatus,
    deckSize: row.deck_size,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

function rowToParticipant(row: ParticipantRow): Participant {
  return {
    id: row.id,
    sessionId: row.session_id,
    name: row.name,
    isHost: row.is_host,
    joinedAt: row.joined_at,
  };
}

export async function createSession(input: {
  originLat: number;
  originLng: number;
  filters: SessionFilters;
  weights: SessionWeights;
}): Promise<{ session: Session; hostToken: string }> {
  const supabase = getSupabaseBrowserClient();

  // Collisions are rare (32^4 codespace) but retry on the unique-constraint violation rather
  // than pre-checking existence, which would race under concurrent creates anyway.
  for (let attempt = 0; attempt < 5; attempt++) {
    const shortCode = generateShortCode();
    const { data, error } = await supabase
      .from("sessions")
      .insert({
        short_code: shortCode,
        origin_lat: input.originLat,
        origin_lng: input.originLng,
        filters: input.filters as unknown as Database["public"]["Tables"]["sessions"]["Insert"]["filters"],
        weights: input.weights as unknown as Database["public"]["Tables"]["sessions"]["Insert"]["weights"],
      })
      .select(`${SESSION_COLUMNS}, host_token`)
      .single();

    if (!error && data) {
      const { host_token, ...rest } = data;
      return { session: rowToSession(rest), hostToken: host_token };
    }
    if (error && error.code !== "23505") throw error;
  }

  throw new Error("Could not generate a unique session code. Please try again.");
}

export async function getSessionByShortCode(shortCode: string): Promise<Session | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("sessions")
    .select(SESSION_COLUMNS)
    .eq("short_code", shortCode.toUpperCase())
    .maybeSingle();

  if (error) throw error;
  return data ? rowToSession(data) : null;
}

// Confirms this browser holds the session's host_token without ever selecting the token
// column back out — it's used purely as a filter predicate.
export async function verifyHost(sessionId: string, hostToken: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("host_token", hostToken)
    .maybeSingle();

  if (error) throw error;
  return data !== null;
}

export async function joinSession(input: {
  sessionId: string;
  name: string;
  isHost: boolean;
}): Promise<{ participant: Participant; participantToken: string }> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("participants")
    .insert({ session_id: input.sessionId, name: input.name, is_host: input.isHost })
    .select("*")
    .single();

  if (error) throw error;
  return { participant: rowToParticipant(data), participantToken: data.participant_token };
}

export async function getParticipantByToken(
  sessionId: string,
  participantToken: string
): Promise<Participant | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("participants")
    .select("*")
    .eq("session_id", sessionId)
    .eq("participant_token", participantToken)
    .maybeSingle();

  if (error) throw error;
  return data ? rowToParticipant(data) : null;
}

export async function listParticipants(sessionId: string): Promise<Participant[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("participants")
    .select("*")
    .eq("session_id", sessionId)
    .order("joined_at", { ascending: true });

  if (error) throw error;
  return data.map(rowToParticipant);
}

export async function startSession(sessionId: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("sessions")
    .update({ status: "active" satisfies SessionStatus })
    .eq("id", sessionId);

  if (error) throw error;
}
