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
