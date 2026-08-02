import { createApp } from "./core/JaDyDoCo.js";
import { createBoardController } from "./board/board.controller.js";
import { loadApiWorkspace, moveApiTask, readApiDataSource, updateApiTask } from "./board/board.api-client.js";

const app = createApp("#root");
const apiSource = readApiDataSource(window.location);

if (apiSource) {
  try {
    const workspace = await loadApiWorkspace(apiSource);
    createBoardController(app, {
      workspace, persist: () => true, seedShowcase: false,
      updateTaskRemote: (boardId, task) => updateApiTask(apiSource, boardId, task),
      moveTaskRemote: (boardId, task, stageId, targetIndex) => moveApiTask(apiSource, boardId, task, stageId, targetIndex),
    });
  } catch (error) {
    console.warn("JaDy Board API could not be loaded; using the local workspace.", error);
    createBoardController(app);
  }
} else {
  createBoardController(app);
}
