# Tech Context

Runtime: Node.js 18+ with ES modules.

Main dependencies:
- `@anthropic-ai/sdk` for story generation.
- `@huggingface/inference` for image generation.
- `@google-cloud/text-to-speech` for optional pre-generated page narration (MP3).
- `dotenv` for local environment loading.

Automation runs through GitHub Actions in `.github/workflows/daily-generate.yml`. The workflow installs **ffmpeg** so long pages can concatenate multiple TTS MP3 chunks.

Required secrets:
- `ANTHROPIC_API_KEY`
- `HF_TOKEN`

Optional (narration): repository secret **`GOOGLE_SERVICE_ACCOUNT_JSON`** — full GCP service account JSON with Cloud Text-to-Speech API enabled and role **Cloud Text-to-Speech User**. Local: `GOOGLE_APPLICATION_CREDENTIALS` pointing at the key file, or `GOOGLE_SERVICE_ACCOUNT_JSON` in `.env`.

Current image model path uses Hugging Face text-to-image with `black-forest-labs/FLUX.1-schnell`.
