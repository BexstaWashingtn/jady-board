import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { createServer } from "node:http";

import { createApiHandler } from "../server/src/http/app.js";

/** @type {import("node:http").Server[]} */
const servers = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))));
});

describe("Server-Health-API", () => {
  test("meldet den laufenden Prozess als gesund", async () => {
    const baseUrl = await listen({ query: async () => ({ rows: [] }) });
    const response = await fetch(`${baseUrl}/api/health`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok" });
    assert.match(response.headers.get("content-type") ?? "", /application\/json/);
  });

  test("meldet eine erreichbare Datenbank als bereit", async () => {
    let query = "";
    const baseUrl = await listen({
      query: async (sql) => {
        query = String(sql);
        return { rows: [{ "?column?": 1 }] };
      },
    });
    const response = await fetch(`${baseUrl}/api/ready`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ready" });
    assert.equal(query, "SELECT 1");
  });

  test("liefert bei Datenbankausfall einen stabilen Fehlervertrag", async () => {
    const baseUrl = await listen({ query: async () => { throw new Error("offline"); } });
    const response = await fetch(`${baseUrl}/api/ready`);

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      status: "unavailable",
      error: {
        code: "DATABASE_UNAVAILABLE",
        message: "Database connection unavailable.",
      },
    });
  });

  test("liefert für unbekannte Routen einen strukturierten 404-Fehler", async () => {
    const baseUrl = await listen({ query: async () => ({ rows: [] }) });
    const response = await fetch(`${baseUrl}/api/unknown`);

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      error: {
        code: "NOT_FOUND",
        message: "The requested API resource does not exist.",
      },
    });
  });
});

describe("Board-Lese-API", () => {
  const userId = "8acf3017-cf6e-589b-bd47-a1d8ccec16a8";
  const boardId = "46ed3b71-86cb-5eb7-a01e-dd5885e41c6a";

  test("verlangt eine konfigurierte Entwicklungsidentität", async () => {
    const baseUrl = await listen({ query: async () => ({ rows: [] }) });
    const response = await fetch(`${baseUrl}/api/boards`);

    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, "IDENTITY_NOT_CONFIGURED");
  });

  test("liefert die zugänglichen Boards des Entwicklungsbenutzers", async () => {
    let receivedUserId = "";
    const boardService = {
      async listBoards(value) { receivedUserId = value; return [{ id: boardId, name: "Board" }]; },
      async getBoard() { return null; },
    };
    const baseUrl = await listenApi({ boardService, currentUserId: userId });
    const response = await fetch(`${baseUrl}/api/boards`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { currentUserId: userId, boards: [{ id: boardId, name: "Board" }] });
    assert.equal(receivedUserId, userId);
  });

  test("validiert Board-IDs und verbirgt unzugängliche Boards", async () => {
    const boardService = { async listBoards() { return []; }, async getBoard() { return null; } };
    const baseUrl = await listenApi({ boardService, currentUserId: userId });

    const invalid = await fetch(`${baseUrl}/api/boards/not-a-uuid`);
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).error.code, "INVALID_BOARD_ID");

    const missing = await fetch(`${baseUrl}/api/boards/${boardId}`);
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).error.code, "BOARD_NOT_FOUND");
  });

  test("liefert ein zugängliches Board", async () => {
    const board = { id: boardId, version: 1, columns: [], tasks: {} };
    const boardService = { async listBoards() { return []; }, async getBoard() { return board; } };
    const baseUrl = await listenApi({ boardService, currentUserId: userId });
    const response = await fetch(`${baseUrl}/api/boards/${boardId}`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { board });
  });

  test("liefert bei unerwarteten Servicefehlern einen stabilen Fehlervertrag", async () => {
    const boardService = {
      async listBoards() { throw new Error("database failed"); },
      async getBoard() { throw new Error("database failed"); },
    };
    const baseUrl = await listenApi({ boardService, currentUserId: userId });

    for (const path of ["/api/boards", `/api/boards/${boardId}`]) {
      const response = await fetch(`${baseUrl}${path}`);
      assert.equal(response.status, 500);
      assert.deepEqual(await response.json(), {
        error: { code: "INTERNAL_ERROR", message: "The request could not be completed." },
      });
    }
  });
});

