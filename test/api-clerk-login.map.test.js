import assert from "node:assert/strict";
import { test } from "node:test";

import { createClerkLoginPage } from "../src/templates/api-clerk-login.map.js";

test("stellt Clerk als alleinige Anmeldung im API-Modus bereit", () => {
  const useLocal = () => {};
  const page = createClerkLoginPage({ apiSource: "https://api.example.com", error: null, useLocal });
  const card = page.children?.[0];

  assert.equal(card?.children?.[1]?.text, "Anmelden");
  assert.equal(card?.children?.[3]?.id, "clerk-sign-in");
  assert.equal(card?.children?.[4]?.events?.click, useLocal);
  assert.equal(JSON.stringify(page).includes("password"), false);
});

test("zeigt Fehler aus der Clerk-Sitzung zugänglich an", () => {
  const page = createClerkLoginPage({ apiSource: "http://api", error: "Sitzung abgelaufen", useLocal: () => {} });
  const alert = page.children?.[0]?.children?.[3];
  assert.equal(alert?.role, "alert");
  assert.equal(alert?.text, "Sitzung abgelaufen");
});
