import { isUuid, readJson, sendJson as writeJson, sendNoContent } from "./http.js";
import { createDevelopmentIdentityResolver } from "./request-identity.js";
import { randomUUID } from "node:crypto";

const BASE_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

/**
 * @param {{
 *   database: Pick<import("pg").Pool, "query">,
 *   boardService?: import("../modules/boards/board.service.js").BoardService,
 *   currentUserId?: string|null,
 *   resolveIdentity?: import("./request-identity.js").RequestIdentityResolver
 *   corsOrigin?: string|null
 *   rateLimiter?: {consume: (key: string) => {allowed: boolean, limit: number, remaining: number, resetAt: number}}
 *   identityRequired?: boolean
 * }} dependencies
 * @returns {import("node:http").RequestListener}
 */
export function createApiHandler({ database, boardService, currentUserId = null, resolveIdentity = createDevelopmentIdentityResolver(currentUserId), corsOrigin = null, rateLimiter, identityRequired = false }) {
  return async function apiHandler(request, response) {
    const method = request.method ?? "GET";
    const url = new URL(request.url ?? "/", "http://localhost");
    const requestOrigin = request.headers.origin ?? null;
    const incomingRequestId = request.headers["x-request-id"];
    const requestId = typeof incomingRequestId === "string" && /^[A-Za-z0-9._-]{8,128}$/.test(incomingRequestId)
      ? incomingRequestId
      : randomUUID();
    const corsAllowed = requestOrigin === null || requestOrigin === corsOrigin;
    /** @type {Record<string, string>} */
    const responseHeaders = corsAllowed && requestOrigin
      ? { ...BASE_HEADERS, "X-Request-ID": requestId, "Access-Control-Allow-Origin": requestOrigin, "Access-Control-Expose-Headers": "X-Request-ID, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset", "Vary": "Origin" }
      : { ...BASE_HEADERS, "X-Request-ID": requestId };
    /** @param {import("node:http").ServerResponse} target @param {number} status @param {unknown} body */
    const sendJson = (target, status, body) => writeJson(target, status, body, responseHeaders);

    if (!corsAllowed) {
      sendJson(response, 403, { error: { code: "ORIGIN_NOT_ALLOWED", message: "Request origin is not allowed." } });
      return;
    }

    if (method === "OPTIONS") {
      response.writeHead(204, {
        ...responseHeaders,
        "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Accept, Authorization, Content-Type, X-Request-ID",
      });
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

    if (rateLimiter) {
      const client = request.socket.remoteAddress ?? "unknown";
      const result = rateLimiter.consume(client);
      responseHeaders["X-RateLimit-Limit"] = String(result.limit);
      responseHeaders["X-RateLimit-Remaining"] = String(result.remaining);
      responseHeaders["X-RateLimit-Reset"] = String(Math.ceil(result.resetAt / 1000));
      if (!result.allowed) {
        responseHeaders["Retry-After"] = String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000)));
        sendJson(response, 429, { error: { code: "RATE_LIMITED", message: "Too many requests." }, requestId });
        return;
      }
    }

    let requestUserId;
    try {
      requestUserId = await resolveIdentity(request);
    } catch {
      sendJson(response, 401, identityRejected());
      return;
    }
    if (requestUserId && !isUuid(requestUserId)) {
      sendJson(response, 401, identityRejected());
      return;
    }
    if (identityRequired && !requestUserId) {
      sendJson(response, 401, identityRejected());
      return;
    }

    if (method === "GET" && url.pathname === "/api/boards") {
      if (!boardService || !requestUserId) {
        sendJson(response, 503, identityUnavailable());
        return;
      }
      try {
        sendJson(response, 200, { currentUserId: requestUserId, boards: await boardService.listBoards(requestUserId) });
      } catch {
        sendJson(response, 500, internalError());
      }
      return;
    }

    const boardMatch = method === "GET" ? url.pathname.match(/^\/api\/boards\/([^/]+)$/) : null;
    if (boardMatch) {
      if (!boardService || !requestUserId) {
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
        board = await boardService.getBoard(boardId, requestUserId);
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

    const updateBoardMatch = method === "PATCH" ? url.pathname.match(/^\/api\/boards\/([^/]+)$/) : null;
    if (updateBoardMatch) {
      if (!boardService || !requestUserId) { sendJson(response, 503, identityUnavailable()); return; }
      const boardId = decodeURIComponent(updateBoardMatch[1]);
      if (!isUuid(boardId)) { sendJson(response, 400, { error: { code: "INVALID_BOARD_ID", message: "Board ID must be a UUID." } }); return; }
      let body; try { body = await readJson(request); } catch { sendJson(response, 400, { error: { code: "INVALID_JSON", message: "A valid JSON request body is required." } }); return; }
      try {
        const result = await boardService.updateBoard(boardId, requestUserId, body);
        if (result.status === "updated") sendJson(response, 200, { board: result.board });
        else if (result.status === "invalid") sendJson(response, 400, { error: { code: "INVALID_BOARD", message: result.message } });
        else if (result.status === "forbidden") sendJson(response, 403, { error: { code: "BOARD_UPDATE_FORBIDDEN", message: "Board update is not permitted." } });
        else if (result.status === "conflict") sendJson(response, 409, { error: { code: "BOARD_VERSION_CONFLICT", message: "Board has been changed by another request." } });
        else sendJson(response, 404, { error: { code: "BOARD_NOT_FOUND", message: "Board not found." } });
      } catch { sendJson(response, 500, internalError()); }
      return;
    }

    const createTaskMatch = method === "POST" ? url.pathname.match(/^\/api\/boards\/([^/]+)\/tasks$/) : null;
    if (createTaskMatch) {
      if (!boardService || !requestUserId) { sendJson(response, 503, identityUnavailable()); return; }
      const boardId = decodeURIComponent(createTaskMatch[1]);
      if (!isUuid(boardId)) { sendJson(response, 400, { error: { code: "INVALID_BOARD_ID", message: "Board ID must be a UUID." } }); return; }
      let body;
      try { body = await readJson(request); } catch {
        sendJson(response, 400, { error: { code: "INVALID_JSON", message: "A valid JSON request body is required." } }); return;
      }
      try {
        const result = await boardService.createTask(boardId, requestUserId, body);
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

    const deleteTaskMatch = method === "DELETE" ? url.pathname.match(/^\/api\/boards\/([^/]+)\/tasks\/([^/]+)$/) : null;
    if (deleteTaskMatch) {
      if (!boardService || !requestUserId) { sendJson(response, 503, identityUnavailable()); return; }
      const boardId = decodeURIComponent(deleteTaskMatch[1]);
      const taskId = decodeURIComponent(deleteTaskMatch[2]);
      if (!isUuid(boardId) || !isUuid(taskId)) { sendJson(response, 400, { error: { code: "INVALID_RESOURCE_ID", message: "Board and task IDs must be UUIDs." } }); return; }
      try {
        const result = await boardService.deleteTask(boardId, taskId, requestUserId, url.searchParams.get("version"));
        if (result.status === "deleted") sendNoContent(response, responseHeaders);
        else if (result.status === "invalid") sendJson(response, 400, { error: { code: "INVALID_TASK_VERSION", message: result.message } });
        else if (result.status === "forbidden") sendJson(response, 403, { error: { code: "TASK_DELETE_FORBIDDEN", message: "Task deletion is not permitted." } });
        else if (result.status === "conflict") sendJson(response, 409, { error: { code: "TASK_VERSION_CONFLICT", message: "Task has been changed by another request." } });
        else sendJson(response, 404, { error: { code: "TASK_NOT_FOUND", message: "Task not found." } });
      } catch { sendJson(response, 500, internalError()); }
      return;
    }

    const stageMatch = method === "PATCH" ? url.pathname.match(/^\/api\/boards\/([^/]+)\/stages\/([^/]+)$/) : null;
    if (stageMatch) {
      if (!boardService || !requestUserId) { sendJson(response, 503, identityUnavailable()); return; }
      const boardId = decodeURIComponent(stageMatch[1]); const stageId = decodeURIComponent(stageMatch[2]);
      if (!isUuid(boardId) || !isUuid(stageId)) { sendJson(response, 400, { error: { code: "INVALID_RESOURCE_ID", message: "Board and stage IDs must be UUIDs." } }); return; }
      let body; try { body = await readJson(request); } catch { sendJson(response, 400, { error: { code: "INVALID_JSON", message: "A valid JSON request body is required." } }); return; }
      try {
        const result = await boardService.updateStage(boardId, stageId, requestUserId, body);
        if (result.status === "updated") sendJson(response, 200, { stage: result.stage });
        else if (result.status === "invalid") sendJson(response, 400, { error: { code: "INVALID_STAGE", message: result.message } });
        else if (result.status === "forbidden") sendJson(response, 403, { error: { code: "STAGE_UPDATE_FORBIDDEN", message: "Stage update is not permitted." } });
        else if (result.status === "conflict") sendJson(response, 409, { error: { code: "STAGE_VERSION_CONFLICT", message: "Stage has been changed by another request." } });
        else sendJson(response, 404, { error: { code: "STAGE_NOT_FOUND", message: "Stage not found." } });
      } catch { sendJson(response, 500, internalError()); }
      return;
    }

    const createStageMatch = method === "POST" ? url.pathname.match(/^\/api\/boards\/([^/]+)\/stages$/) : null;
    if (createStageMatch) {
      if (!boardService || !requestUserId) { sendJson(response, 503, identityUnavailable()); return; }
      const boardId = decodeURIComponent(createStageMatch[1]);
      if (!isUuid(boardId)) { sendJson(response, 400, { error: { code: "INVALID_BOARD_ID", message: "Board ID must be a UUID." } }); return; }
      let body; try { body = await readJson(request); } catch { sendJson(response, 400, { error: { code: "INVALID_JSON", message: "A valid JSON request body is required." } }); return; }
      try {
        const result = await boardService.createStage(boardId, requestUserId, body);
        if (result.status === "created") sendJson(response, 201, { stage: result.stage });
        else if (result.status === "invalid") sendJson(response, 400, { error: { code: "INVALID_STAGE", message: result.message } });
        else if (result.status === "forbidden") sendJson(response, 403, { error: { code: "STAGE_CREATE_FORBIDDEN", message: "Stage creation is not permitted." } });
        else sendJson(response, 404, { error: { code: "BOARD_NOT_FOUND", message: "Board not found." } });
      } catch { sendJson(response, 500, internalError()); }
      return;
    }

    const moveStageMatch = method === "PATCH" ? url.pathname.match(/^\/api\/boards\/([^/]+)\/stages\/([^/]+)\/position$/) : null;
    if (moveStageMatch) {
      if (!boardService || !requestUserId) { sendJson(response, 503, identityUnavailable()); return; }
      const boardId = decodeURIComponent(moveStageMatch[1]); const stageId = decodeURIComponent(moveStageMatch[2]);
      if (!isUuid(boardId) || !isUuid(stageId)) { sendJson(response, 400, { error: { code: "INVALID_RESOURCE_ID", message: "Board and stage IDs must be UUIDs." } }); return; }
      let body; try { body = await readJson(request); } catch { sendJson(response, 400, { error: { code: "INVALID_JSON", message: "A valid JSON request body is required." } }); return; }
      try {
        const result = await boardService.moveStage(boardId, stageId, requestUserId, body);
        if (result.status === "moved") sendJson(response, 200, { stage: result.stage });
        else if (result.status === "invalid") sendJson(response, 400, { error: { code: "INVALID_STAGE_MOVE", message: result.message } });
        else if (result.status === "forbidden") sendJson(response, 403, { error: { code: "STAGE_MOVE_FORBIDDEN", message: "Stage move is not permitted." } });
        else if (result.status === "conflict") sendJson(response, 409, { error: { code: "STAGE_VERSION_CONFLICT", message: "Stage has been changed by another request." } });
        else sendJson(response, 404, { error: { code: "STAGE_NOT_FOUND", message: "Stage not found." } });
      } catch { sendJson(response, 500, internalError()); }
      return;
    }

    const deleteStageMatch = method === "DELETE" ? url.pathname.match(/^\/api\/boards\/([^/]+)\/stages\/([^/]+)$/) : null;
    if (deleteStageMatch) {
      if (!boardService || !requestUserId) { sendJson(response, 503, identityUnavailable()); return; }
      const boardId = decodeURIComponent(deleteStageMatch[1]); const stageId = decodeURIComponent(deleteStageMatch[2]);
      if (!isUuid(boardId) || !isUuid(stageId)) { sendJson(response, 400, { error: { code: "INVALID_RESOURCE_ID", message: "Board and stage IDs must be UUIDs." } }); return; }
      let body; try { body = await readJson(request); } catch { sendJson(response, 400, { error: { code: "INVALID_JSON", message: "A valid JSON request body is required." } }); return; }
      try {
        const result = await boardService.deleteStage(boardId, stageId, requestUserId, body);
        if (result.status === "deleted") sendNoContent(response, responseHeaders);
        else if (result.status === "invalid") sendJson(response, 400, { error: { code: "INVALID_STAGE_DELETE", message: result.message } });
        else if (result.status === "forbidden") sendJson(response, 403, { error: { code: "STAGE_DELETE_FORBIDDEN", message: "Stage deletion is not permitted." } });
        else if (result.status === "conflict") sendJson(response, 409, { error: { code: "STAGE_VERSION_CONFLICT", message: "Stage has been changed by another request." } });
        else if (result.status === "rejected") sendJson(response, 422, { error: { code: result.code, message: result.message } });
        else sendJson(response, 404, { error: { code: "STAGE_NOT_FOUND", message: "Stage not found." } });
      } catch { sendJson(response, 500, internalError()); }
      return;
    }

    const moveMatch = method === "PATCH" ? url.pathname.match(/^\/api\/boards\/([^/]+)\/tasks\/([^/]+)\/position$/) : null;
    if (moveMatch) {
      if (!boardService || !requestUserId) { sendJson(response, 503, identityUnavailable()); return; }
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
        const result = await boardService.moveTask(boardId, taskId, requestUserId, body);
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
      if (!boardService || !requestUserId) { sendJson(response, 503, identityUnavailable()); return; }
      const boardId = decodeURIComponent(assignmentMatch[1]);
      const taskId = decodeURIComponent(assignmentMatch[2]);
      if (!isUuid(boardId) || !isUuid(taskId)) { sendJson(response, 400, { error: { code: "INVALID_RESOURCE_ID", message: "Board and task IDs must be UUIDs." } }); return; }
      let body;
      try { body = await readJson(request); } catch { sendJson(response, 400, { error: { code: "INVALID_JSON", message: "A valid JSON request body is required." } }); return; }
      try {
        const result = await boardService.assignTask(boardId, taskId, requestUserId, body);
        if (result.status === "updated") sendJson(response, 200, { task: result.task });
        else if (result.status === "invalid") sendJson(response, 400, { error: { code: "INVALID_ASSIGNMENT", message: result.message } });
        else if (result.status === "forbidden") sendJson(response, 403, { error: { code: "TASK_ASSIGNMENT_FORBIDDEN", message: "Task assignment is not permitted." } });
        else if (result.status === "conflict") sendJson(response, 409, { error: { code: "TASK_VERSION_CONFLICT", message: "Task has been changed by another request." } });
        else sendJson(response, 404, { error: { code: "TASK_NOT_FOUND", message: "Task not found." } });
      } catch { sendJson(response, 500, internalError()); }
      return;
    }

    const todosMatch = method === "PATCH" ? url.pathname.match(/^\/api\/boards\/([^/]+)\/tasks\/([^/]+)\/todos$/) : null;
    if (todosMatch) {
      if (!boardService || !requestUserId) { sendJson(response, 503, identityUnavailable()); return; }
      const boardId = decodeURIComponent(todosMatch[1]);
      const taskId = decodeURIComponent(todosMatch[2]);
      if (!isUuid(boardId) || !isUuid(taskId)) { sendJson(response, 400, { error: { code: "INVALID_RESOURCE_ID", message: "Board and task IDs must be UUIDs." } }); return; }
      let body;
      try { body = await readJson(request); } catch { sendJson(response, 400, { error: { code: "INVALID_JSON", message: "A valid JSON request body is required." } }); return; }
      try {
        const result = await boardService.syncTaskTodos(boardId, taskId, requestUserId, body);
        if (result.status === "updated") sendJson(response, 200, { task: result.task });
        else if (result.status === "invalid") sendJson(response, 400, { error: { code: "INVALID_TODOS", message: result.message } });
        else if (result.status === "forbidden") sendJson(response, 403, { error: { code: "TODO_UPDATE_FORBIDDEN", message: "Todo update is not permitted." } });
        else if (result.status === "conflict") sendJson(response, 409, { error: { code: "TASK_VERSION_CONFLICT", message: "Task has been changed by another request." } });
        else sendJson(response, 404, { error: { code: "TASK_NOT_FOUND", message: "Task not found." } });
      } catch { sendJson(response, 500, internalError()); }
      return;
    }

    const taskMatch = method === "PATCH" ? url.pathname.match(/^\/api\/boards\/([^/]+)\/tasks\/([^/]+)$/) : null;
    if (taskMatch) {
      if (!boardService || !requestUserId) {
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
        const result = await boardService.updateTask(boardId, taskId, requestUserId, body);
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

function identityUnavailable() {
  return {
    error: {
      code: "IDENTITY_NOT_CONFIGURED",
      message: "A development identity is required for this endpoint.",
    },
  };
}

function identityRejected() {
  return {
    error: {
      code: "IDENTITY_REJECTED",
      message: "The request identity could not be verified.",
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
