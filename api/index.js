import { loadConfig } from "../server/src/config.js";
import { createVercelHandler } from "../server/src/http/vercel-handler.js";
import { createJaDyApplication } from "../server/src/server.js";

const application = createJaDyApplication(loadConfig());

export default createVercelHandler(application.handler);
