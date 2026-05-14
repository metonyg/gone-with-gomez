# System Patterns

The project uses a file-based publishing model.

Generation flow:
1. Load `story-bible.json` and `pages/index.json`.
2. Build a Claude prompt with canon, rolling summary, and recent pages.
3. Parse Claude's JSON response.
4. Generate an image through Hugging Face.
5. Save `pages/day-NNN.json`, update `pages/index.json`, and refresh the rolling summary.

The frontend is a single static `index.html` file that reads generated JSON content.

Recent decision: image prompts now use each character's `imagePrompt` from `story-bible.json` instead of a hardcoded family description.
