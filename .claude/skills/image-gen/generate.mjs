#!/usr/bin/env node
import { writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../..");
const OUTPUT_DIR = resolve(REPO_ROOT, "public/assets/generated");

const VALID_ASPECTS = new Set([
  "1:1", "3:2", "2:3", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9",
]);

function parseArgs(argv) {
  const args = { aspect: "1:1" };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--prompt") args.prompt = argv[++i];
    else if (k === "--aspect") args.aspect = argv[++i];
    else if (k === "--name") args.name = argv[++i];
    else {
      console.error(`Unknown arg: ${k}`);
      process.exit(2);
    }
  }
  return args;
}

function slugify(s) {
  const slug = s
    .toLowerCase()
    .split(/\s+/)
    .slice(0, 6)
    .join("-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 60);
  return slug || "image";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.prompt) {
    console.error("Missing --prompt");
    process.exit(2);
  }
  if (!VALID_ASPECTS.has(args.aspect)) {
    console.error(`Invalid --aspect "${args.aspect}". Allowed: ${[...VALID_ASPECTS].join(", ")}`);
    process.exit(2);
  }
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error("GOOGLE_API_KEY not set in environment");
    process.exit(2);
  }

  const model = process.env.IMAGE_GEN_MODEL || "gemini-2.5-flash-image";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = {
    contents: [{ parts: [{ text: args.prompt }] }],
    generationConfig: { imageConfig: { aspectRatio: args.aspect } },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`HTTP ${res.status}: ${errText}`);
    process.exit(1);
  }

  const data = await res.json();
  const part = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!part) {
    console.error("No image in response:", JSON.stringify(data).slice(0, 800));
    process.exit(1);
  }

  const buf = Buffer.from(part.inlineData.data, "base64");
  const name = args.name ? slugify(args.name) : slugify(args.prompt);
  const ext = part.inlineData.mimeType?.includes("jpeg") ? "jpg" : "png";
  const filename = `${name}-${Date.now()}.${ext}`;
  const outPath = resolve(OUTPUT_DIR, filename);
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(outPath, buf);
  console.log(outPath);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
