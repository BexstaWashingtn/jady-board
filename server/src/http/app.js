const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Accept, Content-Type",
};

/**
 * @param {{
 *   database: Pick<import("pg").Pool, "query">,
 *   boardService?: import("../modules/boards/board.service.js").BoardService,
 *   currentUserId?: string|null
 * }} dependencies
 * @returns {import("node:http").RequestListener}
 */
export function createApiHandler({ database, boardService, currentUserId = null }) {
  return async function apiHandler(request, response) {
    const method = request.method ?? "GET";
    const url = new URL(request.url ?? "/", "http://localhost");

    if (method === "OPTIONS") {
      response.writeHead(204, JSON_HEADERS);
      response.end();
      return;
    }

    if (method === "GET" && url.pathname === "/api/health") {
      sendJson(response, 200, { status: "ok" });
      return;
    }

    if (method === "GET" && url.pathname === "/api/ready") {
      try {
        await database.query("SELECT 1");
        sendJson(response, 200, { status: "ready" });
      } catch {
        sendJson(response, 503, {
          status: "unavailable",
          error: { code: "DATABASE_UNAVAILABLE", message: "Database connection unavailable." },
        });
      }
      return;
    }

    if (method === "GET" && url.pathname === "/api/boards") {
      if (!boardService || !currentUserId) {
        sendJson(response, 503, identityUnavailable());
        return;
      }
      try {
        sendJson(response, 200, { currentUserId, boards: await boardService.listBoards(currentUserId) });
      } catch {
        sendJson(response, 500, internalError());
      }
      return;
    }

    const boardMatch = method === "GET" ? url.pathname.match(/^\/api\/boards\/([^/]+)$/) : null;
    if (boardMatch) {
      if (!boardService || !currentUserId) {
        sendJson(response, 503, identityUnavailable());
        return;
      }
      const boardId = decodeURIComponent(boardMatch[1]);
      if (!isUuid(boardId)) {
        sendJson(response, 400, { error: { code: "INVALID_BOARD_ID", message: "Board ID must be a UUID." } });
        return;
      }
      let board;
      try {
        board = await boardService.getBoard(boardId, currentUserId);
      } catch {
        sendJson(response, 500, internalError());
        return;
      }
      if (!board) {
        sendJson(response, 404, { error: { code: "BOARD_NOT_FOUND", message: "Board not found." } });
        return;
      }
      sendJson(response, 200, { board });
      return;
    }

    const createTaskMatch = method === "POST" ? url.pathname.match(/^\/api\/boards\/([^/]+)\/tasks$/) : null;
    if (createTaskMatch) {
      if (!boardService || !currentUserId) { sendJson(response, 503, identityUnavailable()); return; }
      const boardId = decodeURIComponent(createTaskMatch[1]);
      if (!isUuid(boardId)) { sendJson(response, 400, { error: { code: "INVALID_BOARD_ID", message: "Board ID must be a UUID." } }); return; }
      let body;
      try { body = await readJson(request); } catch {
        sendJson(response, 400, { error: { code: "INVALID_JSON", message: "A valid JSON request body is required." } }); return;
      }
      try {
        const result = await boardService.createTask(boardId, currentUserId, body);
        if (result.status === "created") sendJson(response, 201, { task: result.task });
        else if (result.status === "invalid") sendJson(response, 400, { error: { code: "INVALID_TASK", message: result.message } });
        else if (result.status === "forbidden") sendJson(response, 403, { error: { code: "TASK_CREATE_FORBIDDEN", message: "Task creation is not permitted." } });
        else if (result.status === "rejected") sendJson(response, 422, { error: { code: result.code, message: result.message } });
        else sendJson(response, 404, { error: { code: "BOARD_OR_STAGE_NOT_FOUND", message: "Board or target stage not found." } });
      } catch {
        sendJson(response, 500, internalError());
      }
      return;
    }

    const moveMatch = method === "PATCH" ? url.pathname.match(/^\/api\/boards\/([^/]+)\/tasks\/([^/]+)\/position$/) : null;
    if (moveMatch) {
      if (!boardService || !currentUserId) { sendJson(response, 503, identityUnavailable()); return; }
      const boardId = decodeURIComponent(moveMatch[1]);
      const taskId = decodeURIComponent(moveMatch[2]);
      if (!isUuid(boardId) || !isUuid(taskId)) {
        sendJson(response, 400, { error: { code: "INVALID_RESOURCE_ID", message: "Board and task IDs must be UUIDs." } });
        return;
      }
      let body;
      try { body = await readJson(request); } catch {
        sendJson(response, 400, { error: { code: "INVALID_JSON", message: "A valid JSON request body is required." } });
        return;
      }
      try {
        const result = await boardService.moveTask(boardId, taskId, currentUserId, body);
        if (result.status === "moved") sendJson(response, 200, { task: result.task });
        else if (result.status === "invalid") sendJson(response, 400, { error: { code: "INVALID_TASK_MOVE", message: result.message } });
        else if (result.status === "forbidden") sendJson(response, 403, { error: { code: "TASK_MOVE_FORBIDDEN", message: "Task move is not permitted." } });
        else if (result.status === "conflict") sendJson(response, 409, { error: { code: "TASK_VERSION_CONFLICT", message: "Task has been changed by another request." } });
        else if (result.status === "rejected") sendJson(response, 422, { error: { code: result.code, message: result.message } });
        else sendJson(response, 404, { error: { code: "TASK_NOT_FOUND", message: "Task or target stage not found." } });
      } catch {
        sendJson(response, 500, internalError());
      }
      return;
    }

    const assignmentMatch = method === "PATCH" ? url.pathname.match(/^\/api\/boards\/([^/]+)\/tasks\/([^/]+)\/assignment$/) : null;
    if (assignmentMatch) {
      if (!boardService || !currentUserId) { sendJson(response, 503, identityUnavailable()); return; }
      const boardId = decodeURIComponent(assignmentMatch[1]);
      const taskId = decodeURIComponent(assignmentMatch[2]);
      if (!isUuid(boardId) || !isUuid(taskId)) { sendJson(response, 400, { error: { code: "INVALID_RESOURCE_ID", message: "Board and task IDs must be UUIDs." } }); return; }
      let body;
      try { body = await readJson(request); } catch { sendJson(response, 400, { error: { code: "INVALID_JSON", message: "A valid JSON request body is required." } }); return; }
      try {
        const result = await boardService.assignTask(boardId, taskId, currentUserId, body);
        if (result.status === "updated") sendJson(response, 200, { task: result.task });
        else if (result.status === "invalid") sendJson(response, 400, { error: { code: "INVALID_ASSIGNMENT", message: result.message } });
        else if (result.status === "forbidden") sendJson(response, 403, { error: { code: "TASK_ASSIGNMENT_FORBIDDEN", message: "Task assignment is not permitted." } });
        else if (result.status === "conflict") sendJson(response, 409, { error: { code: "TASK_VERSION_CONFLICT", message: "Task has been changed by another request." } });
        else sendJson(response, 404, { error: { code: "TASK_NOT_FOUND", message: "Task not found." } });
      } catch { sendJson(response, 500, internalError()); }
      return;
    }

    const taskMatch = method === "PATCH" ? url.pathname.match(/^\/api\/boards\/([^/]+)\/tasks\/([^/]+)$/) : null;
    if (taskMatch) {
      if (!boardService || !currentUserId) {
        sendJson(response, 503, identityUnavailable());
        return;
      }
      const boardId = decodeURIComponent(taskMatch[1]);
      const taskId = decodeURIComponent(taskMatch[2]);
      if (!isUuid(boardId) || !isUuid(taskId)) {
        sendJson(response, 400, { error: { code: "INVALID_RESOURCE_ID", message: "Board and task IDs must be UUIDs." } });
        return;
      }
      let body;
      try {
        body = await readJson(request);
      } catch {
        sendJson(response, 400, { error: { code: "INVALID_JSON", message: "A valid JSON request body is required." } });
        return;
      }
      try {
        const result = await boardService.updateTask(boardId, taskId, currentUserId, body);
        if (result.status === "updated") sendJson(response, 200, { task: result.task });
        else if (result.status === "invalid") sendJson(response, 400, { error: { code: "INVALID_TASK", message: result.message } });
        else if (result.status === "forbidden") sendJson(response, 403, { error: { code: "TASK_UPDATE_FORBIDDEN", message: "Task update is not permitted." } });
        else if (result.status === "conflict") sendJson(response, 409, { error: { code: "TASK_VERSION_CONFLICT", message: "Task has been changed by another request." } });
        else sendJson(response, 404, { error: { code: "TASK_NOT_FOUND", message: "Task not found." } });
      } catch {
        sendJson(response, 500, internalError());
      }
      return;
    }

    sendJson(response, 404, {
      error: { code: "NOT_FOUND", message: "The requested API resource does not exist." },
    });
  };
}

/** @param {import("node:http").IncomingMessage} request @returns {Promise<unknown>} */
async function readJson(request) {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 64 * 1024) throw new Error("Request body too large.");
  }
  return JSON.parse(raw);
}

function identityUnavailable() {
  return {
    error: {
      code: "IDENTITY_NOT_CONFIGURED",
      message: "A development identity is required for this endpoint.",
    },
  };
}

function internalError() {
  return {
    error: {
      code: "INTERNAL_ERROR",
      message: "The request could not be completed.",
    },
  };
}

/** @param {string} value */
function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/**
 * @param {import("node:http").ServerResponse} response
 * @param {number} status
 * @param {unknown} body
 */
function sendJson(response, status, body) {
  response.writeHead(status, JSON_HEADERS);
  response.end(JSON.stringify(body));
}
