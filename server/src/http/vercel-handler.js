/**
 * Restores the public API path encoded by the Vercel rewrite before handing
 * the request to the provider-neutral Node.js request listener.
 *
 * @param {import("node:http").RequestListener} handler
 * @returns {import("node:http").RequestListener}
 */
export function createVercelHandler(handler) {
  return (request, response) => {
    const rewritten = new URL(request.url ?? "/", "http://localhost");
    const path = rewritten.searchParams.get("__path");
    if (path !== null) {
      rewritten.searchParams.delete("__path");
      const query = rewritten.searchParams.toString();
      request.url = `/api/${path}${query ? `?${query}` : ""}`;
    }
    return handler(request, response);
  };
}
