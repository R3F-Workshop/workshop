<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Testing Principles

- Cover the common paths that represent the 80% of real usage. Add edge-case tests only when the edge case is important or guards against a meaningful regression.
- Test observable features and user stories, not implementation details. Test internals only when an exceptionally difficult case cannot be covered reliably through public behavior.

## Comments

Comments are documentation. Keep them concise and explain the algorithm or feature, not the change or its history. Use simple punctuation with no semicolons or em dashes.

# Const Policy

We want reduce top level const and inline anything that is an explicit hook we need tweak often. Always ask yourself if a const needs to exist before making it. Prefer to inline.
