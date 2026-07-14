# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

meme-swap is a pnpm/Turborepo monorepo that wraps the [FaceFusion](https://github.com/facefusion/facefusion) Python engine to swap faces in GIFs/MP4s, exposed through three surfaces: a Next.js web app, an Electron desktop app, and an MCP server. FaceFusion itself, its Python venv, and FFmpeg binaries live outside the repo at `~/.meme-swap/` — the repo contains no Python or model files.

## Commands

```bash
pnpm install                # install JS deps
pnpm install:facefusion     # one-time: clone FaceFusion + create venv at ~/.meme-swap/facefusion, copy ffmpeg/ffprobe to ~/.meme-swap/bin
pnpm build                  # build all workspace packages/apps (turbo, dependency-ordered)
pnpm dev                    # run all apps' dev tasks in parallel
pnpm lint                   # turbo run lint (currently only apps/frontend defines a lint script)

pnpm frontend:dev           # Next.js dev server → http://localhost:3010
pnpm desktop:dev            # Electron in dev mode (tsc && electron .)
pnpm desktop:build          # compile desktop TS + copy html/png assets to build/
pnpm desktop:package        # build -> bundle -> electron-builder package (produces .dmg in apps/desktop/dist/)

# mcp-server (no root script; run from its directory)
pnpm build --filter=mcp-server && cd apps/mcp-server && pnpm start   # → http://localhost:3001

# single package build/watch, e.g.
pnpm build --filter=@meme-swap/faceswap-core
cd packages/faceswap-core && pnpm dev   # tsc --watch
```

**There is no automated test suite** (no vitest/jest anywhere, no `test` script in any package). Don't assume `pnpm test` does anything meaningful, and don't treat AGENTS.md's "Testing Requirements" section as describing reality — it's aspirational.

**Build order matters**: apps consume workspace packages (`@meme-swap/faceswap-core`, `video-processor`, `i18n`, `api-client`) via their compiled `dist/` output (`main`/`types` in each package's `package.json`) — Next.js does not use `transpilePackages`. After changing a package, run `pnpm build --filter=<package>` (or `pnpm build`) before the change is visible in an app.

## Architecture

### Apps vs packages

- `apps/frontend` — Next.js 16 (App Router, React 19), the primary UI. All processing happens server-side in API routes.
- `apps/desktop` — Electron app. Its main process (`src/main.ts`) spawns the frontend's `next dev`/static export **and** the mcp-server as child processes, resolves free ports dynamically, and loads the UI via `http://localhost:<port>` (dev) or a custom `app://` protocol handler serving the Next.js static export (packaged). It also duplicates the faceswap pipeline over Electron IPC (`ipcMain.handle('run-faceswap', ...)`) rather than calling the frontend's HTTP API. As of the latest change there is **no system tray icon** — closing the window quits the app (`window-all-closed` → `app.quit()`); don't reintroduce tray-based lifecycle assuming docs/architecture.md's older description still applies.
- `apps/mcp-server` — Express + `@modelcontextprotocol/sdk`, exposes a single `run_faceswap` tool over SSE (`/mcp` GET), stateless JSON-RPC (`/mcp` POST), and stdio (`--stdio` flag). Also has a `/health` endpoint.

Shared packages:
- `packages/faceswap-core` — spawns FaceFusion's Python CLI via `spawn()`. Resolves `~/.meme-swap/facefusion/venv/bin/python3.11` (preferred) or `python3`/`python`, and `~/.meme-swap/facefusion/facefusion.py`. Invokes it with the `headless-run` subcommand (not `run --headless`, despite what AGENTS.md's example shows) plus flags built from `FaceswapOptions` (execution providers, face selector mode, processors like `face_swapper`/`face_enhancer`/`frame_enhancer`/`lip_syncer`/`expression_restorer`, blend/blur values, temp path). Target media **must already be MP4** — GIFs are converted first.
- `packages/video-processor` — FFmpeg wrapper. `gifToMp4()` is single-pass with `faststart`; `mp4ToGif()` is two-pass (palettegen then paletteuse) for quality, default 10fps/320px width. Looks for ffmpeg at `~/.meme-swap/bin/ffmpeg` first, falls back to `ffmpeg` on PATH.
- `packages/api-client` — **not a placeholder**, despite what README/AGENTS.md/docs say. It's a working Giphy client (`giphy.search()`, `giphy.trending()`) with a fallback chain: browser `localStorage` API key → Electron IPC (`window.electronAPI.searchGiphy`) → Next.js proxy route (`/api/giphy/*`) → server-side `GIPHY_API_KEY` env var → curated static mock GIF list (`CURATED_FALLBACK_GIFS`) if nothing else is configured.
- `packages/i18n` — plain-object locale dictionaries (`src/locales/en.ts`, `fr.ts`) plus an `index.tsx` for consuming them; used by frontend (and desktop's renderer).

### Processing pipeline

Both the frontend API route (`apps/frontend/app/api/faceswap/route.ts`) and the desktop IPC handler (`apps/desktop/src/main.ts`, `run-faceswap`) implement the same sequence — if you change one, check whether the other needs the same fix:

1. Save uploaded source image + target media (or pull source from `~/.meme-swap/source-history/` if the client passed a `history:<filename>` reference).
2. If target is a `.gif`, convert to MP4 via `video-processor.gifToMp4()`.
3. Run `faceswap-core.runFaceSwap()` against the MP4.
4. Convert the MP4 result back to GIF via `video-processor.mp4ToGif()` (frontend/desktop always do this for preview/download).
5. Serve the result from `~/.meme-swap/process/results/` via `/api/results/:filename`.

All runtime data lives under `~/.meme-swap/` in the user's home directory, **not** in `.process/` inside the repo (that path appears in older parts of AGENTS.md and is stale):

| Path | Purpose |
|---|---|
| `~/.meme-swap/facefusion/` | FaceFusion clone + `venv/` |
| `~/.meme-swap/bin/` | Copied `ffmpeg`/`ffprobe` |
| `~/.meme-swap/process/temp/` | Per-run temp files (wiped at the start of each request) |
| `~/.meme-swap/process/results/` | Output files served back to the client |
| `~/.meme-swap/source-history/` | Saved source faces (desktop only; pruned to the 5 most recent) |
| `~/.meme-swap/logs/desktop.log` | Desktop app log, reset each launch |

### Code style

`tsconfig.json` at the repo root enforces `strict`, `noImplicitAny`, `noUncheckedIndexedAccess`, `noImplicitReturns`, `noFallthroughCasesInSwitch` — match this in new code. AGENTS.md documents further conventions (named exports over default, `interface` over `type` for object shapes, async/await over `.then()`, Node-builtins → third-party → internal packages → relative import ordering); it's generally reliable for style rules, but several of its architecture-level claims are outdated (e.g. it describes the frontend as "React/Vue" and the api-client as a placeholder) — trust the actual source over that document when the two disagree.

Source comments in `faceswap-core` and `video-processor` are written in French; matching that isn't required for new code, but don't be surprised by it when reading these two packages.
