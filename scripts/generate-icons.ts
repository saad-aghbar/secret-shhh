import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "..");
const svg = readFileSync(path.join(root, "src/assets/shhh-icon.svg"), "utf8");

const targets = [
  { file: path.join(root, "public/icon-192.png"), size: 192 },
  { file: path.join(root, "public/icon-512.png"), size: 512 },
  { file: path.join(root, "public/icon-maskable-512.png"), size: 512 },
  { file: path.join(root, "src/app/apple-icon.png"), size: 180 },
];

async function main() {
  mkdirSync(path.join(root, "public"), { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const target of targets) {
    await page.setViewportSize({ width: target.size, height: target.size });
    await page.setContent(
      `<!doctype html><html><body style="margin:0;background:#f3efe8">${svg}</body></html>`,
      { waitUntil: "load" },
    );
    await page.locator("svg").evaluate((node, size) => {
      node.setAttribute("width", String(size));
      node.setAttribute("height", String(size));
    }, target.size);
    const buffer = await page.locator("svg").screenshot({ type: "png", omitBackground: false });
    writeFileSync(target.file, buffer);
  }
  await browser.close();
}

void main();
