import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { describe, test } from "node:test";

import { HttpInputError, isUuid, readJson } from "../server/src/http/http.js";
import { createDevelopmentIdentityResolver } from "../server/src/http/request-identity.js";

describe("HTTP-Eingabevertraege", () => {
  test("liest JSON als bytesicher begrenzten Request-Body", async () => {
    assert.deepEqual(await readJson(Readable.from([Buffer.from('{"title":"Neu"}')])), { title: "Neu" });

    await assert.rejects(
      readJson(Readable.from([Buffer.alloc(64 * 1024 + 1, "x")])),
      (error) => error instanceof HttpInputError && error.code === "PAYLOAD_TOO_LARGE",
    );
  });

  test("unterscheidet ungueltiges JSON von zu grossen Payloads", async () => {
    await assert.rejects(
      readJson(Readable.from(["{"])),
      (error) => error instanceof HttpInputError && error.code === "INVALID_JSON",
    );
  });

  test("validiert UUIDs und kapselt die Entwicklungsidentitaet", async () => {
    const userId = "8acf3017-cf6e-589b-bd47-a1d8ccec16a8";
    assert.equal(isUuid(userId), true);
    assert.equal(isUuid("invalid"), false);
    assert.equal(await createDevelopmentIdentityResolver(userId)(/** @type {never} */ ({})), userId);
  });
});
