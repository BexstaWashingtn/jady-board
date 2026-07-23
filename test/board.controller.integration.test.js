import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";
import { JSDOM } from "jsdom";

import { createBoardController } from "../src/board/board.controller.js";
import { BOARD_STORAGE_KEY, createInitialBoardState } from "../src/board/board.state.js";
import { createApp } from "../src/core/JaDyDoCo.js";

let dom;

beforeEach(() => {
  dom = new JSDOM("<!doctype html><html><body><div id=\"root\"></div></body></html>", {
    url: "https://example.test/",
  });

  const mediaQuery = {
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  };
  dom.window.matchMedia = () => mediaQuery;
  dom.window.confirm = () => true;
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};

  const browserGlobals = {
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    FormData: dom.window.FormData,
    Node: dom.window.Node,
    HTMLElement: dom.window.HTMLElement,
    HTMLButtonElement: dom.window.HTMLButtonElement,
    HTMLFormElement: dom.window.HTMLFormElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    HTMLSelectElement: dom.window.HTMLSelectElement,
    Event: dom.window.Event,
    KeyboardEvent: dom.window.KeyboardEvent,
    DragEvent: dom.window.DragEvent ?? dom.window.Event,
  };
  Object.assign(globalThis, browserGlobals);
});

afterEach(() => {
  for (const key of [
    "window", "document", "localStorage", "FormData", "Node", "HTMLElement",
    "HTMLButtonElement", "HTMLFormElement", "HTMLInputElement", "HTMLSelectElement",
    "Event", "KeyboardEvent", "DragEvent",
  ]) delete globalThis[key];
  dom.window.close();
});

function startController() {
  return createBoardController(createApp("#root"));
}

function findButton(label) {
  const button = [...document.querySelectorAll("button")]
    .find((candidate) => candidate.textContent.trim() === label);
  assert.ok(button, `Button \"${label}\" wurde nicht gerendert.`);
  return button;
}

function submit(form) {
  form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
}

function switchToBoard(name) {
  const board = [...document.querySelectorAll(".board-link")]
    .find((link) => link.textContent.includes(name));
  assert.ok(board, `Board "${name}" wurde nicht gerendert.`);
  board.click();
}

function dragTransfer() {
  const values = new Map();
  return {
    effectAllowed: "none",
    dropEffect: "none",
    setData(type, value) { values.set(type, String(value)); },
    getData(type) { return values.get(type) ?? ""; },
  };
}

function dragEvent(currentTarget, dataTransfer, clientY = 0) {
  return {
    currentTarget,
    dataTransfer,
    clientY,
    preventDefault() {},
  };
}

function taskCard(taskId) {
  const card = document.querySelector(`.task-card[data-task-id="${taskId}"]`);
  assert.ok(card instanceof HTMLElement, `Task "${taskId}" wurde nicht gerendert.`);
  return card;
}

function column(columnId) {
  const target = document.querySelector(`.kanban-column[data-status="${columnId}"]`);
  assert.ok(target instanceof HTMLElement, `Stage "${columnId}" wurde nicht gerendert.`);
  return target;
}

