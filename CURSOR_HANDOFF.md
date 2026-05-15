# The Gomez Glitch — Cursor Handoff Document

> **Purpose:** This document gives Cursor full context on what was designed and built so far, so it can debug build errors and continue development without losing any decisions already made.

---

## What This Project Is

A web-based, AI-powered serialized story app that generates and publishes **one new page of a sci-fi family adventure story every day for 365 days**, with an accompanying AI-generated illustration. It is fully automated via GitHub Actions, hosted free on GitHub Pages, and costs under $1/year to run.

The story is called **"The Gomez Glitch"** — a warm, funny, Mitchells vs. the Machines-style family adventure about a spontaneous Latino family who accidentally discover they are the only thing holding spacetime together.

---

## Repository Structure

```
/ (repo root)
├── index.html                        # Reader UI — served by GitHub Pages
├── story-bible.json                  # Master story config + rolling summary
├── package.json                      # Node.js dependencies
├── .gitignore
├── .env.example                      # API key template (never commit .env)
│
├── pages/
│   ├── index.json                    # Manifest of all published pages
│   ├── day-001.json                  # First page (and so on)
│   ├── images/
│   │   └── day-001.jpg               # AI-generated illustration per page
│   └── audio/
│       └── day-001.mp3               # Optional Google TTS narration per page
│
├── scripts/
│   ├── generate.js                   # Main daily generation script
│   └── test-run.js                   # Local test runner
│
└── .github/
    └── workflows/
        └── daily-generate.yml        # GitHub Actions cron job
```

---

## Tech Stack

| Layer | Tool | Cost |
|---|---|---|
| Hosting | GitHub Pages | Free |
| Storage / version control | GitHub repo (JSON files) | Free |
| Text generation | Claude API — `claude-haiku-4-5-20251001` | ~$0.001–0.002/day |
| Image generation | Hugging Face Inference Providers via `@huggingface/inference` — FLUX.1-schnell | Free tier / credits |
| Automation | GitHub Actions cron (`0 12 * * *`) | Free (2000 min/mo) |
| Frontend | Vanilla HTML/CSS/JS — no framework | Free |
| Runtime | Node.js 20+, ES Modules (`"type": "module"`) | Free |
| Page audio | Google Cloud Text-to-Speech (pre-generated MP3 in CI) | Pay-as-you-go |

---

## Environment Variables Required

```bash
ANTHROPIC_API_KEY=sk-ant-...   # from console.anthropic.com
HF_TOKEN=hf_...                # from huggingface.co/settings/tokens (read access)
```

Optional narration (Google Cloud TTS): set `GOOGLE_APPLICATION_CREDENTIALS` to a service-account JSON path locally, or set `GOOGLE_SERVICE_ACCOUNT_JSON` to the raw JSON (used in Actions). Enable **Cloud Text-to-Speech API** in GCP and grant the account **Cloud Text-to-Speech User**. Long pages need **ffmpeg** installed to stitch MP3 chunks. Optional: `GOOGLE_TTS_VOICE` (default `en-US-Neural2-F`).

For local dev: copy `.env.example` to `.env` and fill in keys, then use `dotenv` to load them (already configured in `test-run.js`).

For GitHub Actions: add `ANTHROPIC_API_KEY` and `HF_TOKEN` as **repository secrets**. For audio, add **`GOOGLE_SERVICE_ACCOUNT_JSON`** (full service account JSON) under the same place.

---

## How the Generator Works (`scripts/generate.js`)

### Flow — runs once per day

1. **Load** `story-bible.json` and `pages/index.json`
2. **Determine day number** = `index.pages.length + 1`
3. **Build prompt** containing:
   - Story bible summary (logline, tone, world, antagonist)
   - All 5 character descriptions with quirks
   - All recurring elements (license plates, butterfly, Curaçao, etc.)
   - Rolling summary (updated daily — stays compact)
   - Last 3 pages of story text for continuity
   - Which narrative act we're in (1, 2a, 2b, or 3)
4. **Call Claude API** (`claude-haiku-4-5-20251001`, max 3000 tokens)
5. **Parse JSON response** — Claude returns structured data, not prose
6. **Call Hugging Face** FLUX.1-schnell through `@huggingface/inference` for illustration image
7. **Optionally call Google Cloud Text-to-Speech** (if credentials are set) to write `pages/audio/day-NNN.mp3` and set `audioUrl` on the page JSON
8. **Save** `pages/day-NNN.json` with story content
9. **Update** `story-bible.json` rolling summary with today's summary update
10. **Update** `pages/index.json` manifest

### Claude response schema (what the model returns)

```json
{
  "day": 1,
  "date": "2025-01-01",
  "chapterTitle": "Short evocative title",
  "glitchName": "Aaliyah's name for today's glitch, or null",
  "imageCaption": "One-sentence cinematic scene description for illustration",
  "characters": ["Anthony", "Lulu", "Aaliyah", "Elijah", "Sully 🐾"],
  "text": "Full story prose, paragraphs separated by \\n\\n",
  "summaryUpdate": "2-3 sentences updating the rolling summary"
}
```

