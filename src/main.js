import { createApp } from "./core/JaDyDoCo.js";
import { createBoardController } from "./board/board.controller.js";

const app = createApp("#root");

createBoardController(app);
