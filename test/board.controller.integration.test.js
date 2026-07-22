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
});
