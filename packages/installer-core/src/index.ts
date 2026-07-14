import { ChildProcess, execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  FaceswapOptions,
  FaceswapResult,
  getFaceFusionDir,
  getWorkspaceRoot,
  runFaceSwap,
} from '@meme-swap/faceswap-core';
import { gifToMp4 } from '@meme-swap/video-processor';

export type InstallStepId =
  | 'system-checks'
  | 'clone-repo'
  | 'setup-venv'
  | 'install-deps'
  | 'verify-install';
export type InstallStepStatus = 'active' | 'completed' | 'failed';

export interface InstallProgressEvent {
  step: InstallStepId;
  status: InstallStepStatus;
  percent: number;
}

/**
 * Homebrew binaries aren't always on the default Node process PATH (e.g. when
 * the app/dev server is launched from a GUI or IDE rather than a shell that
 * sourced .zshrc/.bash_profile), so we prepend the common Homebrew locations.
 */
function buildAugmentedPath(): string {
  return `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${process.env.PATH ?? ''}`;
}

/**
 * Runs a system command, streaming combined stdout/stderr through onLog.
 * Shared by the FaceFusion install steps below and by consumers with their
 * own extra steps (e.g. apps/desktop/src/installer.ts's build-monorepo step).
 */
export function runCmd(
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

export interface DiskSpaceInfo {
  /** Bytes free on the volume containing os.homedir() (where ~/.meme-swap lives). */
  freeBytes: number;
  /** Total bytes on that volume. */
  totalBytes: number;
  /** Whether freeBytes clears the conservative minimum defined below. */
  meetsMinimum: boolean;
}

/**
 * Conservative floor for "enough room to install FaceFusion". A fresh venv plus
 * its Python deps (onnxruntime, opencv, numpy, etc.) runs roughly 1 GB, and models
 * download lazily as processors get used — face_swapper alone pulls ~1.4 GB, and
 * turning on face_enhancer/frame_enhancer/lip_syncer/expression_restorer on top of
 * that pushes the total toward the "~4 GB" estimate shown in the setup UI. 8 GB is
 * roughly double that, leaving headroom for pip's wheel cache, ffmpeg, and macOS
 * temp scratch space during conversions — generous enough to avoid false alarms
 * without being so loose the check becomes meaningless.
 */
const MINIMUM_FREE_BYTES = 8 * 1024 * 1024 * 1024;

/**
 * Reports free/total disk space on the volume containing ~/.meme-swap. Prefers
 * fs.statfsSync (available since Node 18.15/19.6 — this repo targets >=18, and
 * statfsSync's presence/output was verified directly on the Node version this
 * codebase actually runs), falling back to shelling out to `df -k` and parsing its
 * output, consistent with how the rest of this file already shells out to system
 * tools (see runCmd above) for anything not reliably available as a pure API.
 */
export function checkDiskSpace(): DiskSpaceInfo {
  const target = os.homedir();

  if (typeof fs.statfsSync === 'function') {
    try {
      const stats = fs.statfsSync(target);
      const freeBytes = stats.bavail * stats.bsize;
      const totalBytes = stats.blocks * stats.bsize;
      if (Number.isFinite(freeBytes) && freeBytes > 0 && Number.isFinite(totalBytes) && totalBytes > 0) {
        return { freeBytes, totalBytes, meetsMinimum: freeBytes >= MINIMUM_FREE_BYTES };
      }
    } catch {
      // fs.statfsSync exists but failed (e.g. unsupported filesystem) — fall
      // through to the `df` fallback below.
    }
  }

  return checkDiskSpaceViaDf(target);
}

function checkDiskSpaceViaDf(target: string): DiskSpaceInfo {
  try {
    const output = execSync(`df -k "${target}"`, { encoding: 'utf-8' });
    const lines = output.trim().split('\n');
    const lastLine = lines[lines.length - 1] ?? '';
    // df -k header: Filesystem 1024-blocks Used Available Capacity Mounted-on
    const columns = lastLine.trim().split(/\s+/);
    const totalKb = Number(columns[1]);
    const availableKb = Number(columns[3]);

    if (!Number.isFinite(totalKb) || !Number.isFinite(availableKb)) {
      throw new Error(`Could not parse \`df -k\` output: ${lastLine}`);
    }

    const freeBytes = availableKb * 1024;
    const totalBytes = totalKb * 1024;
    return { freeBytes, totalBytes, meetsMinimum: freeBytes >= MINIMUM_FREE_BYTES };
  } catch {
    // If we genuinely can't determine free space, don't block or scare the user
    // with a false alarm — report it as meeting the minimum and let the install
    // itself fail loudly later if space actually runs out.
    return { freeBytes: -1, totalBytes: -1, meetsMinimum: true };
  }
}

/**
 * Locates the small bundled test asset pair (a face photo + a short GIF, both
 * already used elsewhere as this app's own test fixtures) that the verify-install
 * step below runs a real face swap against. Checked in two places because this
 * function runs in different packaging contexts:
 * - The web app and the `setup-facefusion.mjs` CLI both run inside a full monorepo
 *   checkout, where the assets live under the frontend's `public/` dir.
 * - The packaged Electron app instead ships a Next.js static export (copied in via
 *   apps/desktop/package.json's `build.extraResources`), where files under
 *   `public/` land at the export root rather than staying nested under `public/`.
 */
function resolveTestAssetPaths(workspaceRoot: string): { sourcePath: string; targetPath: string } | null {
  const candidateDirs: string[] = [];

  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  if (resourcesPath) {
    candidateDirs.push(path.join(resourcesPath, 'apps', 'frontend', 'out', 'test-images'));
  }

  candidateDirs.push(path.join(workspaceRoot, 'apps', 'frontend', 'public', 'test-images'));

  for (const dir of candidateDirs) {
    const sourcePath = path.join(dir, 'source.jpg');
    const targetPath = path.join(dir, 'target.gif');
    if (fs.existsSync(sourcePath) && fs.existsSync(targetPath)) {
      return { sourcePath, targetPath };
    }
  }

  return null;
}

/**
 * FaceFusion downloads its model weights lazily on first real inference, so the
 * verify-install step below can take several minutes on a machine that has never
 * run a swap before (see the onLog message where it's invoked). We still bound it
 * with a generous timeout — if the process hangs outright rather than just being
 * slow, the wizard should report a clear timeout failure instead of spinning
 * forever.
 */
const VERIFY_SWAP_TIMEOUT_MS = 15 * 60 * 1000;

function runFaceSwapWithTimeout(options: FaceswapOptions, timeoutMs: number): Promise<FaceswapResult> {
  return new Promise((resolve) => {
    let settled = false;
    let child: ChildProcess | undefined;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child?.kill('SIGKILL');
      resolve({
        success: false,
        error: `Test swap timed out after ${Math.round(timeoutMs / 1000)}s`,
      });
    }, timeoutMs);

    runFaceSwap({
      ...options,
      onProcessStart: (proc) => {
        child = proc;
      },
    })
      .then((result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ success: false, error: err instanceof Error ? err.message : String(err) });
      });
  });
}

