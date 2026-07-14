# Contributing to meme-swap

Thanks for your interest in contributing! This document covers the process for making changes to the project.

---

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally
3. Follow the [development guide](./docs/development.md) to set up your environment
4. **Create a branch** off `main`

---

## Branch Naming

```
feature/<description>     # New functionality
fix/<description>         # Bug fixes
refactor/<description>    # Code refactoring without behavior change
docs/<description>        # Documentation-only changes
chore/<description>       # Tooling, config, dependencies
```

Examples:
```
feature/batch-processing
fix/gif-conversion-palette
docs/update-architecture
```

---

## Code Style

All code must follow the rules in [AGENTS.md](./AGENTS.md). Key highlights:

- **TypeScript strict mode** — no `any`, `strict: true` in tsconfig
- **Named exports** — avoid default exports
- **Interfaces over type aliases** — for object shapes
- **Async/await** — no `.then()/.catch()` chains
- **Error handling** — all async operations must have `try/catch`
- **pnpm** — never use `npm` or `yarn`

### Formatting

```bash
pnpm lint     # ESLint check
pnpm format   # Prettier format (if configured)
```

---

## Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

**Types:**

| Type | When to use |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `refactor` | Code change with no behavior change |
| `test` | Adding or updating tests |
| `chore` | Build, tooling, dependencies |
| `style` | Formatting only |

**Examples:**

```
feat(desktop): add system tray menu with quick swap option

fix(faceswap-core): handle missing face landmarks gracefully

docs(readme): update installation steps for FaceFusion 2.x

chore(deps): bump turbo to 2.1.0
```

---

## Pull Request Process

1. Ensure your branch is up to date with `main`
2. Make sure `pnpm build` succeeds with no errors
3. Run `pnpm lint` and resolve any issues
4. Open a PR against `main` with:
   - A clear title following the commit convention
   - A description of *what* changed and *why*
   - Screenshots or recordings for UI changes

### PR Checklist

- [ ] Code follows the [AGENTS.md](./AGENTS.md) rules
- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes
- [ ] No hardcoded paths or credentials
- [ ] Documentation updated if behavior changed
- [ ] No `console.log` left in production code

---

## Project Structure

See [docs/architecture.md](./docs/architecture.md) for the full system diagram and per-app details.

```
apps/
├── frontend/         → Next.js 16 web app
├── desktop/          → Electron desktop app
└── mcp-server/       → MCP server

packages/
├── faceswap-core/    → FaceFusion Python wrapper
├── video-processor/  → FFmpeg wrapper
├── api-client/       → Giphy API client (search + trending)
└── i18n/             → Shared translations
```

---

## Releasing

This is a maintainer-only process (requires push access to `main` and tags). It's two separate steps — nothing here happens automatically end-to-end, and each step that has a real-world effect (making a tag public, publishing a release) requires a deliberate action.

1. **Bump the version, locally**: from `main`, with a clean working tree, run:
   ```bash
   pnpm release 0.3.0
   ```
   This runs [`scripts/prepare-release.mjs`](./scripts/prepare-release.mjs), which bumps every workspace `package.json` to `0.3.0`, runs `pnpm install` to keep the lockfile in sync, and creates a `chore: bump version to 0.3.0` commit plus an annotated `v0.3.0` tag on that exact commit — all locally, nothing pushed yet. It refuses to run on a dirty tree, off `main`, or if the tag already exists.

2. **Review, then push**:
   ```bash
   git show          # sanity-check the version-bump commit
   git push origin main v0.3.0
   ```
   Pushing the tag triggers [`.github/workflows/release.yml`](./.github/workflows/release.yml) on GitHub Actions: it checks out that exact commit, runs `pnpm desktop:package` on a pinned Apple-Silicon runner to build the `.dmg`, and opens a **draft** GitHub Release with the `.dmg` attached and auto-generated release notes. The CI does **not** run `pnpm release` and does **not** bump any versions — it only reacts to a tag that already exists.

3. **Publish**: review the draft release on GitHub (edit the notes if needed, confirm the `.dmg` is attached) and click **Publish** yourself. It stays invisible to the public until this step.

Note: the `.dmg` version baked into the app (`app.getVersion()`, also what the desktop app's update-check banner compares against release tags) comes from `apps/desktop/package.json` specifically, not from the tag string — this is exactly why step 1 exists, so the tag and the `package.json` versions can never drift apart.

---

## Reporting Issues

Please open a GitHub issue with:
- A clear title
- Steps to reproduce
- Expected vs actual behavior
- Relevant logs or screenshots
- Your OS, Node.js version, and Python version
