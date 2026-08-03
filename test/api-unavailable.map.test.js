import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";

import { createApp } from "../src/core/JaDyDoCo.js";
import { createApiUnavailablePage } from "../src/templates/api-unavailable.map.js";

test("API-Fehlerzustand verhindert einen stillen lokalen Fallback", () => {
  const dom = new JSDOM('<div id="root"></div>');
  const previousDocument = globalThis.document;
  globalThis.document = dom.window.document;
  let retried = 0;
  let localSelected = 0;
  try {
    const app = createApp("#root");
    app.replace(createApiUnavailablePage({
      apiSource: "http://localhost:3000",
      retry: () => { retried += 1; },
      useLocal: () => { localSelected += 1; },
    }));
    const buttons = [...document.querySelectorAll("button")];
    assert.match(document.body.textContent ?? "", /nicht auf lokale Daten umgeschaltet/);
    assert.equal(document.querySelector('[role="alert"]')?.getAttribute("aria-labelledby"), "startup-error-title");
    buttons[0].click();
    buttons[1].click();
    assert.deepEqual({ retried, localSelected }, { retried: 1, localSelected: 1 });
  } finally {
    globalThis.document = previousDocument;
  }
});
