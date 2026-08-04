import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("beschränkt das Vercel-Deployment auf Build-Ausgabe und API-Function", async () => {
  const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));

  assert.equal(config.buildCommand, "npm run build");
  assert.equal(config.outputDirectory, "dist");
  assert.deepEqual(config.functions, { "api/index.js": { maxDuration: 30 } });
  assert.deepEqual(config.rewrites, [{
    source: "/api/:path*",
    destination: "/api/index?__path=:path*",
  }]);
});
