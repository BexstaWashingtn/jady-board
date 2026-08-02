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
