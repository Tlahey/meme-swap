# Meme Swap — landing page

Static landing page for the project, published at **https://tlahey.github.io/meme-swap/**.

## Stack

Zero build step, on purpose: plain HTML + CSS + vanilla JS.

| File | Role |
|---|---|
| `index.html` | Page structure & content |
| `styles.css` | Dark Apple-inspired design system (CSS variables at the top) |
| `main.js` | Scroll/mouse parallax, reveal-on-scroll, nav state |
| `assets/` | Logo & app icon (cropped from `docs/assets/logo.png`) |
| `assets/screenshots/` | App screenshots (same files as `docs/assets/screenshots/`) |

Parallax and reveal animations are disabled automatically for users with
`prefers-reduced-motion: reduce`.

## Preview locally

Just open the file — no server required:

```bash
open website/index.html
```

## Deployment

Every push to `main` touching `website/**` triggers
[`.github/workflows/deploy-pages.yml`](../.github/workflows/deploy-pages.yml),
which uploads this folder as-is to GitHub Pages. You can also trigger it
manually from the Actions tab (`workflow_dispatch`).

> **One-time setup:** Settings → Pages → Source → **GitHub Actions**.
