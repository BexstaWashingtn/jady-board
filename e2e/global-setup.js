import { createStaticServer } from "../scripts/static-server.js";

export default async function globalSetup() {
  const server = createStaticServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(4173, "127.0.0.1", resolve);
  });

  return async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  };
}
