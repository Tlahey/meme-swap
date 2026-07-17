'use strict';

// Ad-hoc code signing for unsigned macOS builds.
//
// We have no Apple Developer ID (and therefore no notarization), so
// electron-builder skips signing entirely — but on Apple Silicon macOS
// refuses to launch a binary that carries *no* signature at all ("app is
// damaged" / killed:9). An ad-hoc signature (`codesign --sign -`) is enough
// to let the app launch once the user clears the download quarantine.
//
// electron-builder runs afterPack after the .app is assembled but before the
// DMG target is built, so the signature ends up inside the shipped .dmg.

const { execFileSync } = require('node:child_process');
const path = require('node:path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);

  console.info(`[afterPack] ad-hoc signing ${appPath}`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], {
    stdio: 'inherit',
  });
};
