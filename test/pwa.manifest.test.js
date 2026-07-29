import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";

import { createStaticServer } from "../scripts/static-server.js";

/** @type {import("node:http").Server} */
let server;
/** @type {string} */
let origin;

before(async () => {
  server = createStaticServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  const address = server.address();
  assert(address && typeof address === "object");
  origin = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("index.html links the PWA manifest", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /<link rel="manifest" href="\/manifest\.webmanifest" \/>/);
});

test("manifest contains install metadata and accessible icons", async () => {
  const response = await fetch(`${origin}/manifest.webmanifest`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^application\/manifest\+json/);

  const manifest = await response.json();
  assert.equal(manifest.name, "JaDy Board");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.theme_color, "#711521");
  assert(manifest.icons.some((icon) => icon.purpose === "any"));
  assert(manifest.icons.some((icon) => icon.purpose === "maskable"));

  for (const icon of manifest.icons) {
    const iconResponse = await fetch(new URL(icon.src, origin));
    assert.equal(iconResponse.status, 200);
    assert.equal(iconResponse.headers.get("content-type"), icon.type);
  }
});
