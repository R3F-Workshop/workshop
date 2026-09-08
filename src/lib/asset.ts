/**
 * Prefixes a `public/` path with the deploy base path.
 *
 * `next/link` applies `basePath` on its own, but loader URLs, `next/image`
 * sources, and CSS urls pass through untouched, so anything that reaches into
 * `public/` goes through here. NEXT_PUBLIC_BASE_PATH is inlined at build time
 * and is empty everywhere except the GitHub Pages build.
 */
export const asset = (path: `/${string}`) =>
  `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${path}`;
