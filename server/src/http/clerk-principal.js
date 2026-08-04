import { createClerkClient } from "@clerk/backend";

/**
 * Clerk-specific authentication adapter. It verifies a Clerk session and
 * exposes only the provider-neutral issuer/subject pair to the application.
 *
 * @param {{publishableKey: string, secretKey: string, authorizedParties: string[], client?: ReturnType<typeof createClerkClient>}} options
 * @returns {import("./request-identity.js").RequestPrincipalResolver}
 */
export function createClerkPrincipalResolver({ publishableKey, secretKey, authorizedParties, client = createClerkClient({ publishableKey, secretKey }) }) {
  return async (request) => {
    const state = await client.authenticateRequest(toWebRequest(request), {
      authorizedParties,
      acceptsToken: "session_token",
    });
    if (!state.isAuthenticated) return null;
    const auth = state.toAuth();
    const issuer = auth.sessionClaims?.iss;
    if (typeof issuer !== "string" || typeof auth.userId !== "string") {
      throw new Error("Clerk returned an invalid authenticated principal.");
    }
    return { issuer, subject: auth.userId };
  };
}

/** @param {import("node:http").IncomingMessage} request */
function toWebRequest(request) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) value.forEach((entry) => headers.append(name, entry));
    else if (value !== undefined) headers.set(name, value);
  }
  const host = request.headers.host ?? "localhost";
  return new Request(`http://${host}${request.url ?? "/"}`, { method: request.method ?? "GET", headers });
}
