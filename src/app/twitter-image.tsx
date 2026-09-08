// Same card for both. Re-exported rather than duplicated so the two can never
// drift apart. Route segment config cannot be re-exported, so `dynamic` is
// declared here as well.
export { alt, size, contentType, default } from "./opengraph-image";
export const dynamic = "force-static";
