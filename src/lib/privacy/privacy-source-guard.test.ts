import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const srcRoot = path.resolve(__dirname, "../..");

const forbidden = [
  ["Notification", "requestPermission"].join("."),
  "PushManager",
  "showNotification",
  "setAppBadge",
];

function walk(dir: string, acc: string[] = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, acc);
      continue;
    }
    if (!/\.(ts|tsx|js|jsx)$/.test(entry)) continue;
    if (/\.test\.(ts|tsx)$/.test(entry)) continue;
    acc.push(full);
  }
  return acc;
}

describe("discreet source guard", () => {
  it("does not request notifications, subscribe to push, or set a badge", () => {
    const hits: string[] = [];
    for (const file of walk(srcRoot)) {
      const text = readFileSync(file, "utf8");
      for (const needle of forbidden) {
        if (text.includes(needle)) {
          hits.push(`${path.relative(srcRoot, file)}: ${needle}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it("does not put a song title in document.title", () => {
    const musicRoot = path.join(srcRoot, "features/music");
    const hits: string[] = [];
    for (const file of walk(musicRoot)) {
      const text = readFileSync(file, "utf8");
      if (text.includes("document.title")) {
        hits.push(path.relative(srcRoot, file));
      }
    }
    expect(hits).toEqual([]);
  });
});
