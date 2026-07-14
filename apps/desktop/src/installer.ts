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
 * Drives the Electron setup wizard (apps/desktop/src/setup.html): the 4
 * shared FaceFusion install steps from @meme-swap/installer-core, plus a
 * desktop-packaging-only step 5 (build-monorepo) that isn't part of
 * "installing FaceFusion" and so stays local to this file.
 */
export async function runInstallation(
  onProgress: (data: DesktopInstallProgressEvent) => void,
  onLog: (text: string) => void,
): Promise<boolean> {
  const root = getWorkspaceRoot();
  onLog(`Starting installation in: ${root}\n`);

  // Shared steps report 0-100; rescale to 0-80 here since step 5
  // (build-monorepo below) owns the remaining 80-100 of this wizard's bar.
  const success = await runFaceFusionInstall(
    (event) => onProgress({ ...event, percent: Math.round(event.percent * 0.8) }),
    onLog,
  );
  if (!success) return false;

  // ---- Step 5: Build the monorepo (80 -> 100) ----
  onProgress({ step: 'build-monorepo', status: 'active', percent: 90 });
  onLog('\n=== STEP 5: Building the monorepo packages ===\n');

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
