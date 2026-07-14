import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { getFaceFusionDir, getWorkspaceRoot } from '@meme-swap/faceswap-core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type StepId = 'system-checks' | 'clone-repo' | 'setup-venv' | 'install-deps';
type StepStatus = 'active' | 'completed' | 'failed';

interface ProgressEvent {
  step: StepId;
  status: StepStatus;
  percent: number;
}

/**
 * Homebrew binaries aren't always on the default Node process PATH (e.g. when
 * the dev server is launched from an IDE rather than a shell that sourced
 * .zshrc/.bash_profile), so we prepend the common Homebrew locations, mirroring
 * apps/desktop/src/installer.ts.
 */
function buildAugmentedPath(): string {
  return `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${process.env.PATH ?? ''}`;
}

function runCmd(
  cmd: string,
  args: string[],
  cwd: string,
  onLog: (text: string) => void,
): Promise<boolean> {
  return new Promise((resolve) => {
    onLog(`\n[EXEC] ${cmd} ${args.join(' ')}\n`);

    const proc = spawn(cmd, args, {
      cwd,
      shell: true,
      env: { ...process.env, PATH: buildAugmentedPath() },
    });

    proc.stdout?.on('data', (data: Buffer) => {
      onLog(data.toString());
    });

    proc.stderr?.on('data', (data: Buffer) => {
      onLog(data.toString());
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        onLog(`\n[ERROR] Command exited with code ${code}\n`);
        resolve(false);
      }
    });

    proc.on('error', (err) => {
      onLog(`\n[ERROR] Failed to start command: ${err.message}\n`);
      resolve(false);
    });
  });
}

/**
 * Runs the equivalent of apps/desktop/src/installer.ts's runInstallation(),
 * minus the build-monorepo step (that one is desktop-packaging-specific and
 * not relevant to running the web app in dev). Step names/order intentionally
 * match installer.ts so a future unification (see docs/todo-improvements.md)
 * stays straightforward.
 */
