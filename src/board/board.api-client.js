/**
 * Reads the explicit API opt-in from the page URL. Local-first remains the
 * default until server-side writes and authentication exist.
 *
 * @param {Pick<Location, "search"|"origin">} location
 * @returns {string|null}
 */
export function readApiDataSource(location) {
  const parameters = new URLSearchParams(location.search);
  if (parameters.get("data-source") !== "api") return null;
  const configured = parameters.get("api-url")?.trim();
  return (configured || location.origin).replace(/\/$/, "");
}

/**
 * Loads every accessible board and maps the public API contract to the
 * existing client workspace. Changes remain volatile in this migration step.
 *
 * @param {string} baseUrl
 * @param {typeof fetch} [request]
 * @returns {Promise<import("./board.persistence.js").BoardWorkspace>}
 */
export async function loadApiWorkspace(baseUrl, request = fetch) {
  const list = await getJson(request, `${baseUrl}/api/boards`);
  if (!Array.isArray(list.boards) || !list.boards.length) {
    throw new Error("Board API: no accessible boards.");
  }
  const details = await Promise.all(list.boards.map(async (/** @type {Record<string, any>} */ summary) => {
    const result = await getJson(request, `${baseUrl}/api/boards/${encodeURIComponent(String(summary.id))}`);
    if (!result.board) throw new Error("Board API: invalid board response.");
    return result.board;
  }));
  const boards = Object.fromEntries(details.map((board) => [String(board.id), toBoardState(board)]));
  /** @type {Record<string, import("./board.persistence.js").BoardUser>} */
  const users = Object.fromEntries(details.flatMap((board) => board.members ?? []).map((member) => [
    String(member.id),
    { id: String(member.id), name: String(member.name), initials: String(member.initials), preferences: { theme: /** @type {const} */ ("system") } },
  ]));
  const first = details[0];
  const activeUserId = String(list.currentUserId ?? "");
  if (!users[activeUserId]) throw new Error("Board API: active user is missing.");
  return { activeBoardId: String(first.id), boards, activeUserId, users };
}

/**
 * Persists editable task metadata using the version received with the board.
 *
 * @param {string} baseUrl
 * @param {string} boardId
 * @param {import("./board.state.js").BoardTask} task
 * @param {typeof fetch} [request]
 * @returns {Promise<Partial<import("./board.state.js").BoardTask>>}
 */
export async function updateApiTask(baseUrl, boardId, task, request = fetch) {
  if (!Number.isInteger(task.version) || Number(task.version) < 1) throw new Error("Der Task besitzt keine gültige Server-Version.");
  const response = await request(`${baseUrl}/api/boards/${encodeURIComponent(boardId)}/tasks/${encodeURIComponent(task.id)}`, {
    method: "PATCH",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      title: task.title, category: task.category, priority: task.priority,
      dueDate: task.dueDate, version: task.version,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 409) throw new Error("Der Task wurde zwischenzeitlich geändert. Bitte lade das Board neu.");
    throw new Error(String(body?.error?.message ?? `Task konnte nicht gespeichert werden (${response.status}).`));
  }
  if (!body.task || Number(body.task.version) < 1) throw new Error("Die Board-API hat einen ungültigen Task zurückgegeben.");
  return body.task;
}

/**
 * @param {string} baseUrl
 * @param {string} boardId
 * @param {import("./board.state.js").BoardTask} task
 * @param {string} stageId
 * @param {number} targetIndex
 * @param {typeof fetch} [request]
 * @returns {Promise<{id: string, stageId: string, position: number, version: number}>}
 */
export async function moveApiTask(baseUrl, boardId, task, stageId, targetIndex, request = fetch) {
  if (!Number.isInteger(task.version) || Number(task.version) < 1) throw new Error("Der Task besitzt keine gültige Server-Version.");
  const response = await request(`${baseUrl}/api/boards/${encodeURIComponent(boardId)}/tasks/${encodeURIComponent(task.id)}/position`, {
    method: "PATCH", headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ stageId, targetIndex, version: task.version }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    /** @type {Record<string, string>} */
    const messages = {
      TASK_VERSION_CONFLICT: "Der Task wurde zwischenzeitlich geändert. Bitte lade das Board neu.",
      TRANSITION_NOT_ALLOWED: "Der konfigurierte Workflow erlaubt diesen Übergang nicht.",
      OPEN_TODOS: "Vor diesem Übergang müssen alle Todos erledigt sein.",
      WIP_LIMIT_REACHED: "Die Ziel-Stage hat ihr WIP-Limit erreicht.",
    };
    throw new Error(messages[body?.error?.code] ?? String(body?.error?.message ?? `Task konnte nicht verschoben werden (${response.status}).`));
  }
  if (!body.task || Number(body.task.version) < 1) throw new Error("Die Board-API hat eine ungültige Verschiebung zurückgegeben.");
  return body.task;
}

