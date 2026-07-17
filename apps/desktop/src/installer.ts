import { app } from 'electron';
import {
  runCmd,
  runFaceFusionInstall,
  type InstallStepId,
  type InstallStepStatus,
} from '@meme-swap/installer-core';
import { getWorkspaceRoot } from '@meme-swap/faceswap-core';

type DesktopInstallStepId = InstallStepId | 'build-monorepo';

interface DesktopInstallProgressEvent {
  step: DesktopInstallStepId;
  status: InstallStepStatus;
  percent: number;
}

/**
 * Drives the Electron setup wizard (apps/desktop/src/setup.html): the 5
 * shared FaceFusion install steps from @meme-swap/installer-core (including
 * verify-install, its post-install test swap), plus a desktop-packaging-only
 * step 6 (build-monorepo) that isn't part of "installing FaceFusion" and so
 * stays local to this file.
 */
export async function runInstallation(
  onProgress: (data: DesktopInstallProgressEvent) => void,
  onLog: (text: string) => void,
): Promise<boolean> {
  const root = getWorkspaceRoot();
  onLog(`Starting installation in: ${root}\n`);

  // Shared steps report 0-100 regardless of how many steps produce that range
  // internally; rescale to 0-80 here since step 6 (build-monorepo below) owns
  // the remaining 80-100 of this wizard's bar.
  const success = await runFaceFusionInstall(
    (event) => onProgress({ ...event, percent: Math.round(event.percent * 0.8) }),
    onLog,
  );
  if (!success) return false;

  // ---- Step 6: Build the monorepo (80 -> 100) ----
  // Only meaningful in a dev checkout. The packaged .dmg already ships the
  // built/bundled JS and has no monorepo source, pnpm-workspace.yaml, or even
  // pnpm on the user's machine — there, getWorkspaceRoot() falls back to "/" and
  // `pnpm run build` dies with ERR_PNPM_NO_IMPORTER_MANIFEST_FOUND. Skip it.
  if (app.isPackaged) {
    onLog('\n=== STEP 6: Monorepo already built in the packaged app — skipping ===\n');
    onProgress({ step: 'build-monorepo', status: 'completed', percent: 100 });
    return true;
  }

  onProgress({ step: 'build-monorepo', status: 'active', percent: 90 });
  onLog('\n=== STEP 6: Building the monorepo packages ===\n');

  onLog('Building the monorepo (pnpm run build)...\n');
  const monorepoBuilt = await runCmd('pnpm', ['run', 'build'], root, onLog);
  if (!monorepoBuilt) {
    onLog('[ERROR] Failed to build the monorepo.\n');
    onProgress({ step: 'build-monorepo', status: 'failed', percent: 95 });
    return false;
  }

  onLog('[OK] Monorepo build succeeded.\n');
  onProgress({ step: 'build-monorepo', status: 'completed', percent: 100 });

  return true;
}
