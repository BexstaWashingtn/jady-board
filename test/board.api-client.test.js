import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { assignApiTask, createApiStage, createApiTask, deleteApiStage, deleteApiTask, loadApiAuthConfig, loadApiWorkspace, moveApiStage, moveApiTask, readApiDataSource, syncApiTaskTodos, updateApiBoard, updateApiStage, updateApiTask } from "../src/board/board.api-client.js";

describe("Board-API-Client", () => {
  test("lädt die öffentliche Clerk-Konfiguration ohne Sitzung", async () => {
    const config = await loadApiAuthConfig("http://api", async (url) => {
      assert.equal(url, "http://api/api/auth/config");
      return response({ mode: "clerk", publishableKey: "pk_test_example" });
    });

    assert.deepEqual(config, { mode: "clerk", publishableKey: "pk_test_example" });
    await assert.rejects(
      loadApiAuthConfig("http://api", async () => response({ mode: "clerk" })),
      /Clerk configuration is invalid/,
    );
  });

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
    assert.equal(workspace.boards["board-id"].version, 1);
    assert.equal(workspace.boards["board-id"].tasks["task-id"].title, "API Task");
    assert.deepEqual(workspace.users["user-id"].preferences, { theme: "system" });
  });

  test("fällt bei fehlenden Boards und HTTP-Fehlern kontrolliert aus", async () => {
    await assert.rejects(loadApiWorkspace("http://api", async () => response({ boards: [] })), /no accessible boards/);
    await assert.rejects(loadApiWorkspace("http://api", async () => response({}, 503)), /503/);
  });

  test("speichert Task-Metadaten mit der aktuellen Server-Version", async () => {
    let received;
    const task = boardResponse().tasks["task-id"];
    const updated = await updateApiTask("http://api", "board/id", task, async (url, options) => {
      received = { url, options };
      return response({ task: { id: "task-id", title: "API Task", version: 2 } });
    });
    assert.equal(received.url, "http://api/api/boards/board%2Fid/tasks/task-id");
    assert.equal(received.options.method, "PATCH");
    assert.deepEqual(JSON.parse(received.options.body), {
      title: "API Task", category: "Test", priority: "medium", dueDate: null, version: 1,
    });
    assert.equal(updated.version, 2);
  });

  test("übersetzt Versionskonflikte in eine verständliche Meldung", async () => {
    const task = boardResponse().tasks["task-id"];
    await assert.rejects(
      updateApiTask("http://api", "board-id", task, async () => response({ error: { code: "TASK_VERSION_CONFLICT" } }, 409)),
      /zwischenzeitlich geändert/,
    );
  });

  test("verschiebt Tasks mit Version und Zielposition", async () => {
    const task = boardResponse().tasks["task-id"];
    let requestBody;
    const moved = await moveApiTask("http://api", "board-id", task, "done", 2, async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return response({ task: { id: "task-id", stageId: "done", position: 2, version: 2 } });
    });
    assert.deepEqual(requestBody, { stageId: "done", targetIndex: 2, version: 1 });
    assert.deepEqual(moved, { id: "task-id", stageId: "done", position: 2, version: 2 });
  });

  test("erstellt Tasks und übernimmt die Serveridentität", async () => {
    const draft = boardResponse().tasks["task-id"];
    let requestBody;
    const created = await createApiTask("http://api", "board-id", draft, "stage-id", async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return response({ task: { ...draft, id: "server-task-id", version: 1 } }, 201);
    });
    assert.deepEqual(requestBody, { stageId: "stage-id", title: "API Task", category: "Test", priority: "medium", assigneeId: "user-id", dueDate: null });
    assert.equal(created.id, "server-task-id");
  });

  test("persistiert Task-Zuweisungen versioniert", async () => {
    const task = { ...boardResponse().tasks["task-id"], assigneeId: null };
    let requestBody;
    const assigned = await assignApiTask("http://api", "board-id", task, async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return response({ task: { assigneeId: null, version: 2 } });
    });
    assert.deepEqual(requestBody, { assigneeId: null, version: 1 });
    assert.equal(assigned.version, 2);
  });

  test("synchronisiert die vollständige Todo-Liste", async () => {
    const task = { ...boardResponse().tasks["task-id"], todos: [{ id: "todo", text: "Test", completed: true }] };
    let requestBody;
    const saved = await syncApiTaskTodos("http://api", "board-id", task, async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return response({ task: { todos: task.todos, version: 2 } });
    });
    assert.deepEqual(requestBody, { todos: task.todos, version: 1 });
    assert.equal(saved.version, 2);
  });

  test("löscht Tasks mit ihrer aktuellen Version", async () => {
    let received;
    await deleteApiTask("http://api", "board-id", boardResponse().tasks["task-id"], async (url, options) => {
      received = { url, method: options.method };
      return { ok: true, status: 204 };
    });
    assert.deepEqual(received, { url: "http://api/api/boards/board-id/tasks/task-id?version=1", method: "DELETE" });
  });

  test("speichert Stage-Einstellungen versioniert", async () => {
    const stage = { ...boardResponse().columns[0], color: "#336699" };
    let requestBody;
    const saved = await updateApiStage("http://api", "board-id", stage, async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return response({ stage: { ...stage, version: 2 } });
    });
    assert.equal(requestBody.version, 1);
    assert.equal(requestBody.color, "#336699");
    assert.equal(saved.version, 2);
  });

  test("erstellt Stages und übernimmt die Server-Identität", async () => {
    const stage = { ...boardResponse().columns[0], id: "column-2", taskIds: [] };
    let received;
    const saved = await createApiStage("http://api", "board-id", stage, async (url, options) => {
      received = { url, method: options.method, body: JSON.parse(options.body) };
      return response({ stage: { ...stage, id: "server-stage-id", version: 1 } }, 201);
    });
    assert.equal(received.url, "http://api/api/boards/board-id/stages");
    assert.equal(received.method, "POST");
    assert.equal(received.body.title, "Backlog");
    assert.equal(saved.id, "server-stage-id");
  });

  test("sortiert Stages mit ihrer aktuellen Version", async () => {
    const stage = boardResponse().columns[0];
    let requestBody;
    const saved = await moveApiStage("http://api", "board-id", stage, 2, async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return response({ stage: { id: stage.id, position: 2, version: 2 } });
    });
    assert.deepEqual(requestBody, { targetIndex: 2, version: 1 });
    assert.deepEqual(saved, { id: stage.id, position: 2, version: 2 });
  });

  test("löscht Stages mit Version und Ziel-Stage", async () => {
    const stage = boardResponse().columns[0];
    let received;
    await deleteApiStage("http://api", "board-id", stage, "target-stage", async (url, options) => {
      received = { url, method: options.method, body: JSON.parse(options.body) };
      return { ok: true, status: 204 };
    });
    assert.equal(received.url, "http://api/api/boards/board-id/stages/stage-id");
    assert.equal(received.method, "DELETE");
    assert.deepEqual(received.body, { version: 1, moveTasksTo: "target-stage" });
  });

  test("speichert Board-Metadaten versioniert", async () => {
    const state = { ...boardResponse(), project: { ...boardResponse().project, name: "Delivery" } };
    let requestBody;
    const saved = await updateApiBoard("http://api", "board-id", state, async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return response({ board: { id: "board-id", name: "Delivery", path: "Boards / Delivery", description: "Test", version: 2 } });
    });
    assert.deepEqual(requestBody, { name: "Delivery", path: "/api", description: "Test", version: 1 });
    assert.equal(saved.version, 2);
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
