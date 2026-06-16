# Nano Battleship

In-browser Battleship with an on-device AI opponent powered by Chrome's Prompt API (Gemini Nano).

See [SPEC.md](./SPEC.md) for the full specification.

## Requirements

- **Node.js 18+** — for local development and building only; the deployed game is static.
- **Any modern browser** — Hunt/Target and Probability bots work everywhere the app loads.
- **AI-Nano opponent** — official **Google Chrome 148+** on desktop (see below).

## Browser compatibility

| Feature | Supported browsers |
|--------|---------------------|
| Core game (both bots) | Recent Chrome, Firefox, Safari, Edge, mobile browsers |
| AI-Nano (Prompt API / Gemini Nano) | **Chrome 148+ desktop only** |

The conventional bots do not need Chrome or Gemini Nano. On mobile or non-Chrome browsers, pick Hunt/Target or Probability — the AI-Nano option stays disabled with an explanation.

### AI-Nano: Gemini Nano & Prompt API

AI-Nano uses Chrome's built-in **Prompt API** (`LanguageModel`) to run **Gemini Nano** entirely on your device. Prompts and responses never leave the browser; there is no server-side AI.

**Supported (no flags, when `LanguageModel` is present):**

- Official **Google Chrome 148+** on desktop
- **Windows 10/11**, **macOS 13+**, **Linux**, or **Chromebook Plus** (ChromeOS 16389.0.0+)

**Not supported:**

- Chrome for **Android** or **iOS**
- ChromeOS on **non–Chromebook Plus** devices
- Chromium, Brave, Edge, and most non-Google builds (usually no `LanguageModel`)
- Machines that fail Chrome's hardware checks (see below)

**Hardware & disk (checked by `LanguageModel.availability()`):**

- ~**22 GB free** on the drive that holds your Chrome profile (for the initial model download)
- **GPU** with more than 4 GB VRAM, **or** **CPU** path with ≥16 GB RAM and ≥4 cores
- **Unmetered network** for the first download only; gameplay works offline afterward

Check model status: open [`chrome://on-device-internals`](chrome://on-device-internals) → **Model Status**.

### Enabling Gemini Nano when the API is behind flags

If `LanguageModel` is undefined or AI-Nano stays unavailable, you may be on an older build or need to enable experimental flags. **Relaunch Chrome after each change.**

1. **Prompt API for Gemini Nano**  
   [`chrome://flags/#prompt-api-for-gemini-nano`](chrome://flags/#prompt-api-for-gemini-nano) → **Enabled** (or **Enabled multilingual**)

2. **Optimization Guide On-Device Model**  
   [`chrome://flags/#optimization-guide-on-device-model`](chrome://flags/#optimization-guide-on-device-model) → **Enabled**  
   If availability still reports `unavailable` on capable hardware, try **Enabled BypassPerfRequirement**.

**Local development** (`localhost`) always requires both flags per [Chrome's built-in AI docs](https://developer.chrome.com/docs/ai/get-started).

**Verify in DevTools console:**

```js
await LanguageModel.availability()
// "available" | "downloadable" | "downloading" | "unavailable"
```

On first use, select AI-Nano (or click **Enable On-Device AI**) to trigger the model download. Progress is shown in the UI; this can take several minutes and several GB.

## Live demo

After deployment: [https://scizor666.github.io/nano-battleship/](https://scizor666.github.io/nano-battleship/)

Requires a modern browser. AI-Nano needs **Chrome 148+ desktop** with Gemini Nano available (see [Browser compatibility](#browser-compatibility)).

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
