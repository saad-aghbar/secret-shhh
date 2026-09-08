/**
 * Generate small video fixtures. Prefers ffmpeg; falls back to Chromium MediaRecorder (WebM).
 *
 * Usage: pnpm exec tsx scripts/make-video-fixtures.ts
 * Large 64/256 MB files are written under e2e/fixtures/local/ and gitignored.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { chromium } from "@playwright/test";

const fixtures = path.join(process.cwd(), "e2e", "fixtures");
const localDir = path.join(fixtures, "local");

function hasFfmpeg() {
  const result = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
  return result.status === 0;
}

function ffmpegClip(output: string, extra: string[]) {
  const result = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-f",
      "lavfi",
      ...extra,
      "-pix_fmt",
      "yuv420p",
      "-an",
      "-movflags",
      "+faststart",
      output,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || "ffmpeg failed");
  }
}

async function mediaRecorderWebm(output: string, width: number, height: number, ms: number) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const source = `(async () => {
    const w = ${width};
    const h = ${height};
    const durationMs = ${ms};
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    const stream = canvas.captureStream(24);
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
      ? "video/webm;codecs=vp8"
      : "video/webm";
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    const chunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    const started = performance.now();
    function draw(now) {
      const t = (now - started) / 1000;
      ctx.fillStyle = "hsl(" + ((t * 40) % 360) + " 70% 45%)";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#fff";
      ctx.fillRect(20, 20, w / 3, h / 4);
      if (now - started < durationMs) requestAnimationFrame(draw);
    }
    recorder.start(50);
    requestAnimationFrame(draw);
    await new Promise((resolve) => setTimeout(resolve, durationMs + 200));
    await new Promise((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });
    const blob = new Blob(chunks, { type: "video/webm" });
    const buffer = new Uint8Array(await blob.arrayBuffer());
    return Array.from(buffer);
  })()`;
  const bytes = (await page.evaluate(source)) as number[];
  await browser.close();
  if (!bytes?.length) {
    throw new Error("MediaRecorder produced no bytes");
  }
  writeFileSync(output, Buffer.from(bytes));
}

function padTo(source: string, dest: string, size: number) {
  const head = existsSync(source)
    ? readFileSync(source)
    : Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);
  const body = Buffer.alloc(size);
  head.copy(body, 0, 0, Math.min(head.length, size));
  writeFileSync(dest, body);
}

async function main() {
  mkdirSync(fixtures, { recursive: true });
  mkdirSync(localDir, { recursive: true });

  if (hasFfmpeg()) {
    ffmpegClip(path.join(fixtures, "tiny-landscape.mp4"), [
      "-i",
      "color=c=0xC4A574:s=640x360:d=2",
      "-c:v",
      "libx264",
    ]);
    ffmpegClip(path.join(fixtures, "tiny-portrait.mp4"), [
      "-i",
      "color=c=0x8B4A4A:s=360x640:d=2",
      "-c:v",
      "libx264",
    ]);
    ffmpegClip(path.join(fixtures, "tiny-square.mp4"), [
      "-i",
      "color=c=0x5A7A6A:s=480x480:d=2",
      "-c:v",
      "libx264",
    ]);
    console.log("Wrote ffmpeg MP4 fixtures.");
  } else {
    console.log("ffmpeg not found — writing Chromium MediaRecorder WebM fixtures.");
    await mediaRecorderWebm(path.join(fixtures, "tiny-landscape.webm"), 640, 360, 1200);
    await mediaRecorderWebm(path.join(fixtures, "tiny-portrait.webm"), 360, 640, 1200);
    await mediaRecorderWebm(path.join(fixtures, "tiny-square.webm"), 480, 480, 800);
  }

  const small =
    [
      path.join(fixtures, "tiny-landscape.mp4"),
      path.join(fixtures, "tiny-landscape.webm"),
    ].find(existsSync) ?? path.join(fixtures, "tiny-landscape.webm");
  padTo(small, path.join(localDir, "video-64mb.webm"), 64 * 1024 * 1024);
  padTo(small, path.join(localDir, "video-256mb.webm"), 256 * 1024 * 1024);
  console.log("Wrote gitignored 64/256 MB size files under e2e/fixtures/local/");
  console.log(
    "Drop a real iPhone .MOV and a vertical 4K clip into e2e/fixtures/local/ for the codec matrix.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
