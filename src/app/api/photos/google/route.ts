import { NextRequest, NextResponse } from "next/server";

// Google's Places Photo (New) media endpoint requires the API key as a query param — this
// route keeps that key server-side. `skipHttpRedirect=true` makes Google return JSON with a
// direct photoUri instead of a 302, which we then redirect the client to; the browser fetches
// the actual image bytes straight from Google's CDN rather than proxying them through us.
export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name");
  if (!name) {
    return NextResponse.json({ error: "Missing name" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Photo provider not configured" }, { status: 500 });
  }

  const url = `https://places.googleapis.com/v1/${name}/media?maxWidthPx=800&skipHttpRedirect=true&key=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) {
    return NextResponse.json({ error: "Photo not found" }, { status: 502 });
  }

  const data: { photoUri?: string } = await response.json();
  if (!data.photoUri) {
    return NextResponse.json({ error: "Photo not found" }, { status: 502 });
  }

  return NextResponse.redirect(data.photoUri);
}
