// ═══════════════════════════════════════════════════════════════
//  THE GOMEZ GLITCH — Daily Story Generator
//  Reads the story bible + page history, generates a new page
//  via Claude API, requests an illustration via Hugging Face,
//  optionally synthesizes narration via Google Cloud Text-to-Speech,
//  then writes the result to /pages/day-NNN.json
// ═══════════════════════════════════════════════════════════════

import Anthropic from "@anthropic-ai/sdk";
import { TextToSpeechClient } from "@google-cloud/text-to-speech";
import { InferenceClient } from "@huggingface/inference";
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ─── CONFIG ────────────────────────────────────────────────────
const CLAUDE_MODEL = "claude-haiku-4-5-20251001"; // cheap + fast
const MAX_TOKENS = 3000; // enough room for 600-900 words plus JSON fields
const PAGES_DIR = path.join(ROOT, "pages");
const BIBLE_PATH = path.join(ROOT, "story-bible.json");
const INDEX_PATH = path.join(PAGES_DIR, "index.json");

const TTS_MAX_CHUNK_BYTES = 4500;
const DEFAULT_TTS_VOICE = "en-US-Neural2-F";

// ─── CLIENTS ───────────────────────────────────────────────────
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ─── HELPERS ───────────────────────────────────────────────────

/** Load and parse JSON file */
function loadJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/** Zero-pad a number to 3 digits */
function pad(n) {
  return String(n).padStart(3, "0");
}

/** Today's date as YYYY-MM-DD */
function todayISO() {
  return new Date().toISOString().split("T")[0];
}

