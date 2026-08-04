const MAX_JSON_BODY_BYTES = 64 * 1024;

/**
 * Error raised for malformed HTTP input that can safely be reported to clients.
 */
export class HttpInputError extends Error {
  /** @param {"INVALID_JSON"|"PAYLOAD_TOO_LARGE"} code @param {string} message */
  constructor(code, message) {
    super(message);
    this.name = "HttpInputError";
    this.code = code;
  }
}

/**
 * Reads one bounded JSON request body.
 *
 * @param {import("node:http").IncomingMessage} request
 * @returns {Promise<unknown>}
 */
export async function readJson(request) {
  /** @type {Buffer[]} */
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > MAX_JSON_BODY_BYTES) {
      throw new HttpInputError("PAYLOAD_TOO_LARGE", "Request body must not exceed 64 KiB.");
    }
    chunks.push(buffer);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpInputError("INVALID_JSON", "A valid JSON request body is required.");
  }
}

/** @param {string} value */
export function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/**
 * @param {import("node:http").ServerResponse} response
 * @param {number} status
 * @param {unknown} body
 * @param {Record<string, string>} headers
 */
export function sendJson(response, status, body, headers) {
  response.writeHead(status, headers);
  response.end(JSON.stringify(body));
}

/** @param {import("node:http").ServerResponse} response @param {Record<string, string>} headers */
export function sendNoContent(response, headers) {
  response.writeHead(204, headers);
  response.end();
}
