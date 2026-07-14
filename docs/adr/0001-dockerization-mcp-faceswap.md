# ADR 0001: Architecture choice for FaceFusion and MCP server portability on macOS

* **Status**: Accepted (core decision: no Docker, Electron desktop app)
* **Author**: Antigravity (AI Agent)
* **Date**: 2026-06-22
* **Decision requested by**: USER (Antoine)

> **Update note (2026-06-23)**: the "Electron instead of Docker" choice described below was indeed implemented and remains accurate — `apps/desktop` is the Electron application. However, the "menu bar icon (tray icon)" UI detail described in Option 3 was later removed (commit `7f67713`, "feat(desktop): remove tray icon and quit app on window close"): closing the window now quits the application, with no tray icon. See `apps/desktop/src/main.ts`.

---

## 1. Context and Problem Statement

The **meme-swap** application uses the Python engine **FaceFusion** (user folder `~/.meme-swap/facefusion`) to perform high-performance face swapping. To run on macOS, it requires:
1. **Python 3.11** with the dependencies specified in `requirements.txt`.
2. The ONNX runtime binary suited to the Apple Silicon architecture (`onnxruntime-silicon`).
3. **FFmpeg** installed on the host system for GIF ↔ MP4 conversions.
4. The MCP server (`apps/mcp-server`) running via Node.js to expose the faceswap tools.

### New user requirements:
* **Real-time visibility**: Be able to monitor the application's running state (MCP server and frontend) at any time.
* **No lingering processes**: Launch the application easily, but ensure that when it's quit, all background processes (Node.js, Express, FaceFusion) shut down cleanly without leaving ghost or orphaned processes.
* **Unified, lightweight packaging**: Distribute the whole thing as a single, lightweight macOS application bundle (`.app`) to simplify deployment to other Macs.

---

## 2. Solution Options Considered

### Option 1: Native macOS Service (Launch Agent) + Automated Installer
* **Description**: A shell script automates the system installation. The MCP server runs via a Launch Agent (`plist`) as a background task at system startup.
* **Limits relative to the new requirements**:
  * Hard to monitor the state in real time without opening a terminal to read the logs.
  * No notion of cleanly stopping via "quitting" a graphical application (you have to run terminal commands like `pnpm run service:stop`).
  * The components are not packaged into a single `.app` bundle.

### Option 2: Docker Compose with Automatic Startup (CPU Only)
* **Description**: Runs via Docker with automatic restart.
* **Limits relative to the new requirements**:
  * No CoreML acceleration (CPU only, 10x to 20x slower).
  * The user has to launch and manage Docker Desktop.
  * No control interface integrated into the macOS menu bar.

### Option 3: Native macOS Menu Bar Application (via Electron or Tauri) — RECOMMENDED
* **Description**: Build a lightweight desktop application that installs itself in the macOS **Menu Bar (Tray Icon)** and supervises the MCP server and the Next.js frontend in the background on a single port (port 3010, with the MCP protocol available at `/mcp`).
* **General advantages**:
  * Perfect real-time status visibility (menu bar icon).
  * Zero lingering processes: closing the app stops all servers.
  * Uses native macOS hardware acceleration (CoreML).
  * Final package as a `.app` file.

---

## 3. Technical Comparison: Electron vs Tauri for the Supervisor

| Criterion | Electron | Tauri |
| :--- | :--- | :--- |
| **Bundle size (.app)** | 🐌 **Heavy** (~120–150 MB)<br>Bundles Chromium and Node.js. | ⚡ **Very lightweight** (~10–20 MB)<br>Uses macOS's WebKit (Safari) engine. |
| **Development complexity** | 🟢 **Simple**<br>Backend in JavaScript/Node.js.<br>Direct integration of Node processes (MCP & Next.js). | 🟡 **Medium/High**<br>Backend in **Rust**.<br>Requires writing the orchestration in Rust. |
| **Build dependencies** | 🟢 **Node.js only**<br>Nothing extra to install on the build Mac. | 🔴 **Rust & Cargo required**<br>Requires the Rust toolchain installed to compile. |
| **Node.js handling** | 🟢 **Native**<br>Electron bundles Node.js, allowing the MCP server to launch with no system Node prerequisite. | 🟡 **External**<br>Tauri needs Node.js on the host system to launch the MCP server / Next.js. |
| **Impact if Python is included** | ⚪ **Negligible**<br>If the 4 GB Python folder is included in the app, the total comes to ~4.15 GB. | ⚪ **Negligible**<br>If the 4 GB Python folder is included in the app, the total comes to ~4.02 GB. |

### Analysis
* If the main goal is the **lightest possible bundle** (without bundling Chromium and Node.js), **Tauri** is the better choice (~130 MB saved). However, this requires installing the Rust toolchain to compile and adds complexity to orchestrating the startup scripts, which would need to be handled in Rust.
* If the goal is **integration simplicity** (100% JS/TS within the monorepo, no dependency on Rust), **Electron** is the natural, robust choice for orchestrating Node subprocesses (Next.js, MCP server).

---

## 4. Proposed Decision

We recommend **Option 3 (Menu Bar Application via Electron)** for its simplicity and robust integration with the MCP server and Next.js, both written in JavaScript/TypeScript.

*However, if the user considers bundle size critically important (~15 MB vs ~150 MB), we can go with **Tauri** and write the orchestration code in Rust.*
