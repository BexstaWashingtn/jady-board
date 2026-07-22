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

  test("erstellt eine Aufgabe über den vollständigen Formularablauf und persistiert sie", () => {
    startController();
    findButton("+ Neue Aufgabe").click();

    const form = document.querySelector(".task-form");
    assert.ok(form instanceof HTMLFormElement);
    form.elements.namedItem("title").value = "Integrationstest schreiben";
    form.elements.namedItem("category").value = "QA";
    form.elements.namedItem("priority").value = "high";
    form.elements.namedItem("assignee").value = "mk";
    submit(form);

    assert.equal(document.querySelector(".modal"), null);
    assert.match(document.querySelector("#kanban-region")?.textContent ?? "", /Integrationstest schreiben/);

    const saved = JSON.parse(localStorage.getItem(BOARD_STORAGE_KEY));
    const task = Object.values(saved.boards["board-1"].tasks)
      .find((candidate) => candidate.title === "Integrationstest schreiben");
    assert.deepEqual(
      { category: task.category, priority: task.priority, assignee: task.assignee },
      { category: "QA", priority: "high", assignee: "MK" },
    );
    assert.ok(saved.boards["board-1"].columns[0].taskIds.includes(task.id));
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
    form.elements.namedItem("assignee").value = "TB";
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
});
