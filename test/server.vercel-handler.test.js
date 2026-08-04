import assert from "node:assert/strict";
import { test } from "node:test";

import { createVercelHandler } from "../server/src/http/vercel-handler.js";

test("stellt API-Pfad und Query nach dem Vercel-Rewrite wieder her", async () => {
  /** @type {string|undefined} */
  let receivedUrl;
  const handler = createVercelHandler((request, response) => {
    receivedUrl = request.url;
    response.end();
  });
  const request = { url: "/api/index?__path=boards%2Fboard-1&version=2" };
  const response = { end() {} };

  await handler(
    /** @type {import("node:http").IncomingMessage} */ (/** @type {unknown} */ (request)),
    /** @type {import("node:http").ServerResponse} */ (/** @type {unknown} */ (response)),
  );

  assert.equal(receivedUrl, "/api/boards/board-1?version=2");
});

test("reicht direkte Funktionsaufrufe unverändert weiter", async () => {
  /** @type {string|undefined} */
  let receivedUrl;
  const handler = createVercelHandler((request, response) => {
    receivedUrl = request.url;
    response.end();
  });
  const request = { url: "/api/health" };

  await handler(
    /** @type {import("node:http").IncomingMessage} */ (/** @type {unknown} */ (request)),
    /** @type {import("node:http").ServerResponse} */ (/** @type {unknown} */ ({ end() {} })),
  );

  assert.equal(receivedUrl, "/api/health");
});