/**
 * @param {string} baseUrl
 * @param {string} boardId
 * @param {import("./board.state.js").BoardTask} task
 * @param {string} stageId
 * @param {typeof fetch} [request]
 * @returns {Promise<import("./board.state.js").BoardTask>}
 */
export async function createApiTask(baseUrl, boardId, task, stageId, request = fetch) {
  const response = await request(`${baseUrl}/api/boards/${encodeURIComponent(boardId)}/tasks`, {
    method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      stageId, title: task.title, category: task.category, priority: task.priority,
      assigneeId: task.assigneeId, dueDate: task.dueDate,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (body?.error?.code === "WIP_LIMIT_REACHED") throw new Error("Die Ziel-Stage hat ihr WIP-Limit erreicht.");
    throw new Error(String(body?.error?.message ?? `Task konnte nicht erstellt werden (${response.status}).`));
  }
  if (!body.task?.id || Number(body.task.version) < 1) throw new Error("Die Board-API hat einen ungültigen Task zurückgegeben.");
  return body.task;
}

/**
 * @param {string} baseUrl @param {string} boardId @param {import("./board.state.js").BoardTask} task
 * @param {typeof fetch} [request]
 * @returns {Promise<{assigneeId: string|null, version: number}>}
 */
export async function assignApiTask(baseUrl, boardId, task, request = fetch) {
  if (!Number.isInteger(task.version) || Number(task.version) < 1) throw new Error("Der Task besitzt keine gültige Server-Version.");
  const response = await request(`${baseUrl}/api/boards/${encodeURIComponent(boardId)}/tasks/${encodeURIComponent(task.id)}/assignment`, {
    method: "PATCH", headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ assigneeId: task.assigneeId, version: task.version }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 409) throw new Error("Der Task wurde zwischenzeitlich geändert. Bitte lade das Board neu.");
    if (response.status === 403) throw new Error("Diese Task-Zuweisung ist nicht erlaubt.");
    throw new Error(String(body?.error?.message ?? `Zuweisung konnte nicht gespeichert werden (${response.status}).`));
  }
  return body.task;
}

/**
 * @param {string} baseUrl @param {string} boardId @param {import("./board.state.js").BoardTask} task
 * @param {typeof fetch} [request]
 * @returns {Promise<{todos: import("./board.state.js").TaskTodo[], version: number}>}
 */
export async function syncApiTaskTodos(baseUrl, boardId, task, request = fetch) {
  if (!Number.isInteger(task.version) || Number(task.version) < 1) throw new Error("Der Task besitzt keine gültige Server-Version.");
  const response = await request(`${baseUrl}/api/boards/${encodeURIComponent(boardId)}/tasks/${encodeURIComponent(task.id)}/todos`, {
    method: "PATCH", headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ todos: task.todos, version: task.version }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 409) throw new Error("Der Task wurde zwischenzeitlich geändert. Bitte lade das Board neu.");
    throw new Error(String(body?.error?.message ?? `Todos konnten nicht gespeichert werden (${response.status}).`));
  }
  if (!Array.isArray(body.task?.todos) || Number(body.task.version) < 1) throw new Error("Die Board-API hat ungültige Todos zurückgegeben.");
  return body.task;
}

/** @param {string} baseUrl @param {string} boardId @param {import("./board.state.js").BoardTask} task @param {typeof fetch} [request] */
export async function deleteApiTask(baseUrl, boardId, task, request = fetch) {
  if (!Number.isInteger(task.version) || Number(task.version) < 1) throw new Error("Der Task besitzt keine gültige Server-Version.");
  const response = await request(`${baseUrl}/api/boards/${encodeURIComponent(boardId)}/tasks/${encodeURIComponent(task.id)}?version=${task.version}`, {
    method: "DELETE", headers: { Accept: "application/json" },
  });
  if (response.ok) return;
  const body = await response.json().catch(() => ({}));
  if (response.status === 409) throw new Error("Der Task wurde zwischenzeitlich geändert. Bitte lade das Board neu.");
  throw new Error(String(body?.error?.message ?? `Task konnte nicht gelöscht werden (${response.status}).`));
}

