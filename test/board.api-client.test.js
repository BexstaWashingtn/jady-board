import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { loadApiWorkspace, readApiDataSource } from "../src/board/board.api-client.js";

describe("Board-API-Client", () => {
  test("aktiviert die API ausschließlich per URL-Opt-in", () => {
    assert.equal(readApiDataSource({ search: "", origin: "http://localhost:4173" }), null);
    assert.equal(readApiDataSource({ search: "?data-source=api", origin: "http://localhost:4173" }), "http://localhost:4173");
    assert.equal(readApiDataSource({ search: "?data-source=api&api-url=http%3A%2F%2Flocalhost%3A3000%2F", origin: "http://localhost:4173" }), "http://localhost:3000");
  });

  test("setzt Board-Details zu einem flüchtigen Client-Workspace zusammen", async () => {
    const requests = [];
    const request = async (url) => {
      requests.push(url);
      if (url.endsWith("/api/boards")) return response({ currentUserId: "user-id", boards: [{ id: "board-id" }] });
      return response({ board: boardResponse() });
    };
    const workspace = await loadApiWorkspace("http://api", request);

    assert.deepEqual(requests, ["http://api/api/boards", "http://api/api/boards/board-id"]);
    assert.equal(workspace.activeBoardId, "board-id");
    assert.equal(workspace.activeUserId, "user-id");
    assert.equal(workspace.boards["board-id"].tasks["task-id"].title, "API Task");
    assert.deepEqual(workspace.users["user-id"].preferences, { theme: "system" });
  });

  test("fällt bei fehlenden Boards und HTTP-Fehlern kontrolliert aus", async () => {
    await assert.rejects(loadApiWorkspace("http://api", async () => response({ boards: [] })), /no accessible boards/);
    await assert.rejects(loadApiWorkspace("http://api", async () => response({}, 503)), /503/);
  });
});

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, async json() { return body; } };
}

function boardResponse() {
  return {
    id: "board-id", version: 1,
    project: { name: "API Board", path: "/api", description: "Test", ownerId: "user-id", memberIds: ["user-id"] },
    members: [{ id: "user-id", name: "API User", initials: "AU", role: "owner" }],
    columns: [{ id: "stage-id", title: "Backlog", color: "blue", kind: "backlog", limit: null, limitMode: "soft", allowedTargetIds: null, requireCompletedTodos: false, taskIds: ["task-id"], version: 1 }],
    tasks: { "task-id": { id: "task-id", key: "API-1", title: "API Task", category: "Test", priority: "medium", comments: 0, todos: [], dueDate: null, assigneeId: "user-id", version: 1 } },
  };
}
