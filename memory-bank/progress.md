# Progress

Working:
- Static reader UI exists in `index.html`.
- Character chips in the reader open detail modals sourced from `story-bible.json`.
- Daily generation script exists in `scripts/generate.js`.
- Story canon and character prompts live in `story-bible.json`.
- GitHub Actions workflow exists for daily generation.
- Prompt-based character image consistency has been added.

Not yet done:
- True reference-image conditioning for characters.
- Dedicated art/reference asset directory.
- Search/filter pages by character or glitch name.
- RSS feed for subscribers.
- Social share card per page (`og:image`).
- Full generator verification after the prompt update, because it would call external APIs and create new page files.
