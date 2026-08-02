import { createApp } from "./core/JaDyDoCo.js";
import { createBoardController } from "./board/board.controller.js";
import { loadApiWorkspace, readApiDataSource } from "./board/board.api-client.js";

const app = createApp("#root");
const apiSource = readApiDataSource(window.location);

if (apiSource) {
  try {
    const workspace = await loadApiWorkspace(apiSource);
    createBoardController(app, { workspace, persist: () => true, seedShowcase: false });
  } catch (error) {
    console.warn("JaDy Board API could not be loaded; using the local workspace.", error);
    createBoardController(app);
  }
} else {
  createBoardController(app);
}
