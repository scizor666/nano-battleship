# Nano Battleship

In-browser Battleship against two classic algorithmic bots, with **optional**
on-device AI commentary powered by Chrome's Prompt API (Gemini Nano).

See [SPEC.md](./SPEC.md) for the full specification.

## Why the AI only does commentary (and doesn't play)

An earlier version let Gemini Nano **choose the shots**. It played badly — often
like a small child — and no amount of prompt tuning fixed it. That's not a bug in
the prompt; it's a fundamental mismatch between the task and the tool.

**Battleship is a spatial-combinatorial problem, and LLMs are bad at those.**
Optimal play requires:

- holding a 10×10 grid as a stable mental model across many turns,
- enumerating where each remaining ship could legally fit given the hits/misses
  so far,
- counting which untouched cell overlaps the most possible placements (a
  probability-density / parity calculation).

Language models reason over *text*, not over coordinate grids. They don't have an
internal "image" of the board, so they lose track of which cells were already
fired, miscount adjacencies, and pick cells that *sound* plausible in language
space but are spatially poor. Small on-device models like Nano are the weakest at
exactly this — and even large frontier models are mediocre at blind grid
reasoning without a scratchpad or tools.

Worse, this is the part of Battleship that a tiny deterministic algorithm already
solves near-optimally and instantly (see the **Probability Bot**, ~150 lines). So
putting an LLM in the decision seat can only **match or degrade** a much smaller,
faster, more reliable program — while adding latency and unpredictability.

**So we split the two jobs:**

- **The move decision** is made by a classic algorithm (Hunt/Target or
  Probability density). This is where the actual difficulty lives, and where code
  beats an LLM.
- **The talking** — where an LLM genuinely shines — is handled by Nano as an
  optional, kid-friendly commentator ("Captain Quack") that narrates the action
  with light humor. It makes a strong, boring algorithm *feel* alive without ever
  being the bottleneck on quality.

The commentary is screened to stay suitable for ~7-year-olds (no profanity,
insults, or scary content) by both the prompt and a separate profanity filter on
every line; anything that trips the filter is replaced with a safe canned quip.

## Requirements

- **Node.js 18+** — for local development and building only; the deployed game is
  static.
- **Any modern browser** — Hunt/Target and Probability bots work everywhere the
  app loads.
- **AI commentary** — official **Google Chrome 148+** on desktop (see below). The
  game is fully playable without it.

## Browser compatibility

| Feature | Supported browsers |
|--------|---------------------|
| Core game (both bots) | Recent Chrome, Firefox, Safari, Edge, mobile browsers |
| AI commentary (Prompt API / Gemini Nano) | **Chrome 148+ desktop only** |

The bots do not need Chrome or Gemini Nano. On mobile or non-Chrome browsers,
just play the bots — the **Funny AI commentary** toggle stays disabled with an
explanation.

### AI commentary: Gemini Nano & Prompt API

Commentary uses Chrome's built-in **Prompt API** (`LanguageModel`) to run
**Gemini Nano** entirely on your device. Prompts and responses never leave the
browser; there is no server-side AI.

**Supported (no flags, when `LanguageModel` is present):**

- Official **Google Chrome 148+** on desktop
- **Windows 10/11**, **macOS 13+**, **Linux**, or **Chromebook Plus**
  (ChromeOS 16389.0.0+)

**Not supported:**

- Chrome for **Android** or **iOS**
- ChromeOS on **non–Chromebook Plus** devices
- Chromium, Brave, Edge, and most non-Google builds (usually no `LanguageModel`)
- Machines that fail Chrome's hardware checks (see below)

**Hardware & disk (checked by `LanguageModel.availability()`):**

- ~**22 GB free** on the drive that holds your Chrome profile (for the initial
  model download)
- **GPU** with more than 4 GB VRAM, **or** **CPU** path with ≥16 GB RAM and ≥4
  cores
- **Unmetered network** for the first download only; commentary works offline
  afterward

Check model status: open
[`chrome://on-device-internals`](chrome://on-device-internals) → **Model Status**.

### Enabling Gemini Nano when the API is behind flags

If `LanguageModel` is undefined or commentary stays unavailable, you may be on an
older build or need to enable experimental flags. **Relaunch Chrome after each
change.**

1. **Prompt API for Gemini Nano**
   [`chrome://flags/#prompt-api-for-gemini-nano`](chrome://flags/#prompt-api-for-gemini-nano)
   → **Enabled** (or **Enabled multilingual**)

2. **Optimization Guide On-Device Model**
   [`chrome://flags/#optimization-guide-on-device-model`](chrome://flags/#optimization-guide-on-device-model)
   → **Enabled**
   If availability still reports `unavailable` on capable hardware, try **Enabled
   BypassPerfRequirement**.

**Local development** (`localhost`) always requires both flags per
[Chrome's built-in AI docs](https://developer.chrome.com/docs/ai/get-started).

**Verify in DevTools console:**

```js
await LanguageModel.availability()
// "available" | "downloadable" | "downloading" | "unavailable"
```

The first time you enable **Funny AI commentary**, Chrome triggers the model
download. Progress is shown in the UI; this can take several minutes and several
GB.

## Live demo

After deployment: [https://scizor666.github.io/nano-battleship/](https://scizor666.github.io/nano-battleship/)

Requires a modern browser. AI commentary needs **Chrome 148+ desktop** with
Gemini Nano available (see [Browser compatibility](#browser-compatibility)).

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

1. **Hunt/Target Bot** — parity-based hunt with orthogonal targeting after hits.
2. **Probability Bot** — placement-density heatmap targeting; the stronger of the
   two. It reconstructs sunk ships from shot history so it never wastes shots
   around an already-destroyed hull.

Either bot can be paired with the optional **Funny AI commentary** toggle.

## Notes

- First turn is random each match.
- A hit grants another shot until a miss.
- Commentary is **fire-and-forget**: it never blocks or slows a move, and falls
  back to a safe canned line if the model is slow, errors, or produces anything
  that fails the profanity filter.
- AI/debug logs go to the browser console only.
- Settings (opponent choice, mute, commentary) persist in `localStorage`; matches
  do not. A previously stored "AI-Nano" opponent is migrated to a bot on load.

## Tests

```bash
npm test
```

Vitest covers fleet placement rules, turn flow, both bots (including sunk-ship
reconstruction in the Probability Bot), the commentary profanity filter, settings
persistence/migration, and model-availability handling.

## Deployment (GitHub Pages)

Pushes to `main` run tests, build, and deploy via GitHub Actions
(`.github/workflows/deploy.yml`).

1. In the repo **Settings → Pages**, set **Source** to **GitHub Actions**.
2. Push to `main`; the site publishes to `/nano-battleship/` on your `*.github.io`
   domain.

Local production preview with the same base path:

```bash
npm run build
npm run preview
```
