import { createApp } from "./core/JaDyDoCo.js";
import { createBoardController } from "./board/board.controller.js";
import { assignApiTask, createApiTask, loadApiWorkspace, moveApiTask, readApiDataSource, syncApiTaskTodos, updateApiTask } from "./board/board.api-client.js";

const app = createApp("#root");
const apiSource = readApiDataSource(window.location);

if (apiSource) {
  try {
    const workspace = await loadApiWorkspace(apiSource);
    createBoardController(app, {
      workspace, persist: () => true, seedShowcase: false,
      updateTaskRemote: (boardId, task) => updateApiTask(apiSource, boardId, task),
      moveTaskRemote: (boardId, task, stageId, targetIndex) => moveApiTask(apiSource, boardId, task, stageId, targetIndex),
      createTaskRemote: (boardId, task, stageId) => createApiTask(apiSource, boardId, task, stageId),
      assignTaskRemote: (boardId, task) => assignApiTask(apiSource, boardId, task),
      syncTaskTodosRemote: (boardId, task) => syncApiTaskTodos(apiSource, boardId, task),
    });
  } catch (error) {
    console.warn("JaDy Board API could not be loaded; using the local workspace.", error);
    createBoardController(app);
  }
} else {
  createBoardController(app);
}