describe("Board-Controller-Integration", () => {
  test("initialisiert Workspace, Showcase-Daten und Board-Oberfläche", () => {
    startController();

    assert.equal(document.querySelector("h1")?.textContent, "Product Board");
    assert.equal(document.querySelectorAll(".task-card").length, 9);
    assert.ok(findButton("Board konfigurieren"));

    const saved = JSON.parse(localStorage.getItem(BOARD_STORAGE_KEY));
    assert.equal(saved.activeBoardId, "board-1");
    assert.ok(saved.boards["demo-launch"]);
    assert.ok(saved.users["user-demo-mara"]);
  });

  test("wechselt in die filter- und sortierbare Listenansicht", () => {
    startController();
    findButton("Liste").click();

    assert.ok(document.querySelector(".task-list-view"));
    assert.equal(document.querySelectorAll(".task-table__row").length, 9);
    findButton("Titel").click();
    assert.match(document.querySelector(".task-table__sort--active")?.textContent ?? "", /Titel ↑/);

    const search = document.querySelector('input[name="query"]');
    assert.ok(search instanceof HTMLInputElement);
    search.value = "KAN-18";
    search.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    assert.equal(document.querySelectorAll(".task-table__row").length, 1);
    document.querySelector(".task-table__row")?.click();
    assert.ok(document.querySelector(".task-work-form"));
  });

  test("erstellt eine Aufgabe über den vollständigen Formularablauf und persistiert sie", () => {
    startController();
    findButton("+ Neue Aufgabe").click();

    const form = document.querySelector(".task-form");
    assert.ok(form instanceof HTMLFormElement);
    form.elements.namedItem("title").value = "Integrationstest schreiben";
    form.elements.namedItem("category").value = "QA";
    form.elements.namedItem("priority").value = "high";
    form.elements.namedItem("assigneeId").value = "user-1";
    submit(form);

    assert.equal(document.querySelector(".modal"), null);
    assert.match(document.querySelector("#board-content-region")?.textContent ?? "", /Integrationstest schreiben/);

    const saved = JSON.parse(localStorage.getItem(BOARD_STORAGE_KEY));
    const task = Object.values(saved.boards["board-1"].tasks)
      .find((candidate) => candidate.title === "Integrationstest schreiben");
    assert.deepEqual(
      { category: task.category, priority: task.priority, assigneeId: task.assigneeId },
      { category: "QA", priority: "high", assigneeId: "user-1" },
    );
    assert.ok(saved.boards["board-1"].columns[0].taskIds.includes(task.id));
  });

  test("öffnet den globalen Task-Dialog auch ohne eine Stage namens backlog", () => {
    const controller = startController();
    controller.getState().columns[0].id = "ideas";
    controller.render();

    assert.doesNotThrow(() => findButton("+ Neue Aufgabe").click());

    const form = document.querySelector(".task-form");
    assert.ok(form instanceof HTMLFormElement);
    assert.equal(form.elements.namedItem("columnId").value, "ideas");
  });

  test("wechselt Boards, persistiert die Auswahl und blendet Owner-Aktionen für Mitglieder aus", () => {
    startController();
    const supportBoard = [...document.querySelectorAll(".board-link")]
      .find((link) => link.textContent.includes("Support Operations"));
    assert.ok(supportBoard);
    supportBoard.click();

    assert.equal(document.querySelector("h1")?.textContent, "Support Operations");
    assert.equal([...document.querySelectorAll("button")].some((button) => button.textContent.trim() === "Board konfigurieren"), false);
    assert.equal([...document.querySelectorAll("button")].some((button) => button.textContent.trim() === "Stages konfigurieren"), false);

    const saved = JSON.parse(localStorage.getItem(BOARD_STORAGE_KEY));
    assert.equal(saved.activeBoardId, "demo-support");
  });

  test("öffnet und speichert die Board-Konfiguration für den Owner", () => {
    startController();
    findButton("Board konfigurieren").click();

    const form = document.querySelector(".board-details-form");
    assert.ok(form instanceof HTMLFormElement);
    form.elements.namedItem("name").value = "Delivery Board";
    form.elements.namedItem("description").value = "Release-Steuerung";
    submit(form);

    assert.equal(document.querySelector("h1")?.textContent, "Delivery Board");
    const saved = JSON.parse(localStorage.getItem(BOARD_STORAGE_KEY));
    assert.equal(saved.boards["board-1"].project.name, "Delivery Board");
    assert.equal(saved.boards["board-1"].project.description, "Release-Steuerung");
  });

  test("warnt dauerhaft bei einem Speicherfehler und erlaubt einen erneuten Versuch", () => {
    const controller = startController();
    const workingStorage = localStorage;
    globalThis.localStorage = {
      getItem: workingStorage.getItem.bind(workingStorage),
      removeItem: workingStorage.removeItem.bind(workingStorage),
      setItem() { throw new DOMException("Quota exceeded", "QuotaExceededError"); },
    };

    findButton("+ Neue Aufgabe").click();
    const form = document.querySelector(".task-form");
    assert.ok(form instanceof HTMLFormElement);
    form.elements.namedItem("title").value = "Ungespeicherte Aufgabe";
    form.elements.namedItem("category").value = "QA";
    form.elements.namedItem("priority").value = "medium";
    form.elements.namedItem("assigneeId").value = "user-1";
    submit(form);

    const task = Object.values(controller.getState().tasks)
      .find((candidate) => candidate.title === "Ungespeicherte Aufgabe");
    assert.ok(task);
    assert.match(document.querySelector(".persistence-warning")?.textContent ?? "", /nur vorübergehend gespeichert/);

    globalThis.localStorage = workingStorage;
    findButton("Erneut speichern").click();

    assert.equal(document.querySelector(".persistence-warning"), null);
    const saved = JSON.parse(localStorage.getItem(BOARD_STORAGE_KEY));
    assert.equal(saved.boards["board-1"].tasks[task.id].title, "Ungespeicherte Aufgabe");
  });

  test("verschiebt eine Aufgabe per Drag-and-drop, persistiert und macht die Aktion rückgängig", () => {
    const controller = startController();
    switchToBoard("Product Launch");
    const transfer = dragTransfer();

    controller.actions.startTaskDrag(dragEvent(taskCard("LAUNCH-01"), transfer), "LAUNCH-01");
    const target = column("planning");
    controller.actions.dragTaskOverColumn(dragEvent(target, transfer), "planning");

    assert.equal(target.classList.contains("kanban-column--drop-target"), true);
    controller.actions.dropTask(dragEvent(target, transfer), "planning");

    assert.equal(controller.getState().columns.find(({ id }) => id === "planning").taskIds.includes("LAUNCH-01"), true);
    assert.match(document.querySelector(".snackbar")?.textContent ?? "", /LAUNCH-01.*In Umsetzung.*verschoben/);
    let saved = JSON.parse(localStorage.getItem(BOARD_STORAGE_KEY));
    assert.equal(saved.boards["demo-launch"].columns.find(({ id }) => id === "planning").taskIds.includes("LAUNCH-01"), true);

    findButton("Rückgängig").click();

    assert.equal(controller.getState().columns.find(({ id }) => id === "ideas").taskIds.includes("LAUNCH-01"), true);
    saved = JSON.parse(localStorage.getItem(BOARD_STORAGE_KEY));
    assert.equal(saved.boards["demo-launch"].columns.find(({ id }) => id === "ideas").taskIds.includes("LAUNCH-01"), true);
  });

  test("weist einen nicht erlaubten Stage-Übergang mit verständlichem Feedback ab", () => {
    const controller = startController();
    switchToBoard("Product Launch");
    const transfer = dragTransfer();

    controller.actions.startTaskDrag(dragEvent(taskCard("LAUNCH-05"), transfer), "LAUNCH-05");
    const target = column("review");
    controller.actions.dragTaskOverColumn(dragEvent(target, transfer), "review");

    assert.equal(target.classList.contains("kanban-column--drop-rejected"), true);
    assert.equal(target.dataset.dropRejection, "Übergang nicht erlaubt");
    controller.actions.dropTask(dragEvent(target, transfer), "review");

    assert.equal(controller.getState().columns.find(({ id }) => id === "live").taskIds.includes("LAUNCH-05"), true);
    assert.equal(controller.getState().columns.find(({ id }) => id === "review").taskIds.includes("LAUNCH-05"), false);
    assert.match(document.querySelector(".snackbar--notice")?.textContent ?? "", /erlaubt keinen Übergang.*Freigabe/);
    controller.actions.dismissNotice();
  });

  test("markiert ein erreichtes hartes WIP-Limit und blockiert den Drop", () => {
    const controller = startController();
    controller.actions.switchUser("user-demo-mara");
    switchToBoard("Support Operations");

    const firstTransfer = dragTransfer();
    controller.actions.startTaskDrag(dragEvent(taskCard("SUP-31"), firstTransfer), "SUP-31");
    controller.actions.dropTask(dragEvent(column("triage"), firstTransfer), "triage");
    assert.equal(controller.getState().columns.find(({ id }) => id === "triage").taskIds.length, 2);
    controller.actions.dismissUndo();

    const secondTransfer = dragTransfer();
    controller.actions.startTaskDrag(dragEvent(taskCard("SUP-32"), secondTransfer), "SUP-32");
    const fullTarget = column("triage");
    controller.actions.dragTaskOverColumn(dragEvent(fullTarget, secondTransfer), "triage");

    assert.equal(fullTarget.classList.contains("kanban-column--drop-rejected"), true);
    assert.equal(fullTarget.dataset.dropRejection, "WIP-Limit erreicht");
    controller.actions.dropTask(dragEvent(fullTarget, secondTransfer), "triage");

    assert.equal(controller.getState().columns.find(({ id }) => id === "inbox").taskIds.includes("SUP-32"), true);
    assert.equal(controller.getState().columns.find(({ id }) => id === "triage").taskIds.includes("SUP-32"), false);
    const saved = JSON.parse(localStorage.getItem(BOARD_STORAGE_KEY));
    assert.equal(saved.boards["demo-support"].columns.find(({ id }) => id === "triage").taskIds.includes("SUP-32"), false);
  });

  test("ändert den Task-Status nicht, wenn das Ziel-WIP-Limit erreicht ist", async () => {
    const controller = startController();
    controller.actions.switchUser("user-demo-mara");
    switchToBoard("Support Operations");

    const transfer = dragTransfer();
    controller.actions.startTaskDrag(dragEvent(taskCard("SUP-31"), transfer), "SUP-31");
    controller.actions.dropTask(dragEvent(column("triage"), transfer), "triage");
    controller.actions.dismissUndo();

    await new Promise((resolve) => setTimeout(resolve, 200));
    taskCard("SUP-32").click();
    const form = document.querySelector(".task-status-form");
    assert.ok(form instanceof HTMLFormElement);
    const status = form.elements.namedItem("columnId");
    assert.ok(status instanceof HTMLSelectElement);
    status.querySelector('option[value="triage"]').disabled = false;
    status.value = "triage";
    submit(form);

    assert.equal(controller.getState().columns.find(({ id }) => id === "inbox").taskIds.includes("SUP-32"), true);
    assert.match(document.querySelector(".snackbar--notice")?.textContent ?? "", /WIP-Limit erreicht/);
    controller.destroy();
  });

  test("erstellt, bearbeitet, verschiebt und löscht eine Stage über die Konfiguration", () => {
    const controller = startController();
    findButton("Stages konfigurieren").click();
    findButton("+ Stage hinzufügen").click();

    let form = document.querySelector("#stage-editor");
    assert.ok(form instanceof HTMLFormElement);
    form.elements.namedItem("title").value = "Abnahme";
    form.elements.namedItem("color").value = "#336699";
    form.elements.namedItem("kind").value = "review";
    form.elements.namedItem("limit").value = "2";
    form.elements.namedItem("limitMode").disabled = false;
    form.elements.namedItem("limitMode").value = "strict";
    submit(form);

    let stage = controller.getState().columns.find(({ title }) => title === "Abnahme");
    assert.ok(stage);
    assert.deepEqual(
      { color: stage.color, kind: stage.kind, limit: stage.limit, limitMode: stage.limitMode },
      { color: "#336699", kind: "review", limit: 2, limitMode: "strict" },
    );

    controller.actions.editStage(stage.id);
    form = document.querySelector("#stage-editor");
    assert.ok(form instanceof HTMLFormElement);
    form.elements.namedItem("title").value = "Freigabe";
    submit(form);
    stage = controller.getState().columns.find(({ id }) => id === stage.id);
    assert.equal(stage.title, "Freigabe");

    const oldIndex = controller.getState().columns.findIndex(({ id }) => id === stage.id);
    controller.actions.moveStage(stage.id, -1);
    assert.equal(controller.getState().columns.findIndex(({ id }) => id === stage.id), oldIndex - 1);

    controller.actions.requestDeleteStage(stage.id);
    const deleteForm = document.querySelector(".stage-editor--delete");
    assert.ok(deleteForm instanceof HTMLFormElement);
    submit(deleteForm);

    assert.equal(controller.getState().columns.some(({ id }) => id === stage.id), false);
    const saved = JSON.parse(localStorage.getItem(BOARD_STORAGE_KEY));
    assert.equal(saved.boards["board-1"].columns.some(({ id }) => id === stage.id), false);
  });

  test("verwaltet Todos über die Task-Detailansicht und persistiert jede Änderung", () => {
    const controller = startController();
    taskCard("KAN-18").click();

    const newTodo = document.querySelector("#new-todo");
    assert.ok(newTodo instanceof HTMLInputElement);
    newTodo.value = "Akzeptanzkriterien prüfen";
    findButton("Hinzufügen").click();

    let task = controller.getState().tasks["KAN-18"];
    const todo = task.todos.find(({ text }) => text === "Akzeptanzkriterien prüfen");
    assert.ok(todo);
    let row = [...document.querySelectorAll(".todo-row")]
      .find((candidate) => candidate.querySelector('input[type="text"]')?.value === "Akzeptanzkriterien prüfen");
    assert.ok(row);
    const checkbox = row.querySelector('input[type="checkbox"]');
    assert.ok(checkbox instanceof HTMLInputElement);
    checkbox.checked = true;
    checkbox.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    assert.equal(task.todos.find(({ id }) => id === todo.id).completed, true);

    row = [...document.querySelectorAll(".todo-row")]
      .find((candidate) => candidate.querySelector('input[type="text"]')?.value === "Akzeptanzkriterien prüfen");
    const textInput = row?.querySelector('input[type="text"]');
    assert.ok(textInput instanceof HTMLInputElement);
    textInput.value = "Akzeptanzkriterien bestätigen";
    textInput.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    assert.equal(task.todos.find(({ id }) => id === todo.id).text, "Akzeptanzkriterien bestätigen");

    const deleteButton = row.querySelector("button");
    assert.ok(deleteButton instanceof HTMLButtonElement);
    deleteButton.click();
    task = controller.getState().tasks["KAN-18"];
    assert.equal(task.todos.some(({ id }) => id === todo.id), false);
    const saved = JSON.parse(localStorage.getItem(BOARD_STORAGE_KEY));
    assert.equal(saved.boards["board-1"].tasks["KAN-18"].todos.some(({ id }) => id === todo.id), false);
  });

  test("trennt Task-Arbeitsansicht und Metadaten-Bearbeitung", () => {
    const controller = startController();
    taskCard("KAN-18").click();

    assert.ok(document.querySelector(".task-work-form"));
    assert.equal(document.querySelector(".task-edit-form"), null);
    findButton("Bearbeiten").click();

    const form = document.querySelector(".task-edit-form");
    assert.ok(form instanceof HTMLFormElement);
    form.elements.namedItem("title").value = "Überarbeitete Arbeitsansicht";
    form.elements.namedItem("priority").value = "high";
    submit(form);

    assert.ok(document.querySelector(".task-work-form"));
    assert.equal(document.querySelector(".task-edit-form"), null);
    assert.equal(controller.getState().tasks["KAN-18"].title, "Überarbeitete Arbeitsansicht");
    assert.equal(controller.getState().tasks["KAN-18"].priority, "high");
  });

  test("erlaubt Mitgliedern freie Tasks zu übernehmen und wieder freizugeben", () => {
    const controller = startController();
    controller.actions.switchUser("user-demo-lukas");
    switchToBoard("Support Operations");
    taskCard("SUP-32").click();

    assert.equal(controller.getState().tasks["SUP-32"].assigneeId, null);
    findButton("Task übernehmen").click();
    assert.equal(controller.getState().tasks["SUP-32"].assigneeId, "user-demo-lukas");
    assert.ok(findButton("Bearbeiten"));

    findButton("Zuweisung zurückgeben").click();
    assert.equal(controller.getState().tasks["SUP-32"].assigneeId, null);
    assert.equal([...document.querySelectorAll("button")].some((button) => button.textContent.trim() === "Bearbeiten"), false);
  });

  test("hält fremde Tasks für Board-Mitglieder schreibgeschützt", () => {
    const controller = startController();
    controller.actions.switchUser("user-demo-mara");
    switchToBoard("Product Launch");
    taskCard("LAUNCH-03").click();

    assert.equal(document.querySelector("#new-todo"), null);
    assert.equal([...document.querySelectorAll("button")].some((button) => button.textContent.trim() === "Bearbeiten"), false);
    const before = structuredClone(controller.getState().tasks["LAUNCH-03"]);
    controller.actions.addTodo("LAUNCH-03");
    controller.actions.deleteTask("LAUNCH-03");
    assert.deepEqual(controller.getState().tasks["LAUNCH-03"], before);
  });

  test("übersetzt erwartbare Domain-Fehler in sichtbares Feedback", () => {
    const controller = startController();
    taskCard("KAN-18").click();

    const input = document.querySelector("#new-todo");
    assert.ok(input instanceof HTMLInputElement);
    input.value = "   ";

    assert.doesNotThrow(() => controller.actions.addTodo("KAN-18"));
    assert.match(
      document.querySelector(".snackbar--notice")?.textContent ?? "",
      /todo text is required/i,
    );
    assert.equal(controller.getState().tasks["KAN-18"].todos.length, 0);
    controller.destroy();
  });

  test("erstellt, bearbeitet, wechselt und löscht ein lokales Benutzerprofil", () => {
    startController();
    document.querySelector('[aria-label="Benutzerprofil öffnen"]')?.click();

    const createForm = document.querySelector(".user-form--new");
    assert.ok(createForm instanceof HTMLFormElement);
    createForm.elements.namedItem("name").value = "Ada Lovelace";
    createForm.elements.namedItem("initials").value = "AL";
    submit(createForm);

    let saved = JSON.parse(localStorage.getItem(BOARD_STORAGE_KEY));
    const user = Object.values(saved.users).find(({ name }) => name === "Ada Lovelace");
    assert.ok(user);
    assert.equal(saved.activeUserId, user.id);

    const profileForm = document.querySelector(".user-form:not(.user-form--new)");
    assert.ok(profileForm instanceof HTMLFormElement);
    profileForm.elements.namedItem("name").value = "Ada Byron";
    submit(profileForm);
    saved = JSON.parse(localStorage.getItem(BOARD_STORAGE_KEY));
    assert.equal(saved.users[user.id].name, "Ada Byron");

    findButton("Benutzer löschen").click();
    saved = JSON.parse(localStorage.getItem(BOARD_STORAGE_KEY));
    assert.equal(saved.users[user.id], undefined);
    assert.notEqual(saved.activeUserId, user.id);
  });

  test("hält den Fokus im Dialog, schließt mit Escape und stellt den Auslöser wieder her", () => {
    startController();
    findButton("+ Neue Aufgabe").click();

    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    const workspace = document.querySelector(".workspace");
    const title = document.querySelector("#task-title");
    assert.ok(dialog instanceof HTMLElement);
    assert.ok(workspace instanceof HTMLElement);
    assert.ok(title instanceof HTMLInputElement);
    assert.equal(document.activeElement, title);
    assert.equal(workspace.inert, true);
    assert.equal(workspace.getAttribute("aria-hidden"), "true");

    const controls = [...dialog.querySelectorAll('button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .filter((element) => element instanceof HTMLElement);
    const first = controls[0];
    const last = controls[controls.length - 1];
    last.focus();
    document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    assert.equal(document.activeElement, first);

    document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));

    assert.equal(document.querySelector('[role="dialog"][aria-modal="true"]'), null);
    const restoredTrigger = [...document.querySelectorAll("button")]
      .find((button) => button.textContent.trim() === "+ Neue Aufgabe");
    assert.equal(document.activeElement, restoredTrigger);
    assert.equal(document.querySelector(".workspace")?.inert, false);
    assert.equal(document.querySelector(".workspace")?.hasAttribute("aria-hidden"), false);
  });

  test("destroy entfernt den zentralen Dialog-Listener und hebt inert auf", () => {
    const controller = startController();
    findButton("+ Neue Aufgabe").click();
    assert.equal(document.querySelector(".workspace")?.inert, true);

    controller.destroy();
    document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));

    assert.ok(document.querySelector('[role="dialog"][aria-modal="true"]'));
    assert.equal(document.querySelector(".workspace")?.inert, false);
  });
});
