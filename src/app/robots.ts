import type { MetadataRoute } from "next";

/**
 * The attendee guide is gated by an unguessable URL rather than auth.
 * Keeping it out of the index is most of what makes that hold up.
 */
// Emitted once at build time so the static export can include it.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Demos are shareable by link but not finished work; keeping them out of
      // the index avoids them ranking ahead of the page they came from.
      disallow: ["/attendees", "/attendees/", "/demos"],
    },
  };
}