describe("Task-Schreib-API", () => {
  const userId = "8acf3017-cf6e-589b-bd47-a1d8ccec16a8";
  const boardId = "46ed3b71-86cb-5eb7-a01e-dd5885e41c6a";
  const taskId = "912e8124-aa18-5848-bac7-3486be614b78";

  test("aktualisiert Task-Metadaten und beantwortet CORS-Preflights", async () => {
    let received;
    const boardService = {
      async listBoards() { return []; }, async getBoard() { return null; },
      async updateTask(...args) {
        received = args;
        return { status: /** @type {const} */ ("updated"), task: { id: taskId, title: "Neu", version: 2 } };
      },
    };
    const baseUrl = await listenApi({ boardService, currentUserId: userId });
    const preflight = await fetch(`${baseUrl}/api/boards/${boardId}/tasks/${taskId}`, { method: "OPTIONS" });
    assert.equal(preflight.status, 204);
    assert.match(preflight.headers.get("access-control-allow-methods") ?? "", /PATCH/);
    const body = { title: "Neu", category: "Core", priority: "high", dueDate: null, version: 1 };
    const response = await fetch(`${baseUrl}/api/boards/${boardId}/tasks/${taskId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { task: { id: taskId, title: "Neu", version: 2 } });
    assert.deepEqual(received, [boardId, taskId, userId, body]);
  });

  test("liefert stabile Fehler für ungültige Requests und Versionskonflikte", async () => {
    const boardService = {
      async listBoards() { return []; }, async getBoard() { return null; },
      async updateTask() { return { status: /** @type {const} */ ("conflict") }; },
    };
    const baseUrl = await listenApi({ boardService, currentUserId: userId });
    const invalidId = await fetch(`${baseUrl}/api/boards/no/tasks/${taskId}`, { method: "PATCH", body: "{}" });
    assert.equal(invalidId.status, 400);
    const invalidJson = await fetch(`${baseUrl}/api/boards/${boardId}/tasks/${taskId}`, { method: "PATCH", body: "{" });
    assert.equal(invalidJson.status, 400);
    const conflict = await fetch(`${baseUrl}/api/boards/${boardId}/tasks/${taskId}`, { method: "PATCH", body: "{}" });
    assert.equal(conflict.status, 409);
    assert.equal((await conflict.json()).error.code, "TASK_VERSION_CONFLICT");
  });

  test("verschiebt Tasks und reicht Workflow-Ablehnungen durch", async () => {
    let rejected = false;
    const boardService = {
      async listBoards() { return []; }, async getBoard() { return null; },
      async updateTask() { return { status: /** @type {const} */ ("not_found") }; },
      async moveTask(board, task, user, body) {
        if (rejected) return { status: /** @type {const} */ ("rejected"), code: "WIP_LIMIT_REACHED", message: "Full." };
        assert.deepEqual([board, task, user, body], [boardId, taskId, userId, { stageId: "c358d08d-6fdd-5752-8fe2-a4004c0e5ad9", targetIndex: 2, version: 3 }]);
        return { status: /** @type {const} */ ("moved"), task: { id: taskId, stageId: body.stageId, position: 2, version: 4 } };
      },
    };
    const baseUrl = await listenApi({ boardService, currentUserId: userId });
    const options = { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stageId: "c358d08d-6fdd-5752-8fe2-a4004c0e5ad9", targetIndex: 2, version: 3 }) };
    const response = await fetch(`${baseUrl}/api/boards/${boardId}/tasks/${taskId}/position`, options);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).task.version, 4);
    rejected = true;
    const limited = await fetch(`${baseUrl}/api/boards/${boardId}/tasks/${taskId}/position`, options);
    assert.equal(limited.status, 422);
    assert.equal((await limited.json()).error.code, "WIP_LIMIT_REACHED");
  });
});

/**
 * @param {{query: (sql: unknown) => Promise<unknown>}} database
 */
async function listen(database) {
  const server = createServer(createApiHandler({ database }));
  return start(server);
}

/** @param {{boardService: import("../server/src/modules/boards/board.service.js").BoardService, currentUserId: string}} dependencies */
async function listenApi(dependencies) {
  const server = createServer(createApiHandler({
    database: { query: async () => ({ rows: [] }) },
    ...dependencies,
  }));
  return start(server);
}

/** @param {import("node:http").Server} server */
async function start(server) {
  servers.push(server);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server has no TCP address.");
  return `http://127.0.0.1:${address.port}`;
}
