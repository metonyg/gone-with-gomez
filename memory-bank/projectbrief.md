# Project Brief

The Gomez Glitch is a static, AI-assisted serialized story site.

Core goal: generate and publish one new page per day for a 365-day sci-fi family adventure, each with story text and an illustration.

The project should stay simple, low-cost, and easy to run from GitHub Actions.

Primary source files:
- `story-bible.json` defines story canon, character details, image style, and rolling summary.
- `scripts/generate.js` creates each daily page and illustration.
- `index.html` renders the reader UI from generated JSON files.