/**
 * Runs the 5 shared install steps (system-checks, clone-repo, setup-venv,
 * install-deps, verify-install) that get FaceFusion cloned, venv'd, its Python
 * deps installed, and its CoreML/onnxruntime path exercised end-to-end. Used
 * as-is by the web installer (apps/frontend/app/api/setup/install/route.ts) and
 * the CLI installer (scripts/setup-facefusion.mjs), and wrapped with an extra
 * desktop-packaging step by apps/desktop/src/installer.ts.
 */
export async function runFaceFusionInstall(
  onProgress: (event: InstallProgressEvent) => void,
  onLog: (text: string) => void,
): Promise<boolean> {
  const root = getWorkspaceRoot();

  // ---- Step 1: System checks (Homebrew, Python, FFmpeg) ----
  onProgress({ step: 'system-checks', status: 'active', percent: 2 });
  onLog('=== STEP 1: Checking Homebrew, Python and FFmpeg ===\n');

  onLog('Looking for python3...\n');
  const hasPython = await runCmd('python3', ['--version'], root, onLog);
  if (!hasPython) {
    onLog('[ERROR] Python 3 is not installed on this Mac. Please install it before continuing.\n');
    onProgress({ step: 'system-checks', status: 'failed', percent: 8 });
    return false;
  }

  onLog('Looking for Homebrew...\n');
  const hasBrew = await runCmd('which', ['brew'], root, onLog);
  if (!hasBrew) {
    onLog(
      '[ERROR] Homebrew is required but was not found. Install it from https://brew.sh, then retry setup.\n',
    );
    onProgress({ step: 'system-checks', status: 'failed', percent: 8 });
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
      onProgress({ step: 'system-checks', status: 'failed', percent: 12 });
      return false;
    }
  } else {
    onLog('[OK] FFmpeg already installed via Homebrew.\n');
  }

  onLog('[OK] System checks passed.\n');
  onProgress({ step: 'system-checks', status: 'completed', percent: 20 });

  // ---- Step 2: Clone FaceFusion ----
  onProgress({ step: 'clone-repo', status: 'active', percent: 22 });
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
      onProgress({ step: 'clone-repo', status: 'failed', percent: 32 });
      return false;
    }
    onLog('[OK] FaceFusion cloned successfully.\n');
  }
  onProgress({ step: 'clone-repo', status: 'completed', percent: 40 });

  // ---- Step 3: Set up venv ----
  onProgress({ step: 'setup-venv', status: 'active', percent: 42 });
  onLog('\n=== STEP 3: Setting up the venv virtual environment ===\n');

  // Pip upgrade/install only need to run the first time the venv is created —
  // once it exists, its dependencies were already installed by a prior run, so
  // re-running pip here would just be slow, redundant network/CPU work (and,
  // per the original scripts/setup-facefusion.sh, "venv exists" already means
  // "fully installed, nothing left to do").
  const venvDir = path.join(ffDir, 'venv');
  const venvAlreadyExisted = fs.existsSync(venvDir);
  if (venvAlreadyExisted) {
    onLog('[OK] The venv virtual environment already exists.\n');
  } else {
    onLog('Creating the venv environment (python3 -m venv venv)...\n');
    const venvCreated = await runCmd('python3', ['-m', 'venv', 'venv'], ffDir, onLog);
    if (!venvCreated) {
      onLog('[ERROR] Could not create the venv virtual environment.\n');
      onProgress({ step: 'setup-venv', status: 'failed', percent: 52 });
      return false;
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
  }

  onLog('[OK] venv setup complete.\n');
  onProgress({ step: 'setup-venv', status: 'completed', percent: 60 });

  // ---- Step 4: Install FaceFusion Python dependencies (CoreML) ----
  onProgress({ step: 'install-deps', status: 'active', percent: 62 });
  onLog('\n=== STEP 4: Installing Python dependencies (CoreML) ===\n');

  if (venvAlreadyExisted) {
    onLog('[OK] Dependencies were already installed in a previous run. Skipping.\n');
  } else {
    onLog('Installing packages from requirements.txt (this can take a few minutes)...\n');
    const reqsInstalled = await runCmd(
      './venv/bin/pip',
      ['install', '-r', 'requirements.txt'],
      ffDir,
      onLog,
    );
    if (!reqsInstalled) {
      onLog('[ERROR] Failed to install dependencies from requirements.txt\n');
      onProgress({ step: 'install-deps', status: 'failed', percent: 72 });
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
      onProgress({ step: 'install-deps', status: 'failed', percent: 76 });
      return false;
    }
  }

  onLog('[OK] Python dependencies installed successfully.\n');
  onProgress({ step: 'install-deps', status: 'completed', percent: 80 });

  // ---- Step 5: Verify the install with a real test swap ----
  // pip succeeding doesn't prove CoreML/onnxruntime actually works at inference
  // time, and models download lazily on first real use — so this step runs the
  // literal production pipeline (gifToMp4 + runFaceSwap, face_swapper only) against
  // small bundled test assets, forcing that first-run download to happen here
  // instead of silently surprising the user during their first real swap later.
  onProgress({ step: 'verify-install', status: 'active', percent: 82 });
  onLog('\n=== STEP 5: Verifying the install with a test face swap ===\n');
  onLog(
    'Running a test swap to verify CoreML/onnxruntime actually works. FaceFusion downloads its ' +
      'AI models the first time they are needed, so this can take a few minutes on a fresh install ' +
      '— this is expected, not a hang.\n',
  );

  const testAssets = resolveTestAssetPaths(root);
  if (!testAssets) {
    onLog('[ERROR] Could not find the bundled test assets used to verify the install.\n');
    onProgress({ step: 'verify-install', status: 'failed', percent: 90 });
    return false;
  }

  const verifyTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'meme-swap-verify-'));
  const scratchTargetMp4 = path.join(verifyTempDir, 'target.mp4');
  const scratchOutputMp4 = path.join(verifyTempDir, 'output.mp4');

  try {
    onLog('Converting the test GIF to MP4...\n');
    const conversion = await gifToMp4({
      inputPath: testAssets.targetPath,
      outputPath: scratchTargetMp4,
    });
    if (!conversion.success) {
      onLog(`[ERROR] Failed to prepare the test video: ${conversion.error}\n`);
      onProgress({ step: 'verify-install', status: 'failed', percent: 90 });
      return false;
    }

    onLog('Running a face swap against the test assets (face_swapper only, no extras)...\n');
    const swapResult = await runFaceSwapWithTimeout(
      {
        sourcePath: testAssets.sourcePath,
        targetPath: scratchTargetMp4,
        outputPath: scratchOutputMp4,
        faceSwapperModel: 'inswapper_128_fp16',
      },
      VERIFY_SWAP_TIMEOUT_MS,
    );

    if (!swapResult.success) {
      onLog(`[ERROR] Test swap failed: ${swapResult.error}\n`);
      onProgress({ step: 'verify-install', status: 'failed', percent: 95 });
      return false;
    }

    onLog('[OK] Test swap succeeded — CoreML/onnxruntime is working correctly.\n');
  } finally {
    fs.rmSync(verifyTempDir, { recursive: true, force: true });
  }

  onProgress({ step: 'verify-install', status: 'completed', percent: 100 });

  return true;
}
