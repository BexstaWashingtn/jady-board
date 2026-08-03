import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";

import { createApp } from "../src/core/JaDyDoCo.js";
import { createApiLoginPage } from "../src/templates/api-login.map.js";

test("API-Login maskiert das Token und bietet bewusstes lokales Fortfahren", () => {
  const dom = new JSDOM('<div id="root"></div>');
  const previousDocument = globalThis.document;
  globalThis.document = dom.window.document;
  let submitted = 0;
  let local = 0;
  try {
    createApp("#root").replace(createApiLoginPage({
      apiSource: "https://api.example", error: "Token ungültig",
      submit: (event) => { event.preventDefault(); submitted += 1; },
      useLocal: () => { local += 1; },
    }));
    const input = document.querySelector("input");
    assert.equal(input?.type, "password");
    assert.equal(input?.autocomplete, "current-password");
    assert.match(document.body.textContent ?? "", /ausschließlich für diese Browser-Sitzung/);
    assert.match(document.querySelector('[role="alert"]')?.textContent ?? "", /Token ungültig/);
    document.querySelector("form")?.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
    [...document.querySelectorAll("button")][1].click();
    assert.deepEqual({ submitted, local }, { submitted: 1, local: 1 });
  } finally { globalThis.document = previousDocument; }
});