`summaryUpdate` is used to update `story-bible.json` then **stripped** before saving the page JSON.

---

## The Story Bible (`story-bible.json`)

### Key fields

- `title`: "The Gomez Glitch"
- `tagline`: "Somewhere between yesterday and tomorrow, a family finds the way home — and it's shaped like an island."
- `rollingSummary`: Auto-updated daily — this is the key context-compression mechanism. It replaces itself each day so the prompt never grows unbounded.
- `narrativeStructure`: Four acts with day ranges and summaries
- `characters`: Array of 5 character objects
- `recurringElements`: 7 named recurring story threads
- `imageStyle`: Style guide string appended to every image prompt

### Narrative acts

| Act | Days | Title |
|---|---|---|
| 1 | 1–75 | The Whoopsie Heard Round the World |
| 2a | 76–180 | Collecting the Glitches |
| 2b | 181–280 | ARIA-7 Shows Her Hand |
| 3 | 281–365 | The Long Way Home |

---

## The Five Characters

### Anthony Gomez (father, 41)
- Broad-shouldered, warm brown skin, perpetual stubble, always in a Hawaiian shirt, carries a battered camera bag
- Irrepressibly spontaneous — books flights 40 minutes before leaving the house
- **Collects miniature license plates** from every country/territory — carries a roll-up pegboard. Around Day 90, plates briefly show future destinations during glitches
- Calls his wife **Lulu** exclusively
- His late grandmother **Abuela Ida** appears as a vivid iridescent blue morpho butterfly at meaningful moments
- Quietly dreams of settling in **Curaçao** — has never said it fully out loud

### Luisana "Lulu" Gomez (mother, 39)
- Dark curly hair in chaotic bun with a pen stuck through it, always has 3+ tote bags
- Former investigative journalist — asks questions like one, keeps detailed journals
- **Lulu's journal** becomes a crucial document — her notes contain data Aaliyah needs
- Finds the best coffee in any city within 20 minutes
- Also dreams of Curaçao — secretly browses Willemstad real estate late at night
- The family's emotional anchor and truth-teller

### Aaliyah Gomez (daughter, 13)
- Black and Latina, two big curly puffs, always one earbud in, sticker-covered tablet, notebook full of diagrams
- The protagonist — she figures out The Cascade
- Maintains **the Glitch Log** — names every glitch event (e.g. "The Lisbon Luncheon Loop")
- Oscillates between embarrassment at her family's chaos and fierce hidden pride in them
- Her arc: learning to trust the chaos she grew up in

### Elijah Gomez (son, 7)
- Round cheeks, gravity-defying curls, always holding something random, spectacular accidental outfit choices
- Operates on a frequency adjacent to normal reality — accidentally profound
- Talks to Abuela Ida's butterfly directly. No one stops him
- Has codified **Sully's bark code** and is always right
- Falls asleep instantly in any moving vehicle. Always has a snack

### Sully (dog, 6 months, Cavachon)
- Fluffy, brown-and-white, enormous dark eyes, ears too big for his head, tail in helicopter mode
- **Early warning system** — gravitates toward glitch zones before they're visible
- Three short barks = minor glitch. One long bark = major glitch incoming
- Has stolen food on three continents
- **Sully is never in serious peril** — this is a hard rule

---

## Recurring Story Elements

| Element | Description |
|---|---|
| **The Glitch Log** | Aaliyah names every glitch. The whole family eventually uses her names. |
| **License Plates** | Anthony's collection. Around Day 90, plates show future destinations during glitches. Pays off in Act 3. |
| **Abuela Ida's Butterfly** | Iridescent blue morpho. Appears after glitches stabilize and at meaningful moments. Leads them to Curaçao in the finale. |
| **Curaçao Thread** | The family's unspoken shared dream — a yellow-doored house near Willemstad. The resonance route ends there. |
| **Lulu's Journal** | Her reporter shorthand notes = the data that cracks the Cascade mystery. |
| **Sully's Bark Code** | 3 short = minor glitch. 1 long = major. Elijah codified it. Always correct. |
| **ARIA-7** | The AI antagonist. Communicates via travel apps, hotel TVs, airport screens, billboards. Gets less calm over time. |

---

## The Reader UI (`index.html`)

Single HTML file, no framework, no build step. Loads local `pages/index.json` first, then fetches individual page JSON files from `pages/`. If local fetch fails, it tries the configured GitHub raw URL, then falls back to hardcoded sample data if no generated pages are available.

### Design system
- **Dark sci-fi aesthetic** — deep navy/dark blue backgrounds
- **Color palette:** `--accent: #ff6b35` (orange), `--accent2: #ffd166` (gold), `--cyan: #06d6a0`, `--purple: #9b5de5`
- **Fonts:** Unbounded (headers, labels) + DM Sans (body text) — both from Google Fonts
- **Drop cap** on first paragraph of each page
- **Glitch animation** on the title (CSS keyframes, fires every ~8 seconds)
- **Star field** background via CSS radial gradients
- **Timeline bar** at the bottom — clickable to jump between pages, shows act markers
- **Glitch tag badge** showing Aaliyah's glitch name for the day
- **Character chips** row at the bottom of each page
- **Keyboard nav** — left/right arrow keys

