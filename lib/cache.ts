import { NextResponse } from "next/server";

// CDN caching for the read APIs. Cached responses are served by Netlify's
// edge without invoking a function or waking the database — the main credit
// consumers on the free plan. Writes purge the relevant tags instantly, so
// s-maxage only matters as a ceiling for purge failures.
//
// Clash protection is unaffected: overlap checks run server-side inside the
// write routes and never read from this cache.

/** JSON response cached at the CDN under the given tag. */
export function cachedJson(data: unknown, tag: string): NextResponse {
  return NextResponse.json(data, {
    headers: {
      // Browsers must revalidate with the CDN; the CDN serves from cache
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Netlify-CDN-Cache-Control": "public, durable, s-maxage=300, stale-while-revalidate=86400",
      // Without this, the Next runtime's default cache key IGNORES query
      // params — every ?from/?to range would share one cached response.
      "Netlify-Vary": "query",
      "Cache-Tag": tag,
    },
  });
}

/** Purge CDN cache tags after a write. Never breaks the write on failure. */
export async function purgeTags(tags: string[]): Promise<void> {
  try {
    const { purgeCache } = await import("@netlify/functions");
    await purgeCache({ tags });
  } catch (err) {
    // Local dev has no purge API; production failures fall back to the
    // 5-minute s-maxage ceiling.
    console.warn("purgeTags: skipped/failed", (err as Error)?.message);
  }
}