/** @param {string} baseUrl @param {string} boardId @param {import("./board.state.js").BoardColumn} stage @param {typeof fetch} [request] */
export async function updateApiStage(baseUrl, boardId, stage, request = fetch) {
  if (!Number.isInteger(stage.version) || Number(stage.version) < 1) throw new Error("Die Stage besitzt keine gültige Server-Version.");
  const response = await request(`${baseUrl}/api/boards/${encodeURIComponent(boardId)}/stages/${encodeURIComponent(stage.id)}`, {
    method: "PATCH", headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ title: stage.title, color: stage.color, kind: stage.kind, limit: stage.limit, limitMode: stage.limitMode, allowedTargetIds: stage.allowedTargetIds, requireCompletedTodos: stage.requireCompletedTodos, version: stage.version }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 409) throw new Error("Die Stage wurde zwischenzeitlich geändert. Bitte lade das Board neu.");
    throw new Error(String(body?.error?.message ?? `Stage konnte nicht gespeichert werden (${response.status}).`));
  }
  if (!body.stage || Number(body.stage.version) < 1) throw new Error("Die Board-API hat eine ungültige Stage zurückgegeben.");
  return body.stage;
}

/** @param {string} baseUrl @param {string} boardId @param {import("./board.state.js").BoardColumn} stage @param {typeof fetch} [request] */
export async function createApiStage(baseUrl, boardId, stage, request = fetch) {
  const response = await request(`${baseUrl}/api/boards/${encodeURIComponent(boardId)}/stages`, {
    method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ title: stage.title, color: stage.color, kind: stage.kind, limit: stage.limit, limitMode: stage.limitMode, allowedTargetIds: stage.allowedTargetIds, requireCompletedTodos: stage.requireCompletedTodos }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(body?.error?.message ?? `Stage konnte nicht erstellt werden (${response.status}).`));
  if (!body.stage?.id || Number(body.stage.version) < 1 || !Array.isArray(body.stage.taskIds)) throw new Error("Die Board-API hat eine ungültige Stage zurückgegeben.");
  return body.stage;
}

/** @param {string} baseUrl @param {string} boardId @param {import("./board.state.js").BoardColumn} stage @param {number} targetIndex @param {typeof fetch} [request] */
export async function moveApiStage(baseUrl, boardId, stage, targetIndex, request = fetch) {
  if (!Number.isInteger(stage.version) || Number(stage.version) < 1) throw new Error("Die Stage besitzt keine gültige Server-Version.");
  const response = await request(`${baseUrl}/api/boards/${encodeURIComponent(boardId)}/stages/${encodeURIComponent(stage.id)}/position`, {
    method: "PATCH", headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ targetIndex, version: stage.version }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 409) throw new Error("Die Stage wurde zwischenzeitlich geändert. Bitte lade das Board neu.");
    throw new Error(String(body?.error?.message ?? `Stage konnte nicht verschoben werden (${response.status}).`));
  }
  if (!body.stage || Number(body.stage.version) < 1 || !Number.isInteger(body.stage.position)) throw new Error("Die Board-API hat eine ungültige Stage-Position zurückgegeben.");
  return body.stage;
}

/** @param {string} baseUrl @param {string} boardId @param {import("./board.state.js").BoardColumn} stage @param {string|null} moveTasksTo @param {typeof fetch} [request] */
export async function deleteApiStage(baseUrl, boardId, stage, moveTasksTo, request = fetch) {
  if (!Number.isInteger(stage.version) || Number(stage.version) < 1) throw new Error("Die Stage besitzt keine gültige Server-Version.");
  const response = await request(`${baseUrl}/api/boards/${encodeURIComponent(boardId)}/stages/${encodeURIComponent(stage.id)}`, {
    method: "DELETE", headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ version: stage.version, moveTasksTo }),
  });
  if (response.ok) return;
  const body = await response.json().catch(() => ({}));
  if (response.status === 409) throw new Error("Die Stage wurde zwischenzeitlich geändert. Bitte lade das Board neu.");
  if (body?.error?.code === "WIP_LIMIT_REACHED") throw new Error("Die Ziel-Stage hat nicht genügend freie Kapazität.");
  throw new Error(String(body?.error?.message ?? `Stage konnte nicht gelöscht werden (${response.status}).`));
}

/** @param {typeof fetch} request @param {string} url @returns {Promise<Record<string, any>>} */
async function getJson(request, url) {
  const response = await request(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Board API: request failed (${response.status}).`);
  return response.json();
}

/** @param {Record<string, any>} board @returns {import("./board.state.js").BoardState} */
function toBoardState(board) {
  return {
    project: {
      name: String(board.project.name), path: String(board.project.path),
      description: String(board.project.description), ownerId: String(board.project.ownerId),
      memberIds: board.project.memberIds.map(String),
    },
    columns: board.columns,
    tasks: board.tasks,
  };
}
