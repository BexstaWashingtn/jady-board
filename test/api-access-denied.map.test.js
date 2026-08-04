import assert from "node:assert/strict";
import { test } from "node:test";

import { createApiAccessDeniedPage } from "../src/templates/api-access-denied.map.js";

test("erklärt die getrennte Clerk- und PostgreSQL-Zuordnung", () => {
  const changeAccount = () => {};
  const useLocal = () => {};
  const page = createApiAccessDeniedPage({
    apiSource: "https://api.example.com",
    message: "Identity not linked",
    changeAccount,
    useLocal,
  });
  const card = page.children?.[0];

  assert.equal(card?.children?.[1]?.text, "Noch kein Zugriff");
  assert.match(String(card?.children?.[2]?.text), /Clerk-Anmeldung war erfolgreich/);
  assert.equal(card?.children?.[3]?.text, "Identity not linked");
  assert.match(String(card?.children?.[4]?.text), /PostgreSQL/);
});
