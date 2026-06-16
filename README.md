# Nano Battleship

In-browser Battleship with an on-device AI opponent powered by Chrome's Prompt API (Gemini Nano).

See [SPEC.md](./SPEC.md) for the full specification.

## Requirements

- Node.js 18+
- For AI-Nano opponent: official **Google Chrome 148+** on desktop (Windows, macOS, Linux, or Chromebook Plus)

## Live demo

After deployment: [https://scizor666.github.io/nano-battleship/](https://scizor666.github.io/nano-battleship/)

Requires a modern browser. AI-Nano needs official **Chrome 148+** on desktop.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Opponents

1. **Hunt/Target Bot** — parity-based hunt with orthogonal targeting after hits
2. **Probability Bot** — placement-density heatmap targeting
3. **AI-Nano** — on-device Gemini Nano via Chrome Prompt API (when available)

## Notes

- First turn is random each match
- Hit grants another shot until a miss
- AI debug logs go to the browser console only
- Settings (opponent choice, mute) persist in `localStorage`; matches do not

## Tests

```bash
npm test
```

Vitest covers fleet placement rules, turn flow, bots, AI JSON parsing/validation, settings persistence, and AI fallback behavior.

## Deployment (GitHub Pages)

Pushes to `main` run tests, build, and deploy via GitHub Actions (`.github/workflows/deploy.yml`).

1. In the repo **Settings → Pages**, set **Source** to **GitHub Actions**.
2. Push to `main`; the site publishes to `/nano-battleship/` on your `*.github.io` domain.

Local production preview with the same base path:

```bash
npm run build
npm run preview
```
