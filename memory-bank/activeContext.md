# Active Context

Current focus: improving image consistency for generated daily illustrations.

Decision made: start with prompt-only consistency by reusing the per-character `imagePrompt` fields already present in `story-bible.json`.

Implementation status: `scripts/generate.js` now builds image prompts from matched page characters and falls back to all characters if matching fails.

Known limitation: the current setup does not pass actual reference images into the image model.
