# Improvement ideas

Backlog of ideas to triage/prioritize before implementation. No date commitment, no guarantee everything gets done.

## Installation / onboarding

- [x] Build a web onboarding screen equivalent to the desktop stepper ([apps/desktop/src/setup.html](../apps/desktop/src/setup.html)): detect missing FaceFusion in `apps/frontend/app/page.tsx`, show a setup mode with logs streamed (SSE) from an API route that calls the install logic on the web side. Also hardened FFmpeg resolution along the way: it's no longer copied into `~/.meme-swap/bin` (that copy went stale after `brew upgrade ffmpeg` and broke real swaps with a dyld error) — it's now resolved directly from Homebrew's bin dirs at runtime, and Homebrew is a hard install requirement in all three setup paths (bash script, desktop installer, web installer).
- [x] Unify the install logic between [scripts/setup-facefusion.sh](../scripts/setup-facefusion.sh) (bash, no step/error tracking) and [apps/desktop/src/installer.ts](../apps/desktop/src/installer.ts) (TS, with per-step status) to avoid duplication and bring the CLI/web path up to the same robustness level. Done via a new shared package, `packages/installer-core`, exporting the 4-step FaceFusion install logic (`runFaceFusionInstall`) plus a reusable `runCmd`. `apps/desktop/src/installer.ts` now wraps it and adds its own desktop-only `build-monorepo` step (with a percent rescale so the progress bar doesn't jump backwards); `apps/frontend/app/api/setup/install/route.ts` is a thin SSE wrapper around it; `scripts/setup-facefusion.sh` was replaced by `scripts/setup-facefusion.mjs`, a CLI wrapper around the same package (the `install:facefusion` root script now builds `installer-core` first, since it runs before the rest of the monorepo is built).
- [x] Show a size/time estimate before starting the install ("~4 GB of models, 5-10 min depending on connection") and check available disk space. Added `checkDiskSpace()` to `packages/installer-core` (8 GB conservative floor, `fs.statfsSync` with a `df -k` fallback), surfaced via `/api/setup/status` on the web and a new `get-setup-preflight` IPC handler on desktop. Both wizards show a static size/time estimate and a non-blocking low-space warning.
- [x] Add a post-install verification step (test swap on a dummy image) to confirm CoreML/onnxruntime actually works, not just that pip succeeded. Added as a 5th shared step (`verify-install`) in `runFaceFusionInstall`: runs the real production pipeline (`gifToMp4` + `runFaceSwap`, `face_swapper` only) against the repo's existing test assets, so the one-time model download happens during setup instead of surprising the user on their first real swap. Scratch files are cleaned up afterward regardless of outcome.

## Core product UX

- [ ] Check/improve `ProcessSteps` to show a remaining-time estimate during the swap, not just a percentage.
- [ ] Before/after preview as a side-by-side or slider instead of two separate previews.
- [ ] Queue / batch processing: apply the same source face to multiple GIFs in a row.
- [ ] History of generated results (not just sources) with re-download without redoing the swap.

## Robustness

- [ ] Actionable error message when FaceFusion/Python/ffmpeg are missing or broken, instead of a raw stack trace.
- [ ] Automatic cleanup/monitoring of `~/.meme-swap/process/temp` if the folder grows too large.

## Distribution

- [ ] Decide the fate of `apps/raycast-extension` (empty folder): build it out or remove it from the repo to avoid confusion.
- [ ] Add auto-update for the Electron app (electron-builder supports this natively).
