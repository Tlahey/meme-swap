import { runFaceFusionInstall } from '@meme-swap/installer-core';

const success = await runFaceFusionInstall(
  ({ step, status, percent }) => {
    process.stdout.write(`\n=== ${step} (${status}, ${percent}%) ===\n`);
  },
  (text) => {
    process.stdout.write(text);
  },
);

process.exit(success ? 0 : 1);
