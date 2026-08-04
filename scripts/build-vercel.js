import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "dist");
const publicEntries = [
  ".well-known",
  "assets",
  "src",
  "favicon.svg",
  "index.html",
  "manifest.webmanifest",
  "robots.txt",
  "sitemap.xml",
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await Promise.all(publicEntries.map((entry) => cp(
  resolve(root, entry),
  resolve(output, entry),
  { recursive: true },
)));

process.stdout.write(`Vercel static output created in ${output}\n`);
