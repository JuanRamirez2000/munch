import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import type { DeckPlace } from "./types";

type PlaceRow = Database["public"]["Tables"]["places"]["Row"];

function rowToDeckPlace(row: PlaceRow): DeckPlace {
  return {
    id: row.id,
    name: row.name,
    photoUrl: row.photo_url,
    cuisines: row.cuisines,
    priceLevel: row.price_level,
    rating: row.rating,
    lat: row.lat,
    lng: row.lng,
    address: row.address,
    openNow: row.open_now,
    deckOrder: row.deck_order,
    score: row.score,
  };
}

export async function listDeckPlaces(sessionId: string): Promise<DeckPlace[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("places")
    .select("*")
    .eq("session_id", sessionId)
    .order("deck_order", { ascending: true });

  if (error) throw error;
  return data.map(rowToDeckPlace);
}

export async function listVotedPlaceIds(sessionId: string, participantId: string): Promise<Set<string>> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("votes")
    .select("place_id")
    .eq("session_id", sessionId)
    .eq("participant_id", participantId);

  if (error) throw error;
  return new Set(data.map((row) => row.place_id));
}

export async function getLikeCounts(sessionId: string): Promise<Record<string, number>> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("votes")
    .select("place_id")
    .eq("session_id", sessionId)
    .eq("liked", true);

  if (error) throw error;
  const counts: Record<string, number> = {};
  for (const row of data) {
    counts[row.place_id] = (counts[row.place_id] ?? 0) + 1;
  }
  return counts;
}

export async function getTotalVoteCount(sessionId: string): Promise<number> {
  const supabase = getSupabaseBrowserClient();
  const { count, error } = await supabase
    .from("votes")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId);

  if (error) throw error;
  return count ?? 0;
}

export async function castVote(input: {
  sessionId: string;
  participantId: string;
  placeId: string;
  liked: boolean;
}): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("votes").upsert(
    {
      session_id: input.sessionId,
      participant_id: input.participantId,
      place_id: input.placeId,
      liked: input.liked,
    },
    { onConflict: "participant_id,place_id" }
  );

  if (error) throw error;
}
