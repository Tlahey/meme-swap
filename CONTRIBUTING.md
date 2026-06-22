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
├── frontend/         → Next.js 14 web app
├── desktop/          → Electron desktop app
├── mcp-server/       → MCP server
└── raycast-extension/→ Raycast extension (planned)

packages/
├── faceswap-core/    → FaceFusion Python wrapper
├── video-processor/  → FFmpeg wrapper
├── api-client/       → Giphy API client (placeholder)
└── i18n/             → Shared translations
```

---

## Reporting Issues

Please open a GitHub issue with:
- A clear title
- Steps to reproduce
- Expected vs actual behavior
- Relevant logs or screenshots
- Your OS, Node.js version, and Python version
