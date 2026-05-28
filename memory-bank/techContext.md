# Tech Context

Runtime: Node.js 18+ with ES modules.

Main dependencies:
- `@anthropic-ai/sdk` for story generation.
- `@google/genai` for image generation (Vertex AI Imagen 3).
- `@google-cloud/text-to-speech` for optional pre-generated page narration (MP3).
- `dotenv` for local environment loading.

Automation runs through GitHub Actions in `.github/workflows/daily-generate.yml`. The workflow installs **ffmpeg** so long pages can concatenate multiple TTS MP3 chunks.

Required secrets:
- `ANTHROPIC_API_KEY`
- `GOOGLE_SERVICE_ACCOUNT_JSON` — GCP service account JSON (Vertex AI User + Cloud Text-to-Speech User roles)
- `GOOGLE_CLOUD_PROJECT` — GCP project ID for Imagen

Optional (narration/images): `GOOGLE_CLOUD_LOCATION`, `GOOGLE_IMAGEN_MODEL`, `GOOGLE_TTS_VOICE`. Local: `GOOGLE_APPLICATION_CREDENTIALS` pointing at the key file, or `GOOGLE_SERVICE_ACCOUNT_JSON` in `.env`.

Current image model path uses Vertex AI Imagen with `imagen-3.0-generate-002` via `@google/genai` `models.generateImages()`.
