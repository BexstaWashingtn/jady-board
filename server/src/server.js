import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

import { loadConfig } from "./config.js";
import { createDatabase } from "./db/database.js";
import { createApiHandler } from "./http/app.js";
import { createClerkPrincipalResolver } from "./http/clerk-principal.js";
import { createBearerIdentityResolver, createDevelopmentIdentityResolver, createRequestIdentityResolver } from "./http/request-identity.js";
import { createRateLimiter } from "./http/rate-limiter.js";
import { createBoardRepository } from "./modules/boards/board.repository.js";
import { createBoardService } from "./modules/boards/board.service.js";
import { createIdentityRepository } from "./modules/identity/identity.repository.js";

/**
 * @param {ReturnType<typeof loadConfig>} config
 */
export function createJaDyServer(config) {
  const database = createDatabase(config);
  const boardRepository = createBoardRepository(database);
  const boardService = createBoardService(boardRepository);
  const identityRepository = createIdentityRepository(database);
  const resolveIdentity = config.authMode === "clerk" && config.clerk
    ? createRequestIdentityResolver({
        resolvePrincipal: createClerkPrincipalResolver(config.clerk),
        resolveLocalUser: (principal) => identityRepository.findActiveUserId(principal),
      })
    : config.authMode === "controlled-bearer"
      ? createBearerIdentityResolver(config.bearerIdentities)
      : createDevelopmentIdentityResolver(config.devUserId);
  const server = createServer(createApiHandler({
    database,
    boardService,
    resolveIdentity,
    corsOrigin: config.corsOrigin,
    rateLimiter: createRateLimiter({ limit: config.rateLimit, windowMs: config.rateLimitWindowMs }),
    identityRequired: config.authMode !== "development",
    authPublicConfig: config.authMode === "clerk"
      ? { mode: "clerk", publishableKey: config.clerk?.publishableKey ?? "" }
      : { mode: config.authMode },
  }));

  async function close() {
    if (server.listening) {
      await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve(undefined));
      });
    }
    await database.end();
  }

  return { server, database, close };
}

async function main() {
  const config = loadConfig();
  const application = createJaDyServer(config);

  application.server.listen(config.port, config.host, () => {
    process.stdout.write(`JaDy Board API: http://${config.host}:${config.port}\n`);
  });

  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    try {
      await application.close();
      process.exitCode = 0;
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    }
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
