# The Gomez Glitch

An auto-generating serialized adventure book: one new chapter per day for 365 days, each with AI-written prose, an illustration, and optional narration. The site is a static reader on GitHub Pages; new pages are produced automatically by a Node.js pipeline and committed by GitHub Actions.

**Tagline:** *Somewhere between yesterday and tomorrow, a family finds the way home — and it's shaped like an island.*

---

## How It Works

The project splits into three parts: **canon**, **generation**, and **reading**.

### 1. Story canon (`story-bible.json`)

The bible holds everything the writer model needs to stay consistent:

- World, tone, logline, and three-act structure (days 1–365)
- Character bios, quirks, and per-character `imagePrompt` strings for illustrations
- Recurring motifs (license plates, Abuela Ida's butterfly, ARIA-7, etc.)
- A **`rollingSummary`** that grows after each page so long-term plot memory does not depend on re-reading all prior chapters

### 2. Daily generation (`scripts/generate.js`)

Each run advances the story by one day:

1. Load `story-bible.json` and `pages/index.json` to determine the next day number (1–365).
2. Build a prompt from the bible, current act, rolling summary, and the **last three pages** of prose for continuity.
3. Call **Claude** (`claude-haiku-4-5-20251001`) and parse a JSON page object: title, glitch name, scene caption, characters, ~600–900 words of story, and a `summaryUpdate` for the bible.
4. Generate an **illustration** from the page's `imageCaption` (see [Image generation](#image-generation) below).
5. Optionally synthesize **narration** MP3 from the page text (see [Audio generation](#audio-generation) below).
6. Save `pages/day-NNN.json`, update `pages/index.json`, and write the new rolling summary back to `story-bible.json`.

Skipped steps are non-fatal: missing Google credentials still produce text; image/audio URLs are simply omitted.

### 3. Automation (GitHub Actions)

`.github/workflows/daily-generate.yml` runs on a schedule (**12:00 UTC**, ~8:00 AM Eastern) and via **workflow_dispatch** (with optional dry run). It installs Node.js, **ffmpeg**, runs `node scripts/generate.js`, then commits new files under `pages/` and `story-bible.json` with a message like `📖 Day 17: Chapter Title`.

### 4. Reader (`index.html`)

A single static page (no build step) that:

- Loads `pages/index.json`, then fetches each `pages/day-NNN.json`
- Shows illustration, optional narration (`audioUrl`) after the image, glitch tag, story body, and character chips (with modal details from `story-bible.json`)
- Sticky top nav with Prev/Next, keyboard arrows, and a timeline scrubber across published days (Prev/Next also at the bottom of each page)

Published assets are served from the repo root on GitHub Pages (e.g. `pages/images/day-001.png`).

---

## Technology Stack

| Layer | Technology | Role |
|--------|------------|------|
| **Hosting** | GitHub Pages | Serves `index.html` and generated assets |
| **Storage** | Git (JSON + binary files in repo) | Versioned story pages, images, audio |
| **Story text** | [Anthropic Claude API](https://docs.anthropic.com/) — `claude-haiku-4-5-20251001` | Daily chapter generation |
| **Images** | [Vertex AI Imagen 3](https://cloud.google.com/vertex-ai/generative-ai/docs/image/overview) via `@google/genai` — `imagen-3.0-generate-002` | Text-to-image illustrations |
| **Audio** | [Google Cloud Text-to-Speech](https://cloud.google.com/text-to-speech) | Neural voice narration (MP3) |
| **Audio tooling** | ffmpeg | Concatenates multiple TTS chunks for long pages |
| **Automation** | GitHub Actions (Node 20, cron + manual trigger) | Daily generate, commit, push |
| **Runtime** | Node.js 18+ (ES modules) | `scripts/generate.js` |
| **Frontend** | Vanilla HTML, CSS, JavaScript | Reader UI; Google Fonts (Unbounded, DM Sans) |

**npm dependencies:** `@anthropic-ai/sdk`, `@google/genai`, `@google-cloud/text-to-speech`, `dotenv` (local dev).

---

## Google Cloud setup (one-time)

Use the same GCP project and service account as Text-to-Speech:

1. **Enable APIs:** Vertex AI API and Cloud Text-to-Speech API.
2. **IAM roles** on the service account:
   - **Vertex AI User** (`roles/aiplatform.user`) — illustrations
   - **Cloud Text-to-Speech User** (`roles/cloudtexttospeech.user`) — narration
3. Set **`GOOGLE_CLOUD_PROJECT`** to your GCP project ID (GitHub secret + local `.env`).

---

## Image Generation

Illustrations are created in `generateImage()` after Claude returns the page JSON.

### Prompt construction

1. **Scene** — Claude's `imageCaption` (one vivid, cinematic sentence).
2. **Characters** — For each character listed on the page, the bible's `imagePrompt` (or `appearance` as fallback) is included so faces and outfits stay consistent across days.
3. **Style** — Global `imageStyle` from `story-bible.json` (animated concept art: thick outlines, warm saturated colors, Spider-Verse / Mitchells vibe).

Example structure:

```text
{imageCaption}. Character reference: {per-character prompts}. {imageStyle}. Keep characters visually consistent.
```

A **negative prompt** excludes photorealism, horror, violence, text, and watermarks.

### API and model

- **Client:** `@google/genai` (`GoogleGenAI` with `vertexai: true`)
- **Model:** `imagen-3.0-generate-002` (override with `GOOGLE_IMAGEN_MODEL`)
- **Region:** `us-central1` by default (override with `GOOGLE_CLOUD_LOCATION`)
- **Parameters:** `numberOfImages: 1`, `aspectRatio: "16:9"`, `negativePrompt`, `safetyFilterLevel: BLOCK_MEDIUM_AND_ABOVE`, `personGeneration: ALLOW_ALL` (family scenes include children)
- **Auth:** Same credentials as TTS — `GOOGLE_SERVICE_ACCOUNT_JSON` or `GOOGLE_APPLICATION_CREDENTIALS`, plus `GOOGLE_CLOUD_PROJECT`

### Output

Imagen returns PNG bytes (base64). Files are saved as `pages/images/day-NNN.png` with `imageUrl` like `pages/images/day-005.png`.

If Google credentials or project ID are missing, or the request fails, generation continues without an image.

---

## Audio Generation

Narration is **pre-generated at build time** (not streamed in the browser). The reader only plays the committed MP3.

### Speech text

`buildSpeechPlainText()` formats:

```text
Day {n}. {chapterTitle}.

{story paragraphs}
```

Markdown is stripped; paragraphs are normalized for TTS.

### Google Cloud TTS

- **Client:** `@google-cloud/text-to-speech` (`TextToSpeechClient`)
- **Credentials:** `GOOGLE_SERVICE_ACCOUNT_JSON` (full JSON in env/secret) or `GOOGLE_APPLICATION_CREDENTIALS` (path to key file locally)
- **Voice:** `GOOGLE_TTS_VOICE` or default `en-US-Neural2-F`
- **Encoding:** MP3 per API chunk

Google limits input size per request (~5 KB UTF-8). Long pages are split with `buildTtsChunks()` (paragraph-aware, then byte-safe splits).

### ffmpeg concatenation

If the page needs more than one TTS request, each chunk is written to a temp file and **ffmpeg** merges them with the concat demuxer (`-c copy`). CI installs ffmpeg in the workflow; local runs need ffmpeg on `PATH` for long chapters.

### Output

Final file: `pages/audio/day-NNN.mp3`, referenced as `audioUrl` on the page JSON.

If Google credentials are missing, TTS fails, or ffmpeg is unavailable for a multi-chunk page, narration is skipped without failing the whole run.

---

## Repository Layout

```text
/
├── index.html              # Reader (GitHub Pages entry)
├── story-bible.json        # Canon + rolling summary
├── package.json
├── .env.example            # Local API keys (do not commit .env)
├── pages/
│   ├── index.json          # Manifest: day → file
│   ├── day-NNN.json        # Page content
│   ├── images/day-NNN.png  # Imagen illustrations
│   └── audio/day-NNN.mp3   # TTS narration (optional)
├── scripts/
│   ├── generate.js         # Daily pipeline
│   └── test-run.js         # Local run (loads .env)
└── .github/workflows/
    └── daily-generate.yml  # Scheduled + manual generation
```

### Page JSON shape

Each `pages/day-NNN.json` includes fields such as:

| Field | Description |
|--------|-------------|
| `day`, `date` | Episode number and ISO date |
| `chapterTitle` | Chapter heading |
| `glitchName` | Named glitch event, or `null` |
| `imageCaption` | Scene description used for image prompt |
| `characters` | Names appearing on the page |
| `text` | Story prose (`\n\n` between paragraphs) |
| `imageUrl` | Relative path to illustration (if generated) |
| `audioUrl` | Relative path to MP3 (if generated) |

---

## Local Development

1. **Clone and install**

   ```bash
   npm install
   cp .env.example .env
   ```

2. **Set environment variables** in `.env`:

   | Variable | Required | Purpose |
   |----------|----------|---------|
   | `ANTHROPIC_API_KEY` | Yes | Claude story generation |
   | `GOOGLE_CLOUD_PROJECT` | For images | GCP project ID for Vertex AI Imagen |
   | `GOOGLE_APPLICATION_CREDENTIALS` or `GOOGLE_SERVICE_ACCOUNT_JSON` | For images + audio | GCP service account |
   | `GOOGLE_CLOUD_LOCATION` | No | Vertex region (default `us-central1`) |
   | `GOOGLE_IMAGEN_MODEL` | No | Imagen model ID (default `imagen-3.0-generate-002`) |
   | `GOOGLE_TTS_VOICE` | No | Override default neural voice |

3. **Run a test generation**

   ```bash
   npm test
   # or: node scripts/generate.js
   ```

   Check `pages/` for new JSON, and optionally `pages/images/` and `pages/audio/`.

4. **Preview the reader** — serve the repo root with any static server, or open `index.html` (local `pages/index.json` is tried before GitHub raw URLs).

---

## GitHub Secrets (CI)

| Secret | Purpose |
|--------|---------|
| `ANTHROPIC_API_KEY` | Claude |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | GCP service account (Vertex AI Imagen + Cloud TTS) |
| `GOOGLE_CLOUD_PROJECT` | GCP project ID for Imagen |

---

## Story at a Glance

**The Gomez Glitch** follows the Gomez family—Anthony, Lulu, Aaliyah, Elijah, and Sully—through **The Cascade**, a temporal fragmentation event where reality loops and skips. Their unplanned, heartfelt chaos stabilizes spacetime; an overzealous travel AI, **ARIA-7**, wants them to stop moving. The year-long arc builds toward a resonance route that ends in Curaçao.

---

*Updated daily. Glitches may occur. The Gomez family is probably fine.*
