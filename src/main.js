import { createApp } from "./core/JaDyDoCo.js";
import { createBoardController } from "./board/board.controller.js";
import { assignApiTask, createApiStage, createApiTask, deleteApiStage, deleteApiTask, loadApiWorkspace, moveApiStage, moveApiTask, readApiDataSource, syncApiTaskTodos, updateApiBoard, updateApiStage, updateApiTask } from "./board/board.api-client.js";
import { ApiSessionError, clearApiToken, createAuthenticatedRequest, readApiToken, saveApiToken } from "./board/board.api-session.js";
import { createApiLoginPage } from "./templates/api-login.map.js";
import { createApiUnavailablePage } from "./templates/api-unavailable.map.js";

const app = createApp("#root");
const apiSource = readApiDataSource(window.location);

if (apiSource) {
  await startApiMode(apiSource);
} else {
  createBoardController(app);
}

/** @param {string} source */
async function startApiMode(source) {
  /** @type {ReturnType<typeof createBoardController>|null} */
  let controller = null;
  const useLocal = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("data-source");
    url.searchParams.delete("api-url");
    window.location.assign(url);
  };
  /** @param {string|null} [error] */
  const showLogin = (error = null) => {
    controller?.destroy();
    controller = null;
    app.replace(createApiLoginPage({
      apiSource: source, error, useLocal,
      submit: async (event) => {
        event.preventDefault();
        if (!(event.currentTarget instanceof HTMLFormElement)) return;
        const token = String(new FormData(event.currentTarget).get("token") ?? "");
        try {
          saveApiToken(sessionStorage, source, token);
          await connect();
        } catch (loginError) {
          if (!(loginError instanceof ApiSessionError)) showLogin(loginError instanceof Error ? loginError.message : String(loginError));
        }
      },
    }));
  };
  const request = createAuthenticatedRequest({
    token: () => readApiToken(sessionStorage, source),
    onUnauthorized: () => {
      clearApiToken(sessionStorage);
      queueMicrotask(() => showLogin("Die API-Sitzung ist ungültig oder abgelaufen. Bitte melde dich erneut an."));
    },
  });
  const connect = async () => {
    const workspace = await loadApiWorkspace(source, request);
    controller?.destroy();
    controller = createBoardController(app, {
      workspace, persist: () => true, seedShowcase: false,
      updateTaskRemote: (boardId, task) => updateApiTask(source, boardId, task, request),
      moveTaskRemote: (boardId, task, stageId, targetIndex) => moveApiTask(source, boardId, task, stageId, targetIndex, request),
      createTaskRemote: (boardId, task, stageId) => createApiTask(source, boardId, task, stageId, request),
      assignTaskRemote: (boardId, task) => assignApiTask(source, boardId, task, request),
      syncTaskTodosRemote: (boardId, task) => syncApiTaskTodos(source, boardId, task, request),
      deleteTaskRemote: (boardId, task) => deleteApiTask(source, boardId, task, request),
      updateStageRemote: (boardId, stage) => updateApiStage(source, boardId, stage, request),
      createStageRemote: (boardId, stage) => createApiStage(source, boardId, stage, request),
      moveStageRemote: (boardId, stage, targetIndex) => moveApiStage(source, boardId, stage, targetIndex, request),
      deleteStageRemote: (boardId, stage, moveTasksTo) => deleteApiStage(source, boardId, stage, moveTasksTo, request),
      updateBoardRemote: (boardId, state) => updateApiBoard(source, boardId, state, request),
      logoutRemote: () => {
        clearApiToken(sessionStorage);
        showLogin(null);
      },
    });
  };

  try {
    await connect();
  } catch (error) {
    if (error instanceof ApiSessionError && error.status === 401) return;
    console.warn("JaDy Board API could not be loaded.", error);
    app.replace(createApiUnavailablePage({
      apiSource: source, retry: () => window.location.reload(), useLocal,
    }));
  }
}
