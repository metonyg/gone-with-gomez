# System Patterns

The project uses a file-based publishing model.

Generation flow:
1. Load `story-bible.json` and `pages/index.json`.
2. Build a Claude prompt with canon, rolling summary, and recent pages.
3. Parse Claude's JSON response.
4. Generate an image through Hugging Face.
5. Save `pages/day-NNN.json`, update `pages/index.json`, and refresh the rolling summary.

The frontend is a single static `index.html` file that reads generated JSON content. Optional per-page MP3 narration is generated alongside each page when Google TTS credentials are configured; the reader shows an `<audio>` control when `audioUrl` is present on a page.

Reader UI pattern: character chips are rendered as buttons and use event delegation to open a character detail modal. The modal fetches `story-bible.json` for canonical character data and uses embedded fallback summaries so sample/offline views still work.

Recent decision: image prompts now use each character's `imagePrompt` from `story-bible.json` instead of a hardcoded family description.
