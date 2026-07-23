const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

/**
 * @param {{database: Pick<import("pg").Pool, "query">}} dependencies
 * @returns {import("node:http").RequestListener}
 */
export function createApiHandler({ database }) {
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

    sendJson(response, 404, {
      error: { code: "NOT_FOUND", message: "The requested API resource does not exist." },
    });
  };
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
