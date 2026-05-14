# Tech Context

Runtime: Node.js 18+ with ES modules.

Main dependencies:
- `@anthropic-ai/sdk` for story generation.
- `@huggingface/inference` for image generation.
- `dotenv` for local environment loading.

Automation runs through GitHub Actions in `.github/workflows/daily-generate.yml`.

Required secrets:
- `ANTHROPIC_API_KEY`
- `HF_TOKEN`

Current image model path uses Hugging Face text-to-image with `black-forest-labs/FLUX.1-schnell`.