/** Load the last N pages of story text for continuity context */
function loadRecentPages(index, n = 3) {
  const recent = index.pages.slice(-n);
  return recent
    .map((ref) => {
      try {
        const p = loadJSON(path.join(PAGES_DIR, ref.file));
        return `--- DAY ${p.day}: "${p.chapterTitle}" ---\n${p.text}`;
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .join("\n\n");
}

/** Build a compact character reference for the prompt */
function buildCharacterRef(bible) {
  return bible.characters
    .map(
      (c) =>
        `• ${c.name}${c.nickname ? ` (${c.nickname})` : ""}, ${c.role}: ${c.personality} Quirks: ${c.quirks}`
    )
    .join("\n");
}

/** Normalize character names so page output can match first names and nicknames */
function normalizeCharacterName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Build name variants for matching Claude's page character list to bible entries */
function characterAliases(character) {
  const aliases = [character.name, character.name.split(" ")[0]];

  if (character.nickname) {
    const nickname = character.nickname.split(/[—-]/)[0].trim();
    aliases.push(nickname);
  }

  return aliases.map(normalizeCharacterName).filter(Boolean);
}

/** Build the character description block for image generation */
function buildImageCharacterPrompt(bible, pageCharacters = []) {
  const pageCharacterNames = pageCharacters.map(normalizeCharacterName).filter(Boolean);
  const selectedCharacters = pageCharacterNames.length
    ? bible.characters.filter((character) => {
        const aliases = characterAliases(character);
        return pageCharacterNames.some((pageName) => aliases.includes(pageName));
      })
    : bible.characters;

  const charactersForPrompt = selectedCharacters.length ? selectedCharacters : bible.characters;

  return charactersForPrompt
    .map((character) => `${character.name}: ${character.imagePrompt || character.appearance}`)
    .join("; ");
}

/** Build the full generation prompt */
function buildPrompt(bible, index, dayNumber) {
  const recentText = loadRecentPages(index, 3);
  const totalPages = index.pages.length;

  // Which act are we in?
  let currentAct = bible.narrativeStructure.act1;
  if (dayNumber > 75 && dayNumber <= 180)
    currentAct = bible.narrativeStructure.act2a;
  else if (dayNumber > 180 && dayNumber <= 280)
    currentAct = bible.narrativeStructure.act2b;
  else if (dayNumber > 280) currentAct = bible.narrativeStructure.act3;

  return `You are the author of an ongoing sci-fi family adventure story called "${bible.title}".

## STORY BIBLE SUMMARY
Logline: ${bible.logline}
Tone: ${bible.tone}
Tagline: ${bible.tagline}

## THE WORLD
${bible.worldSetting.normalWorld}
The Cascade: ${bible.worldSetting.theGlitch}
Why this family matters: ${bible.worldSetting.whyTheGomezFamily}
The stakes: ${bible.worldSetting.stakes}
The antagonist: ${bible.worldSetting.antagonist}

## CHARACTERS
${buildCharacterRef(bible)}

## RECURRING ELEMENTS (weave these in naturally, not every page)
- License plates: ${bible.recurringElements.licensePlates}
- Abuela Ida's butterfly: ${bible.recurringElements.abuelas_butterfly}
- Curaçao thread: ${bible.recurringElements.curacaoThread}
- Lulu's journal: ${bible.recurringElements.luisanasJournal}
- Sully's bark code: ${bible.recurringElements.sullysBarkCode}
- ARIA-7: ${bible.recurringElements.ARIA7}
- Glitch log: ${bible.recurringElements.theGlitchLog}

## ROLLING STORY SUMMARY
${bible.rollingSummary}

## CURRENT ARC — ${currentAct.title} (Days ${currentAct.days})
${currentAct.summary}

## RECENT PAGES (for continuity)
${recentText || "This is the first page. Begin the story."}

## YOUR TASK
Write Day ${dayNumber} of the story. This is page ${totalPages + 1} of 365.

Rules:
- One self-contained scene, roughly 600-900 words of story prose
- Third-person limited, Aaliyah's POV unless a scene specifically needs another character
- Match the established tone: warm, funny, chaotic, occasionally scary, always full of heart
- Advance the plot meaningfully — something should happen or be revealed
- End on a beat that makes the reader want to come back tomorrow
- Sully is never in serious peril
- Do NOT summarize or recap — write the scene

Respond ONLY with a JSON object in this exact structure (no markdown, no code fences, raw JSON):
{
  "day": ${dayNumber},
  "date": "${todayISO()}",
  "chapterTitle": "A short evocative title for today's page",
  "glitchName": "Aaliyah's name for today's glitch event, if one occurs (null if no glitch today)",
  "imageCaption": "A vivid one-sentence description of the scene to be illustrated — specific, visual, cinematic",
  "characters": ["Names of characters who appear in this page"],
  "text": "The full story prose here, paragraphs separated by \\n\\n",
  "summaryUpdate": "2-3 sentences updating the rolling story summary with what happened today. Write in the same tense and style as the existing summary."
}`;
}

/** Request illustration from Hugging Face Inference API */
async function generateImage(bible, page) {
  const hfToken = process.env.HF_TOKEN;
  if (!hfToken) {
    console.log("⚠️  No HF_TOKEN — skipping image generation");
    return "";
  }

  // Build image prompt from caption + style
  const styleGuide = bible.imageStyle;
  const characterPrompt = buildImageCharacterPrompt(bible, page.characters);
  const prompt = `${page.imageCaption}. Character reference descriptions: ${characterPrompt}. ${styleGuide}. Keep the characters visually consistent with these descriptions across every illustration.`;

  const negativePrompt =
    "realistic, photograph, dark, gloomy, horror, violence, text, watermark, blurry";

  try {
    const hf = new InferenceClient(hfToken);
    const image = await hf.textToImage({
      provider: "auto",
      model: "black-forest-labs/FLUX.1-schnell",
      inputs: prompt,
      parameters: {
        negative_prompt: negativePrompt,
        num_inference_steps: 4, // schnell is fast — 4 steps is enough
        width: 896,
        height: 512,
      },
    });

    // Save image using the content type returned by the selected provider.
    const imagesDir = path.join(PAGES_DIR, "images");
    if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

    const imageBuffer = await image.arrayBuffer();
    const imageExt = image.type === "image/jpeg" ? "jpg" : "png";
    const imagePath = path.join(imagesDir, `day-${pad(page.day)}.${imageExt}`);
    fs.writeFileSync(imagePath, Buffer.from(imageBuffer));

    console.log(`🎨 Image saved: ${imagePath}`);
    // Return relative URL for use in JSON (GitHub Pages serves from root)
    return `pages/images/day-${pad(page.day)}.${imageExt}`;
  } catch (err) {
    console.error("Image generation failed:", err.message);
    return "";
  }
}

/** UTF-8 byte length for Cloud TTS input limits */
function utf8ByteLength(s) {
  return Buffer.byteLength(s, "utf8");
}

/** Strip light markdown / tighten whitespace for speech */
function normalizeTextForSpeech(text) {
  return String(text || "")
    .replace(/\*+([^*]*)\*+/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Full plain text read aloud for one page */
function buildSpeechPlainText(page) {
  const day = page.day ?? "";
  const title = normalizeTextForSpeech(page.chapterTitle || "");
  const paras = (page.text || "")
    .split(/\n\n+/)
    .map((p) => normalizeTextForSpeech(p))
    .filter(Boolean);
  const body = paras.join("\n\n");
  return `Day ${day}. ${title}.\n\n${body}`.trim();
}

/** Split a string into segments each at most maxBytes UTF-8 */
function splitStringToMaxUtf8Bytes(str, maxBytes) {
  const parts = [];
  let rest = str;
  while (rest.length > 0) {
    if (utf8ByteLength(rest) <= maxBytes) {
      parts.push(rest);
      break;
    }
    let lo = 0;
    let hi = rest.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (utf8ByteLength(rest.slice(0, mid)) <= maxBytes) lo = mid;
      else hi = mid - 1;
    }
    let cut = lo;
    if (cut === 0) {
      cut = 1;
      while (cut < rest.length && utf8ByteLength(rest.slice(0, cut + 1)) <= maxBytes) cut++;
    }
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  return parts;
}

/** Build TTS request chunks under the API byte limit */
function buildTtsChunks(fullText, maxBytes = TTS_MAX_CHUNK_BYTES) {
  const trimmed = fullText.trim();
  if (!trimmed) return [];

  const paragraphs = trimmed.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const expanded = [];
  for (const p of paragraphs) {
    if (utf8ByteLength(p) <= maxBytes) expanded.push(p);
    else expanded.push(...splitStringToMaxUtf8Bytes(p, maxBytes));
  }

  const chunks = [];
  let buf = "";
  for (const p of expanded) {
    const candidate = buf ? `${buf}\n\n${p}` : p;
    if (utf8ByteLength(candidate) <= maxBytes) buf = candidate;
    else {
      if (buf) chunks.push(buf);
      buf = p;
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}

function languageCodeFromVoiceName(voiceName) {
  const m = /^([a-z]{2}-[A-Z]{2})/.exec(voiceName);
  return m ? m[1] : "en-US";
}

function createTtsClient() {
  const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (rawJson && rawJson.trim()) {
    try {
      const credentials = JSON.parse(rawJson);
      return new TextToSpeechClient({ credentials });
    } catch {
      console.error("⚠️  GOOGLE_SERVICE_ACCOUNT_JSON is set but not valid JSON — skipping TTS");
      return null;
    }
  }
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyPath && fs.existsSync(keyPath)) {
    return new TextToSpeechClient({ keyFilename: keyPath });
  }
  return null;
}

function mergeMp3WithFfmpeg(tmpDir, partPaths, outPath) {
  const listFile = path.join(tmpDir, "concat.txt");
  const body = partPaths
    .map((p) => {
      const name = path.basename(p);
      return `file '${name.replace(/'/g, "'\\''")}'`;
    })
    .join("\n");
  fs.writeFileSync(listFile, body, "utf8");
  execFileSync(
    "ffmpeg",
    ["-y", "-f", "concat", "-safe", "0", "-i", "concat.txt", "-c", "copy", path.resolve(outPath)],
    { cwd: tmpDir, stdio: "pipe" }
  );
}

/**
 * Synthesize page audio; returns relative URL or "".
 * Requires ffmpeg on PATH when the text splits into multiple chunks.
 */
async function synthesizePageAudio(page, dayNumber) {
  const client = createTtsClient();
  if (!client) {
    console.log("⚠️  No Google TTS credentials — skipping narration");
    return "";
  }

  const speechText = buildSpeechPlainText(page);
  const chunks = buildTtsChunks(speechText);
  if (chunks.length === 0) {
    console.log("⚠️  No speech text — skipping TTS");
    return "";
  }

  const voiceName = process.env.GOOGLE_TTS_VOICE || DEFAULT_TTS_VOICE;
  const languageCode = languageCodeFromVoiceName(voiceName);

  const audioDir = path.join(PAGES_DIR, "audio");
  if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });

  const outFile = path.join(audioDir, `day-${pad(dayNumber)}.mp3`);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gomez-tts-chunks-"));
  const partPaths = [];

  try {
    for (let i = 0; i < chunks.length; i++) {
      const [response] = await client.synthesizeSpeech({
        input: { text: chunks[i] },
        voice: { languageCode, name: voiceName },
        audioConfig: { audioEncoding: "MP3" },
      });
      const content = response.audioContent;
      if (!content || !content.length) {
        throw new Error("Empty audioContent from Google TTS");
      }
      const partPath = path.join(tmpDir, `part-${i}.mp3`);
      fs.writeFileSync(partPath, content);
      partPaths.push(partPath);
    }

    if (partPaths.length === 1) {
      fs.copyFileSync(partPaths[0], outFile);
    } else {
      try {
        mergeMp3WithFfmpeg(tmpDir, partPaths, outFile);
      } catch (err) {
        console.error(
          "TTS: ffmpeg concat failed (install ffmpeg for long pages):",
          err.message
        );
        return "";
      }
    }

    console.log(`🔊 Narration saved: ${outFile}`);
    return `pages/audio/day-${pad(dayNumber)}.mp3`;
  } catch (err) {
    console.error("Text-to-speech failed:", err.message);
    return "";
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

/** Update the rolling summary in the story bible */
function updateBibleSummary(newSummary) {
  const bible = loadJSON(BIBLE_PATH);
  bible.rollingSummary = newSummary;
  fs.writeFileSync(BIBLE_PATH, JSON.stringify(bible, null, 2));
  console.log("📖 Story bible summary updated");
}

/** Update pages/index.json with the new page entry */
function updateIndex(index, dayNumber) {
  index.pages.push({
    day: dayNumber,
    file: `day-${pad(dayNumber)}.json`,
  });
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
  console.log(`📋 Index updated — ${index.pages.length} pages total`);
}

// ─── MAIN ──────────────────────────────────────────────────────

async function main() {
  console.log("✨ The Gomez Glitch — Daily Generator starting...\n");

  // 1. Load bible and index
  if (!fs.existsSync(BIBLE_PATH)) {
    throw new Error(`story-bible.json not found at ${BIBLE_PATH}`);
  }
  const bible = loadJSON(BIBLE_PATH);

  if (!fs.existsSync(INDEX_PATH)) {
    // Bootstrap index if it doesn't exist
    const bootstrapped = { storyTitle: bible.title, storyTagline: bible.tagline, pages: [] };
    fs.mkdirSync(PAGES_DIR, { recursive: true });
    fs.writeFileSync(INDEX_PATH, JSON.stringify(bootstrapped, null, 2));
    console.log("📋 Bootstrapped new pages/index.json");
  }
  const index = loadJSON(INDEX_PATH);

  // 2. Determine today's day number
  const dayNumber = index.pages.length + 1;
  if (dayNumber > 365) {
    console.log("🎉 Story complete — all 365 pages written!");
    process.exit(0);
  }
  console.log(`📅 Generating Day ${dayNumber} of 365...`);

  // 3. Check API key
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }

  // 4. Build prompt and call Claude
  const prompt = buildPrompt(bible, index, dayNumber);
  console.log("🤖 Calling Claude API...");

  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: prompt }],
  });

  if (message.stop_reason === "max_tokens") {
    throw new Error(
      `Claude response reached MAX_TOKENS (${MAX_TOKENS}) before finishing JSON`
    );
  }

  const rawResponse = message.content[0].text.trim();

  // 5. Parse response
  let page;
  try {
    // Strip any accidental markdown fences
    const cleaned = rawResponse
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    page = JSON.parse(cleaned);
  } catch (err) {
    console.error("Failed to parse Claude response:", rawResponse);
    throw new Error(`JSON parse error: ${err.message}`);
  }

  console.log(`📝 Page generated: "${page.chapterTitle}"`);
  if (page.glitchName) console.log(`⚡ Glitch: ${page.glitchName}`);

  // 6. Generate illustration
  console.log("🎨 Requesting illustration...");
  const imageUrl = await generateImage(bible, page);
  page.imageUrl = imageUrl;

  // 7. Narration (Google Cloud TTS)
  console.log("🔊 Synthesizing narration...");
  const audioUrl = await synthesizePageAudio(page, dayNumber);

  // 8. Save the page JSON
  const pageFile = path.join(PAGES_DIR, `day-${pad(dayNumber)}.json`);
  const pageToSave = { ...page };
  delete pageToSave.summaryUpdate; // don't store this in the page file
  if (audioUrl) pageToSave.audioUrl = audioUrl;
  fs.writeFileSync(pageFile, JSON.stringify(pageToSave, null, 2));
  console.log(`💾 Page saved: ${pageFile}`);

  // 9. Update story bible rolling summary
  if (page.summaryUpdate) {
    updateBibleSummary(page.summaryUpdate);
  }

  // 10. Update pages index
  updateIndex(index, dayNumber);

  console.log(`\n✅ Day ${dayNumber} complete!`);
  console.log(`   Title: "${page.chapterTitle}"`);
  console.log(`   Characters: ${(page.characters || []).join(", ")}`);
  console.log(`   Image: ${imageUrl || "(none)"}`);
  console.log(`   Audio: ${audioUrl || "(none)"}`);
}

main().catch((err) => {
  console.error("\n❌ Generator failed:", err.message);
  process.exit(1);
});
