import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

// Bumps every workspace package.json to the same version, commits and tags
// that commit in one atomic step, so a `vX.Y.Z` tag can never point at a
// commit where package.json still says something else. The GitHub Actions
// release workflow (.github/workflows/release.yml) only reacts to the tag —
// it never edits versions itself — so this script is the single source of
// truth for keeping the two in sync.

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('Usage: pnpm release <version>  (e.g. pnpm release 0.3.0)');
  process.exit(1);
}

function run(cmd) {
  execSync(cmd, { stdio: 'inherit' });
}

function output(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

// --untracked-files=no: stray untracked files/dirs (e.g. scratch notes, editor
// state) shouldn't block a release — only uncommitted changes to files git
// already tracks should.
const status = output('git status --porcelain --untracked-files=no');
if (status) {
  console.error('Working tree has uncommitted changes. Commit or stash them first.');
  process.exit(1);
}

const branch = output('git branch --show-current');
if (branch !== 'main') {
  console.error(`Must be on "main" to cut a release (currently on "${branch}").`);
  process.exit(1);
}

const existingTags = output('git tag -l').split('\n');
if (existingTags.includes(`v${version}`)) {
  console.error(`Tag v${version} already exists.`);
  process.exit(1);
}

function workspacePackageJsons(dir) {
  return readdirSync(dir)
    .map((name) => path.join(dir, name, 'package.json'))
    .filter((p) => {
      try {
        return statSync(p).isFile();
      } catch {
        return false;
      }
    });
}

const packageJsonPaths = [
  'package.json',
  ...workspacePackageJsons('apps'),
  ...workspacePackageJsons('packages'),
];

console.log(`Bumping ${packageJsonPaths.length} package.json files to ${version}:\n`);

// Deliberately NOT JSON.parse + JSON.stringify: that would re-serialize the
// whole file and reformat anything that doesn't match JSON.stringify's
// output style (e.g. apps/desktop/package.json writes short arrays like
// ["dmg"] on one line, which JSON.stringify always expands across lines),
// turning a version-bump commit into a noisy unrelated-reformatting diff.
// A targeted regex replace touches only the "version" line, byte-for-byte
// identical otherwise.
const versionFieldPattern = /"version":\s*"[^"]*"/;

for (const relPath of packageJsonPaths) {
  const raw = readFileSync(relPath, 'utf8');
  const match = raw.match(versionFieldPattern);
  if (!match) {
    console.error(`\n${relPath} has no "version" field — aborting before any file is written.`);
    process.exit(1);
  }
  const oldVersion = match[0].match(/"([^"]*)"$/)[1];
  if (oldVersion === version) {
    console.error(`\n${relPath} is already at ${version} — aborting before any file is written.`);
    process.exit(1);
  }
  const updated = raw.replace(versionFieldPattern, `"version": "${version}"`);
  writeFileSync(relPath, updated);
  console.log(`  ${relPath}: ${oldVersion} -> ${version}`);
}

console.log('\nRunning pnpm install to keep the lockfile in sync...');
run('pnpm install');

run(`git add ${packageJsonPaths.map((p) => `"${p}"`).join(' ')} pnpm-lock.yaml`);
run(`git commit -m "chore: bump version to ${version}"`);
run(`git tag -a v${version} -m "v${version}"`);

console.log(
  `\nDone — commit and tag v${version} created locally. Review with \`git show\`, then push:\n`,
);
console.log(`  git push origin main v${version}\n`);
console.log(
  'Pushing the tag triggers .github/workflows/release.yml, which builds the .dmg from this exact',
);
console.log('commit and opens a draft GitHub Release (you still click "Publish" yourself).');
