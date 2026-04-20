---
name: image-gen
description: Generate images via Google's Nano Banana (gemini-2.5-flash-image). Use whenever the user asks to create, generate, draw, design, or make any image, icon, illustration, banner, mascot, background, or visual asset in this workspace.
allowed-tools: Bash(node:*), Bash(mv:*), Bash(rm:*), Read
---

# image-gen

Direct integration with Google's Nano Banana image API. Calls the REST endpoint via a small Node helper. No third-party wrappers, no extra LLM round-trips.

## When to use

Any request in this workspace to generate, create, draw, design, or make an image — icons, illustrations, banners, mascots, backgrounds, etc.

## How to call

```bash
node .claude/skills/image-gen/generate.mjs --prompt "<prompt>" [--aspect 1:1] [--name <slug>]
```

- `--prompt` (required): the image description. Be specific about subject, style, colors, composition. Add "no text" if you don't want letters rendered into the image.
- `--aspect` (optional, default `1:1`): one of `1:1`, `3:2`, `2:3`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `16:9`, `21:9`.
- `--name` (optional): output filename slug. If omitted, derived from the first ~6 prompt words.

The helper prints the absolute path of the saved PNG on stdout. It exits non-zero on any error and prints the API response to stderr.

## Output convention

All generated images land in `public/assets/generated/` as a staging area. After generation:

1. **Read** the saved PNG (the Read tool supports image files) to confirm it matches the request.
2. **Decide where it belongs:**
   - App-specific art → `public/assets/images/apps/{appId}.png` (per `DAD.md`)
   - Site-level visuals → `public/assets/images/`
   - Throwaway / didn't turn out → delete from `public/assets/generated/`
3. **Move** the file with `mv` (or delete with `rm`). Confirm the destination with the user if uncertain.

Don't leave staging files lying around if they aren't going to be used.

## Constraints

- All UI is designed at **1280×800 reference resolution** and scales uniformly (see `CLAUDE.md`). For full-screen visuals use `16:9` (closest supported aspect); for app icons use `1:1`.
- Generated assets belong under `public/assets/`, never `src/`. Vite's `publicDir` copies them to `dist/` automatically.

## Cost & watermark

- ~$0.039 per image. Don't generate variations unless the user explicitly asks.
- All output carries Google's invisible **SynthID watermark** for AI-generation attribution. Cannot be disabled.

## Auth

Requires `GOOGLE_API_KEY` in the environment. Configured workspace-locally in `.claude/settings.local.json` (gitignored).

## Model override

Default model is `gemini-2.5-flash-image` (GA). To use a preview model for one invocation:

```bash
IMAGE_GEN_MODEL=gemini-3.1-flash-image-preview node .claude/skills/image-gen/generate.mjs --prompt "..."
```
