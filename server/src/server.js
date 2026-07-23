import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

import { loadConfig } from "./config.js";
import { createDatabase } from "./db/database.js";
import { createApiHandler } from "./http/app.js";

/**
 * @param {ReturnType<typeof loadConfig>} config
 */
export function createJaDyServer(config) {
  const database = createDatabase(config);
  const server = createServer(createApiHandler({ database }));

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
