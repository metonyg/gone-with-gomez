# Active Context

Current focus: improving the static reader UI after the initial generation pipeline setup.

Recent reader UI change: character chips in `index.html` now open an accessible character detail modal.

Optional page narration: when Google TTS credentials are set, `scripts/generate.js` writes `pages/audio/day-NNN.mp3` and `audioUrl` on each new page; the reader shows a Listen `<audio>` control when that field exists.

Implementation detail: the modal loads canonical character data from `story-bible.json`, falls back to embedded character summaries if fetches fail, and normalizes page character aliases such as `Luisana`, `Lulu`, `Luisana (Lulu) Gomez`, and `Sully 🐾`.

Known limitation: the current setup does not pass actual reference images into the image model.
