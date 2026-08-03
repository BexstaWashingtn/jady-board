import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";

import { clerkFrontendApi, loadClerkBrowser } from "../src/board/board.clerk-session.js";

test("leitet die Clerk Frontend API aus dem Publishable Key ab", () => {
  assert.equal(clerkFrontendApi("pk_test_Y2xlcmsuZXhhbXBsZS5jb20k"), "clerk.example.com");
  assert.throws(() => clerkFrontendApi("invalid"), /publishable key/i);
  assert.throws(() => clerkFrontendApi("pk_test_IUAjJA=="), /Frontend-API-Domain/);
});

test("lädt ClerkJS und Clerk UI von der Instanz des Providers", async () => {
  const scripts = [];
  let loadOptions;
  const clerk = {
    isSignedIn: false,
    session: null,
    load: async (options) => { loadOptions = options; },
    mountSignIn: () => {},
    signOut: async () => {},
  };
  const browser = { Clerk: clerk, __internal_ClerkUICtor: "ui-constructor" };

  const result = await loadClerkBrowser("pk_test_Y2xlcmsuZXhhbXBsZS5jb20k", {
    browser,
    loadScript: async (url, attributes) => { scripts.push({ url, attributes }); },
  });

  assert.equal(result, clerk);
  assert.deepEqual(scripts, [
    { url: "https://clerk.example.com/npm/@clerk/ui@1/dist/ui.browser.js", attributes: {} },
    {
      url: "https://clerk.example.com/npm/@clerk/clerk-js@6/dist/clerk.browser.js",
      attributes: { "data-clerk-publishable-key": "pk_test_Y2xlcmsuZXhhbXBsZS5jb20k" },
    },
  ]);
  assert.deepEqual(loadOptions, { ui: { ClerkUI: "ui-constructor" } });
});

test("fügt die offiziellen Clerk-Skripte ohne Bundler in das Dokument ein", async () => {
  const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>");
  const clerk = {
    load: async () => {}, mountSignIn: () => {}, signOut: async () => {},
  };
  const browser = { Clerk: clerk, __internal_ClerkUICtor: {} };
  const loading = loadClerkBrowser("pk_test_Y2xlcmsuZXhhbXBsZS5jb20k", {
    document: dom.window.document,
    browser,
  });

  await nextTurn();
  const uiScript = dom.window.document.querySelector("script");
  assert.equal(uiScript?.crossOrigin, "anonymous");
  uiScript?.dispatchEvent(new dom.window.Event("load"));
  await nextTurn();
  const scripts = dom.window.document.querySelectorAll("script");
  assert.equal(scripts.length, 2);
  assert.equal(scripts[1].getAttribute("data-clerk-publishable-key"), "pk_test_Y2xlcmsuZXhhbXBsZS5jb20k");
  scripts[1].dispatchEvent(new dom.window.Event("load"));

  assert.equal(await loading, clerk);
});

/** @returns {Promise<void>} */
function nextTurn() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