async function runInstall(
  onProgress: (data: ProgressEvent) => void,
  onLog: (text: string) => void,
): Promise<boolean> {
  const root = getWorkspaceRoot();
  onLog(`Starting installation in: ${root}\n`);

  // ---- Step 1: System checks (Homebrew, Python, FFmpeg) ----
  onProgress({ step: 'system-checks', status: 'active', percent: 5 });
  onLog('=== STEP 1: Checking Homebrew, Python and FFmpeg ===\n');

  onLog('Looking for python3...\n');
  const hasPython = await runCmd('python3', ['--version'], root, onLog);
  if (!hasPython) {
    onLog('[ERROR] Python 3 is not installed on this Mac. Please install it before continuing.\n');
    onProgress({ step: 'system-checks', status: 'failed', percent: 10 });
    return false;
  }

  onLog('Looking for Homebrew...\n');
  const hasBrew = await runCmd('which', ['brew'], root, onLog);
  if (!hasBrew) {
    onLog(
      '[ERROR] Homebrew is required but was not found. Install it from https://brew.sh, then retry setup.\n',
    );
    onProgress({ step: 'system-checks', status: 'failed', percent: 10 });
    return false;
  }

  // FFmpeg is never copied: it's always resolved from Homebrew's own bin dirs at
  // runtime (see packages/video-processor), so it stays in sync with its shared
  // libraries across `brew upgrade`.
  onLog('Looking for ffmpeg (Homebrew)...\n');
  const hasFfmpeg = await runCmd('brew', ['list', 'ffmpeg'], root, () => {});
  if (!hasFfmpeg) {
    onLog('FFmpeg not installed. Installing via Homebrew (brew install ffmpeg)...\n');
    const installedFfmpeg = await runCmd('brew', ['install', 'ffmpeg'], root, onLog);
    if (!installedFfmpeg) {
      onLog('[ERROR] Failed to install FFmpeg via Homebrew.\n');
      onProgress({ step: 'system-checks', status: 'failed', percent: 15 });
      return false;
    }
  } else {
    onLog('[OK] FFmpeg already installed via Homebrew.\n');
  }

  onLog('[OK] System checks passed.\n');
  onProgress({ step: 'system-checks', status: 'completed', percent: 25 });

  // ---- Step 2: Clone FaceFusion ----
  onProgress({ step: 'clone-repo', status: 'active', percent: 30 });
  onLog('\n=== STEP 2: Cloning the FaceFusion repository ===\n');

  const ffDir = getFaceFusionDir();
  const vendorDir = path.dirname(ffDir);

  if (!fs.existsSync(vendorDir)) {
    fs.mkdirSync(vendorDir, { recursive: true });
  }

  if (fs.existsSync(path.join(ffDir, 'facefusion.py'))) {
    onLog('[OK] FaceFusion is already cloned.\n');
  } else {
    onLog('Cloning FaceFusion from GitHub...\n');
    const cloned = await runCmd(
      'git',
      ['clone', 'https://github.com/facefusion/facefusion.git', 'facefusion'],
      vendorDir,
      onLog,
    );
    if (!cloned) {
      onLog('[ERROR] Could not clone the FaceFusion repository.\n');
      onProgress({ step: 'clone-repo', status: 'failed', percent: 45 });
      return false;
    }
    onLog('[OK] FaceFusion cloned successfully.\n');
  }
  onProgress({ step: 'clone-repo', status: 'completed', percent: 50 });

  // ---- Step 3: Set up venv ----
  onProgress({ step: 'setup-venv', status: 'active', percent: 55 });
  onLog('\n=== STEP 3: Setting up the venv virtual environment ===\n');

  const venvDir = path.join(ffDir, 'venv');
  if (fs.existsSync(venvDir)) {
    onLog('[OK] The venv virtual environment already exists.\n');
  } else {
    onLog('Creating the venv environment (python3 -m venv venv)...\n');
    const venvCreated = await runCmd('python3', ['-m', 'venv', 'venv'], ffDir, onLog);
    if (!venvCreated) {
      onLog('[ERROR] Could not create the venv virtual environment.\n');
      onProgress({ step: 'setup-venv', status: 'failed', percent: 65 });
      return false;
    }
  }

  onLog('Upgrading pip inside the venv...\n');
  const pipUpdated = await runCmd(
    './venv/bin/python',
    ['-m', 'pip', 'install', '--upgrade', 'pip'],
    ffDir,
    onLog,
  );
  if (!pipUpdated) {
    onLog('[WARNING] Failed to upgrade pip. Continuing anyway.\n');
  }

  onLog('[OK] venv setup complete.\n');
  onProgress({ step: 'setup-venv', status: 'completed', percent: 75 });

  // ---- Step 4: Install FaceFusion Python dependencies (CoreML) ----
  onProgress({ step: 'install-deps', status: 'active', percent: 80 });
  onLog('\n=== STEP 4: Installing Python dependencies (CoreML) ===\n');

  onLog('Installing packages from requirements.txt (this can take a few minutes)...\n');
  const reqsInstalled = await runCmd(
    './venv/bin/pip',
    ['install', '-r', 'requirements.txt'],
    ffDir,
    onLog,
  );
  if (!reqsInstalled) {
    onLog('[ERROR] Failed to install dependencies from requirements.txt\n');
    onProgress({ step: 'install-deps', status: 'failed', percent: 90 });
    return false;
  }

  onLog('Installing onnxruntime-silicon for CoreML GPU support...\n');
  const onnxSiliconInstalled = await runCmd(
    './venv/bin/pip',
    ['install', 'onnxruntime-silicon'],
    ffDir,
    onLog,
  );
  if (!onnxSiliconInstalled) {
    onLog('[ERROR] Failed to install onnxruntime-silicon\n');
    onProgress({ step: 'install-deps', status: 'failed', percent: 95 });
    return false;
  }

  onLog('[OK] Python dependencies installed successfully.\n');
  onProgress({ step: 'install-deps', status: 'completed', percent: 100 });

  return true;
}

/**
 * GET /api/setup/install
 * Streams installation progress/logs as Server-Sent Events. Two named event
 * types are emitted: "progress" (JSON ProgressEvent) and "log" (JSON-encoded
 * raw text chunk), plus a final "done" event with { success }.
 */
export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const sendEvent = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const success = await runInstall(
          (progress) => sendEvent('progress', progress),
          (text) => sendEvent('log', text),
        );
        sendEvent('done', { success });
      } catch (err) {
        sendEvent('log', `\n[ERROR] ${err instanceof Error ? err.message : String(err)}\n`);
        sendEvent('done', { success: false });
      } finally {
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
