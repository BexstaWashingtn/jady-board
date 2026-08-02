const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
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
        sendJson(response, 200, { boards: await boardService.listBoards(currentUserId) });
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
