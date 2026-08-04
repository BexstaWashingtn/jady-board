const API_SESSION_KEY = "jadydoco.api-session";

export class ApiSessionError extends Error {
  /** @param {number} status @param {string} message */
  constructor(status, message) {
    super(message);
    this.name = "ApiSessionError";
    this.status = status;
  }
}

/** @param {Storage} storage @param {string} apiSource */
export function readApiToken(storage, apiSource) {
  try {
    const value = JSON.parse(storage.getItem(API_SESSION_KEY) ?? "null");
    return value?.apiSource === apiSource && typeof value.token === "string" ? value.token : null;
  } catch { return null; }
}

/** @param {Storage} storage @param {string} apiSource @param {string} token */
export function saveApiToken(storage, apiSource, token) {
  const normalized = token.trim();
  if (!normalized) throw new Error("Bitte gib ein Zugriffstoken ein.");
  storage.setItem(API_SESSION_KEY, JSON.stringify({ apiSource, token: normalized }));
}

/** @param {Storage} storage */
export function clearApiToken(storage) {
  try { storage.removeItem(API_SESSION_KEY); } catch { /* Session is already unavailable. */ }
}

/**
 * @param {{token: () => string|null|Promise<string|null>, request?: typeof fetch, onUnauthorized?: () => void, requestId?: () => string}} options
 * @returns {typeof fetch}
 */
export function createAuthenticatedRequest({ token, request = fetch, onUnauthorized = () => {}, requestId = defaultRequestId }) {
  return async (input, init = {}) => {
    const headers = new Headers(init.headers);
    headers.set("X-Request-ID", requestId());
    const credential = await token();
    if (credential) headers.set("Authorization", `Bearer ${credential}`);
    const response = await request(input, { ...init, headers });
    if (response.status === 401) {
      onUnauthorized();
      throw new ApiSessionError(401, "Die API-Sitzung ist ungültig oder abgelaufen. Bitte melde dich erneut an.");
    }
    if (response.status === 403) throw new ApiSessionError(403, "Für diese Aktion fehlen die erforderlichen Berechtigungen.");
    if (response.status === 409) throw new ApiSessionError(409, "Die Daten wurden zwischenzeitlich geändert. Bitte lade das Board neu.");
    if (response.status === 429) {
      const seconds = Number(response.headers.get("Retry-After"));
      const wait = Number.isFinite(seconds) && seconds > 0 ? ` Versuche es in ${Math.ceil(seconds)} Sekunden erneut.` : "";
      throw new ApiSessionError(429, `Zu viele Anfragen.${wait}`);
    }
    return response;
  };
}

function defaultRequestId() {
  return globalThis.crypto?.randomUUID?.() ?? `request-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
