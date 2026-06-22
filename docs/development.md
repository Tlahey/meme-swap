# Development Guide

This guide covers everything you need to run and develop meme-swap locally.

---

## Prerequisites

| Tool | Minimum Version | Install |
|---|---|---|
| Node.js | 18.x | [nodejs.org](https://nodejs.org) |
| pnpm | 9.x | `npm i -g pnpm` |
| Python | 3.9 | `brew install python` |
| FFmpeg | any | `brew install ffmpeg` |
| Git | 2.x | pre-installed on macOS |

---

## Initial Setup

### 1. Clone and install Node dependencies

```bash
git clone git@github.com:Tlahey/meme-swap.git
cd meme-swap
pnpm install
```

### 2. Install FaceFusion

FaceFusion is a Python application that is installed globally at `~/.meme-swap/facefusion/`. This is a one-time step.

```bash
pnpm install:facefusion
```

This script will:
- Clone [FaceFusion](https://github.com/facefusion/facefusion) from GitHub
- Create a Python virtual environment at `~/.meme-swap/facefusion/venv/`
- Install all Python dependencies
- Copy the system `ffmpeg` / `ffprobe` binaries to `~/.meme-swap/bin/`

### 3. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` as needed (see [Environment Variables](#environment-variables) below).

### 4. Build shared packages

Packages must be built before apps can use them:

```bash
pnpm build
```

---

## Running Apps

### Web Frontend

```bash
pnpm frontend:dev
```

Opens on **http://localhost:3010**.

The frontend is a Next.js 14 App Router application. Hot-reload is enabled. Changes to `apps/frontend/app/` are reflected immediately.

> If you change code in `packages/faceswap-core` or `packages/video-processor`, rebuild them first:
> ```bash
> pnpm build --filter=@meme-swap/faceswap-core
> pnpm build --filter=@meme-swap/video-processor
> ```

### Desktop App

```bash
pnpm desktop:dev
```

Starts Electron in development mode. On first run, the setup wizard will appear if FaceFusion has not been installed yet.

### MCP Server

```bash
# Build first
pnpm build --filter=mcp-server

# Start in development (auto-rebuild on change)
cd apps/mcp-server
pnpm dev
```

The server listens on **http://localhost:3001**.

Health check:
```bash
curl http://localhost:3001/health
```

### All Apps in Parallel

```bash
pnpm dev
```

Starts all apps simultaneously via Turborepo. Useful for full-stack development.

---

## Working with Packages

### Package Build Commands

```bash
pnpm build --filter=@meme-swap/faceswap-core
pnpm build --filter=@meme-swap/video-processor
pnpm build --filter=@meme-swap/i18n
```

### Watch Mode (for package development)

```bash
cd packages/faceswap-core && pnpm dev   # tsc --watch
cd packages/video-processor && pnpm dev # tsc --watch
```

### Cleaning Build Outputs

```bash
pnpm clean          # clean all packages + remove node_modules
pnpm build          # rebuild everything from scratch
```

---

## Environment Variables

All variables are optional unless marked **required**.

| Variable | Default | Description |
|---|---|---|
| `GIPHY_API_KEY` | — | Giphy API key (for `@meme-swap/api-client`, not yet active) |
| `FACEFUSION_EXECUTION_PROVIDERS` | `coreml,cpu` | Comma-separated list of providers: `coreml`, `cpu`, `cuda` |
| `FACEFUSION_THREAD_COUNT` | auto | Number of parallel threads for FaceFusion |
| `PORT` | `3010` | Port for the web frontend dev server |

### Execution Providers

| Hardware | Recommended providers |
|---|---|
| Apple Silicon (M1/M2/M3) | `coreml,cpu` |
| NVIDIA GPU | `cuda,cpu` |
| Any / fallback | `cpu` |

---

## Project Conventions

See [AGENTS.md](../AGENTS.md) for the full set of rules. Key points:

- **TypeScript strict mode** — no `any`, no implicit returns
- **pnpm only** — never use `npm` or `yarn`
- **Named exports** — avoid default exports
- **Async/await** — no `.then()` chains
- **Interface over type alias** — for object shapes

### Import Order

```typescript
// 1. Node built-ins
import path from 'node:path';

// 2. Third-party
import { NextRequest } from 'next/server';

// 3. Internal workspace packages
import { runFaceSwap } from '@meme-swap/faceswap-core';

// 4. Relative imports
import { Button } from './Button';
```

---

## Testing

There is currently no automated test suite. The plan is to add Vitest unit tests to each package. See [AGENTS.md](../AGENTS.md#testing-requirements) for the target coverage requirements.

Manual testing of the full pipeline:
1. Start the frontend: `pnpm frontend:dev`
2. Open http://localhost:3010
3. Upload a face image and a target GIF/MP4
4. Verify the result downloads correctly

---

## Troubleshooting

### `FaceFusion Python not found`

```bash
# Re-run the setup script
pnpm install:facefusion

# Verify the venv exists
ls ~/.meme-swap/facefusion/venv/bin/python3
```

### `FFmpeg not found`

```bash
brew install ffmpeg

# Re-run setup to copy it to ~/.meme-swap/bin
pnpm install:facefusion
```

### Port already in use

```bash
# Find what's using the port
lsof -i :3010
lsof -i :3001

# Kill the process
kill -9 <PID>
```

### MCP server not responding

```bash
# Check if it's running
curl http://localhost:3001/health

# Check logs
cd apps/mcp-server && cat logs/mcp-server-error.log
```
