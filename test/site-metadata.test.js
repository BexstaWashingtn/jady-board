import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";

import { createStaticServer } from "../scripts/static-server.js";

const projectUrl = "https://jady-board.vercel.app/";
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

test("sitemap lists the canonical application URL", async () => {
  const sitemap = await readFile(new URL("../sitemap.xml", import.meta.url), "utf8");

  assert.match(sitemap, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.match(sitemap, new RegExp(`<loc>${projectUrl}</loc>`));
  assert.match(sitemap, /<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
});

test("robots.txt permits crawling and advertises the sitemap", async () => {
  const robots = await readFile(new URL("../robots.txt", import.meta.url), "utf8");

  assert.match(robots, /^User-agent: \*\r?\nAllow: \//);
  assert.match(robots, new RegExp(`Sitemap: ${projectUrl}sitemap\\.xml`));
});

test("security.txt provides the required contact and expiry fields", async () => {
  const security = await readFile(
    new URL("../.well-known/security.txt", import.meta.url),
    "utf8",
  );

  assert.match(security, /^Contact: https:\/\//m);
  assert.match(security, /^Expires: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/m);
  assert.match(
    security,
    /^Canonical: https:\/\/jady-board\.vercel\.app\/\.well-known\/security\.txt$/m,
  );
});

test("index.html embeds valid SoftwareApplication JSON-LD", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const match = html.match(
    /<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/,
  );

  assert(match);
  const metadata = JSON.parse(match[1]);
  assert.equal(metadata["@context"], "https://schema.org");
  assert.equal(metadata["@type"], "SoftwareApplication");
  assert.equal(metadata.name, "JaDy Board");
  assert.equal(metadata.url, projectUrl);
  assert.equal(metadata.softwareVersion, "0.9.0");
});

test("static server sends metadata with suitable content types", async () => {
  const expectedTypes = new Map([
    ["/sitemap.xml", "application/xml; charset=utf-8"],
    ["/robots.txt", "text/plain; charset=utf-8"],
    ["/.well-known/security.txt", "text/plain; charset=utf-8"],
  ]);

  for (const [pathname, contentType] of expectedTypes) {
    const response = await fetch(`${origin}${pathname}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), contentType);
  }
});