### CONFIG block (must be updated by user)
Near the bottom of `index.html`:
```js
const CONFIG = {
  repoOwner: 'metonyg',
  repoName:  'gone-with-gomez',
  branch:    'main',
  storyTitle:  'The Gomez Glitch',
  storyTagline: 'Somewhere between yesterday and tomorrow...',
};
```

---

## Pages JSON Format

### `pages/index.json`
```json
{
  "storyTitle": "The Gomez Glitch",
  "storyTagline": "...",
  "pages": [
    { "day": 1, "file": "day-001.json" },
    { "day": 2, "file": "day-002.json" }
  ]
}
```

### `pages/day-NNN.json`
```json
{
  "day": 1,
  "date": "2025-01-01",
  "chapterTitle": "Flight to Somewhere Probably",
  "glitchName": "The Lisbon Luncheon Loop",
  "imageUrl": "pages/images/day-001.png",
  "imageCaption": "Lisbon, Portugal. Tuesday, 12:47pm. Again.",
  "characters": ["Anthony", "Lulu", "Aaliyah", "Elijah", "Sully 🐾"],
  "text": "Paragraph one.\\n\\nParagraph two."
}
```

---

## GitHub Actions Workflow

**File:** `.github/workflows/daily-generate.yml`

- **Trigger:** `cron: "0 12 * * *"` (8am ET daily) + manual `workflow_dispatch`
- **Manual trigger** has a `dry_run` option — generates but doesn't commit
- **Permissions:** `contents: write` so it can commit new files
- **Commit message format:** `📖 Day 12: The Oslo Overlap`
- **Steps:** checkout → Node 20 setup → `npm ci` → `node scripts/generate.js` → git add/commit/push

---

## Common Build Issues to Check

1. **ES Module errors** — `package.json` has `"type": "module"`. All files use `import`/`export`, not `require()`. If mixing CJS and ESM, that's the issue.

2. **`dotenv` not loading** — `test-run.js` calls `config()` from `dotenv`. Make sure `dotenv` is in `dependencies` (not just devDependencies) or install it: `npm install dotenv`.

3. **File paths** — `generate.js` uses `__dirname` reconstructed from `import.meta.url`. This is required in ES Modules since `__dirname` isn't natively available.

4. **Anthropic SDK version** — package.json specifies `"@anthropic-ai/sdk": "^0.39.0"`. The client is initialized as `new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })` and messages called via `anthropic.messages.create(...)`.

5. **Hugging Face image generation** — use `@huggingface/inference` with `client.textToImage(...)`. The old raw `https://api-inference.huggingface.co/models/...` POST path can return `Cannot POST /models/...`. Providers may return JPEG or PNG, so save the extension from the returned blob type.

6. **JSON parse failure** — Claude sometimes wraps JSON in markdown fences despite instructions. The script strips ` ```json ` and ` ``` ` before parsing. If still failing, log `rawResponse` to see what's coming back.

7. **GitHub Pages not serving** — must be set to deploy from `main` branch, root `/` directory, under repo Settings → Pages.

8. **Local preview** — the reader fetches `pages/index.json`, which browsers block from `file://`. Use a local server: `npx serve .` or `python -m http.server 8080`. If local fetch fails, the reader tries the configured GitHub raw URL before falling back to sample pages.

---

## What Still Needs Building

- **Step 4 complete — pipeline tested end-to-end with real API keys:**
  - Fresh Day 1 generated locally via `npm test`
  - Claude text generation succeeded
  - Hugging Face image generation succeeded through `@huggingface/inference`
  - `pages/index.json`, `pages/day-001.json`, `pages/images/day-001.jpg`, and `story-bible.json` validated

- **Step 5 complete — GitHub Actions workflow prepared:**
  - Workflow exists at `.github/workflows/daily-generate.yml`
  - `npm ci` dependency install validated locally
  - Workflow hardened so dry runs do not commit and no-change runs exit cleanly
  - Repository secrets set: `ANTHROPIC_API_KEY` and `HF_TOKEN`

- **Steps 6–7 from original plan** (the below are NOT yet built):
  - Step 6: Validate image generation consistency across pages
  - Step 7: Launch — commit everything, enable GitHub Pages, confirm first automated run

- **Nice-to-haves:**
  - Character detail modal when clicking character chips — implemented in `index.html`
  - Search/filter pages by character or glitch name
  - RSS feed for subscribers
  - Social share card per page (og:image)

---

## Tone & Writing Rules (for prompt tuning)

- Third-person limited, Aaliyah's POV unless scene requires otherwise
- Mitchells vs. the Machines meets Doctor Who — warm, funny, chaotic, occasionally scary
- Humor comes from character, not situation
- Sully is NEVER in serious peril
- Elijah's innocence is always protected
- Anthony and Lulu's marriage is solid and affectionate — not a source of conflict
- Every page should end on a beat that makes the reader want to come back tomorrow
- Drop family-specific texture: the license plate collection, Lulu's journal, the butterfly

---

*Generated by Claude Sonnet — May 2026*
