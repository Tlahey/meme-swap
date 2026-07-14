# Features

A summary of what meme-swap can actually do today, across its three surfaces (web app, desktop app, MCP server). For how it's built, see [`architecture.md`](./architecture.md).

## Face swapping

- Swap a source face onto a target GIF or MP4 using FaceFusion, running entirely locally (no cloud, no uploads).
- Configurable execution providers (`coreml`, `cpu`, `cuda`) and thread count.
- Optional processors beyond the base swap, each independently toggleable with its own model: face enhancer, frame enhancer, lip syncer, expression restorer.
- Face selector mode, face mask blend, and face/frame enhancer blend controls.
- Real-time progress during a swap (percentage + phase — analysing/extracting/processing/merging — with a derived time-remaining estimate), streamed over SSE on the web and IPC on desktop.
- Before/after result preview with slider, side-by-side, and focus view modes.

## Media handling

- GIF targets are converted to MP4 before swapping and back to GIF afterward; MP4 targets are swapped directly.
- GIF output uses a two-pass FFmpeg palette encode for quality (10fps/320px wide by default).

## Three surfaces

- **Web app** (`apps/frontend`, Next.js) — the primary UI, all processing server-side.
- **Desktop app** (`apps/desktop`, Electron) — packaged as a `.dmg`, wraps the same pipeline over IPC, with a guided first-run installer.
- **MCP server** (`apps/mcp-server`) — exposes face swapping as an MCP tool over SSE, stateless JSON-RPC, and stdio, so AI assistants (Claude, Cursor, etc.) can run swaps directly.

## Setup & onboarding

- Guided first-run installer on both web and desktop (shared logic in `packages/installer-core`), with step-by-step status and streamed logs.
- Pre-flight disk space check (8 GB floor) with a non-blocking low-space warning, plus an upfront size/time estimate.
- Post-install verification: runs a real swap against bundled test assets so the one-time model download happens during setup, not on the user's first real swap.
- "Re-check installation" flow if FaceFusion/Python/ffmpeg turn out to be missing or broken later.

## GIF search (Giphy)

- Built-in Giphy search and trending GIFs as a target source, with a fallback chain: browser-stored API key → Electron IPC → Next.js proxy route → server-side `GIPHY_API_KEY` → a curated static GIF list if nothing is configured, so the feature never fully breaks even unconfigured.

## History

- **Source history** — saved source faces, pruned to the 5 most recent, available on both web and desktop for quick reuse without re-uploading.
- **Results history** — generated swap results persist (pruned to the 20 most recent) instead of being wiped after each run, with click-to-download and no need to redo the swap.

## Robustness

- Environment failures (FaceFusion, Python venv, or ffmpeg missing or broken) are classified and surfaced as actionable messages instead of raw stack traces, distinguishing "not installed" from "installed but broken" (e.g. a stale binary after a Homebrew upgrade).
- Automatic temp-directory cleanup after every run, with a size-based safety net (2 GiB cap) that force-purges and logs loudly if a crashed run ever leaves it over budget — checked on both every request and desktop app startup.

## Distribution & updates

- Automated CI on every PR: build, test, lint, and format checks across all workspace packages.
- Automated `.dmg` build and draft GitHub release on every `vX.Y.Z` tag push, with atomic version bumping across all workspace packages (`pnpm release`) so the tag, the built app, and `package.json` can never drift apart.
- The desktop app checks for new releases on startup and periodically, showing a dismissible in-app banner linking to the release — not a silent auto-updater, since the app isn't code-signed/notarized yet.

## Internationalization

- English and French, with automatic browser-locale detection and a manual switcher.

## Code quality

- Strict TypeScript (`strict`, `noImplicitAny`, `noUncheckedIndexedAccess`) with no `any` usages anywhere in the codebase.
- ESLint and Prettier enforced across every workspace package, with shared config and dependency versions (pnpm catalog) instead of per-package drift.
- Vitest unit tests covering the core pure logic (FaceFusion argument building, FFmpeg error classification, the Giphy client's fallback chain, i18n key resolution).

## Not (yet) included

- Batch/queue processing — deliberately out of scope; the app is designed around one source-face-to-one-target swap at a time.
- Code signing / notarization — the app ships unsigned; see the Gatekeeper note in the main [README](../README.md#installation).
- Automated test coverage for the app layer itself (React components, the Electron main process, the MCP server's request handling) — only the underlying packages are covered so far.
