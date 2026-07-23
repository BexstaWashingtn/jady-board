import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  addColumn,
  addTask,
  addTaskTodo,
  applyUndo,
  canAcceptTasks,
  canMoveTaskTo,
  createDeleteUndo,
  createInitialBoardState,
  createEmptyFilters,
  createMoveUndo,
  countActiveFilters,
  countTasksByFacet,
  deleteTask,
  deleteTaskTodo,
  deleteColumn,
  hasActiveFilters,
  getDueDateStatus,
  initialBoardState,
  matchesTaskFilters,
  moveTask,
  moveColumn,
  updateColumn,
  updateTask,
  updateTaskTodo,
} from "../src/board/board.state.js";

describe("Board-State", () => {
  test("erzeugt eine unabhängige Kopie des Initialzustands", () => {
    const state = createInitialBoardState();
    state.columns[0].taskIds.push("TEST");
    assert.equal(initialBoardState.columns[0].taskIds.includes("TEST"), false);
  });

  test("fügt eine normalisierte Aufgabe in die gewählte Spalte ein", () => {
    const state = createInitialBoardState();
    const created = addTask(state, {
      title: "  Neue Aufgabe  ",
      category: "UI",
      priority: "high",
      assigneeId: "user-1",
      columnId: "progress",
    });

    assert.equal(created.id, "KAN-25");
    assert.equal(created.title, "Neue Aufgabe");
    assert.equal(created.priority, "high");
    assert.equal(created.assigneeId, "user-1");
    assert.ok(state.columns[1].taskIds.includes(created.id));
  });

  test("verwendet sichere Standardwerte für optionale Task-Daten", () => {
    const state = createInitialBoardState();
    const created = addTask(state, {
      title: "Aufgabe",
      category: null,
      priority: "unbekannt",
      assigneeId: null,
      columnId: "backlog",
    });
    assert.equal(created.category, "Allgemein");
    assert.equal(created.priority, "medium");
    assert.equal(created.assigneeId, null);
  });

  test("weist fehlenden Titel und unbekannte Spalten zurück", () => {
    const state = createInitialBoardState();
    assert.throws(
      () => addTask(state, { title: "", category: "", priority: "low", assigneeId: null, columnId: "backlog" }),
      /title is required/,
    );
    assert.throws(
      () => addTask(state, { title: "Task", category: "", priority: "low", assigneeId: null, columnId: "missing" }),
      /column .* not found/,
    );
  });

  test("verschiebt eine Aufgabe ohne Duplikate in eine andere Spalte", () => {
    const state = createInitialBoardState();
    moveTask(state, "KAN-18", "done");
    assert.equal(state.columns[0].taskIds.includes("KAN-18"), false);
    assert.equal(state.columns[3].taskIds.filter((id) => id === "KAN-18").length, 1);
  });

  test("sortiert Aufgaben innerhalb derselben Spalte nach Zielindex", () => {
    const state = createInitialBoardState();
    moveTask(state, "KAN-24", "backlog", 0);
    assert.deepEqual(state.columns[0].taskIds, ["KAN-24", "KAN-18", "KAN-21"]);

    moveTask(state, "KAN-24", "backlog", 2);
    assert.deepEqual(state.columns[0].taskIds, ["KAN-18", "KAN-21", "KAN-24"]);
  });

  test("erkennt das Ablegen einer Card an derselben Position als No-op", () => {
    const state = createInitialBoardState();
    const before = [...state.columns[0].taskIds];
    assert.equal(moveTask(state, "KAN-21", "backlog", 1), false);
    assert.deepEqual(state.columns[0].taskIds, before);
    assert.equal(moveTask(state, "KAN-24", "backlog"), false);
    assert.deepEqual(state.columns[0].taskIds, before);
  });

  test("fügt Aufgaben an einer bestimmten Position einer anderen Spalte ein", () => {
    const state = createInitialBoardState();
    moveTask(state, "KAN-18", "review", 1);
    assert.deepEqual(state.columns[2].taskIds, ["KAN-09", "KAN-18", "KAN-14"]);
    assert.equal(state.columns[0].taskIds.includes("KAN-18"), false);
  });

  test("begrenzt Zielindizes auf den gültigen Spaltenbereich", () => {
    const state = createInitialBoardState();
    moveTask(state, "KAN-18", "done", -10);
    assert.equal(state.columns[3].taskIds[0], "KAN-18");
    moveTask(state, "KAN-18", "done", 999);
    assert.equal(state.columns[3].taskIds.at(-1), "KAN-18");
  });

  test("weist unbekannte Aufgaben und Zielspalten beim Verschieben zurück", () => {
    const state = createInitialBoardState();
    assert.throws(() => moveTask(state, "KAN-404", "done"), /task .* not found/);
    assert.throws(() => moveTask(state, "KAN-18", "missing"), /column .* not found/);
  });

  test("aktualisiert und normalisiert bestehende Aufgaben", () => {
    const state = createInitialBoardState();
    const updated = updateTask(state, "KAN-18", {
      title: "  Überarbeiteter Titel ",
      category: "",
      priority: "high",
      assigneeId: "user-1",
    });
    assert.equal(updated.title, "Überarbeiteter Titel");
    assert.equal(updated.category, "Allgemein");
    assert.equal(updated.priority, "high");
    assert.equal(updated.assigneeId, "user-1");
  });

  test("behält nicht geänderte Felder und validiert Updates", () => {
    const state = createInitialBoardState();
    const original = { ...state.tasks["KAN-18"] };
    const updated = updateTask(state, "KAN-18", {});
    assert.deepEqual(updated, original);
    assert.throws(() => updateTask(state, "KAN-18", { title: " " }), /title is required/);
    assert.throws(() => updateTask(state, "KAN-404", { title: "Test" }), /task .* not found/);
  });

  test("löscht eine Aufgabe aus State, Spalten und Auswahl", () => {
    const state = createInitialBoardState();
    deleteTask(state, "KAN-18");
    assert.equal(state.tasks["KAN-18"], undefined);
    assert.equal(state.columns.some((column) => column.taskIds.includes("KAN-18")), false);
    assert.throws(() => deleteTask(state, "KAN-18"), /task .* not found/);
  });

  test("erkennt Suchtext unabhängig von Großschreibung in mehreren Feldern", () => {
    const task = createInitialBoardState().tasks["KAN-18"];
    const filters = createEmptyFilters();
    filters.query = "LEERE zustände";
    assert.equal(matchesTaskFilters(task, filters), true);
    filters.query = "kan-18";
    assert.equal(matchesTaskFilters(task, filters), true);
    filters.query = "design";
    assert.equal(matchesTaskFilters(task, filters), true);
    filters.query = "leere zustände";
    assert.equal(matchesTaskFilters(task, filters), true);
    filters.query = "nicht vorhanden";
    assert.equal(matchesTaskFilters(task, filters), false);
  });

  test("kombiniert Priorität, Kategorie und Verantwortlichen", () => {
    const task = createInitialBoardState().tasks["KAN-18"];
    const filters = {
      query: "",
      priority: "medium",
      category: "Design",
      assigneeId: null,
    };
    assert.equal(matchesTaskFilters(task, filters), true);
    assert.equal(matchesTaskFilters(task, { ...filters, priority: "high" }), false);
    assert.equal(matchesTaskFilters(task, { ...filters, category: "Core" }), false);
    assert.equal(matchesTaskFilters(task, { ...filters, assigneeId: "user-1" }), false);
  });

  test("erkennt aktive Filter und liefert einen frischen leeren Filterzustand", () => {
    const filters = createEmptyFilters();
    assert.equal(hasActiveFilters(filters), false);
    filters.query = "  test ";
    assert.equal(hasActiveFilters(filters), true);
    assert.deepEqual(createEmptyFilters(), {
      query: "",
      priority: "all",
      category: "all",
      assigneeId: "all",
    });
  });

  test("zählt aktive Filter einschließlich der Suche", () => {
    const filters = createEmptyFilters();
    assert.equal(countActiveFilters(filters), 0);
    filters.query = "Board";
    filters.priority = "high";
    filters.category = "Core";
    filters.assigneeId = "user-1";
    assert.equal(countActiveFilters(filters), 4);
    filters.query = "   ";
    assert.equal(countActiveFilters(filters), 3);
  });

  test("zählt Facetten unter Berücksichtigung der jeweils anderen Filter", () => {
    const state = createInitialBoardState();
    const priorities = countTasksByFacet(state, "priority");
    assert.deepEqual(priorities, { all: 9, medium: 5, low: 1, high: 3 });

    const filters = { ...createEmptyFilters(), assigneeId: "user-1" };
    assert.deepEqual(countTasksByFacet(state, "priority", filters), {
      all: 4,
      low: 1,
      high: 3,
    });
  });

  test("ignoriert bei Facettenzählung den eigenen aktiven Filter", () => {
    const state = createInitialBoardState();
    const filters = { ...createEmptyFilters(), priority: "high" };
    const counts = countTasksByFacet(state, "priority", filters);
    assert.equal(counts.all, 9);
    assert.equal(counts.medium, 5);
    assert.equal(counts.high, 3);
  });

  test("stellt eine Verschiebung an der ursprünglichen Position wieder her", () => {
    const state = createInitialBoardState();
    const undo = createMoveUndo(state, "KAN-21");
    moveTask(state, "KAN-21", "done", 0);
    applyUndo(state, undo);
    assert.deepEqual(state.columns[0].taskIds, ["KAN-18", "KAN-21", "KAN-24"]);
    assert.equal(state.columns[3].taskIds.includes("KAN-21"), false);
  });

  test("stellt die Reihenfolge nach internem Sortieren wieder her", () => {
    const state = createInitialBoardState();
    const undo = createMoveUndo(state, "KAN-24");
    moveTask(state, "KAN-24", "backlog", 0);
    applyUndo(state, undo);
    assert.deepEqual(state.columns[0].taskIds, ["KAN-18", "KAN-21", "KAN-24"]);
  });

  test("stellt gelöschte Aufgabe, Daten und Position wieder her", () => {
    const state = createInitialBoardState();
    const original = structuredClone(state.tasks["KAN-18"]);
    const undo = createDeleteUndo(state, "KAN-18");
    deleteTask(state, "KAN-18");
    applyUndo(state, undo);
    assert.deepEqual(state.tasks["KAN-18"], original);
    assert.equal(state.columns[0].taskIds[0], "KAN-18");
  });

  test("validiert Undo-Kommandos und doppelte Wiederherstellung", () => {
    const state = createInitialBoardState();
    assert.throws(() => createMoveUndo(state, "KAN-404"), /task .* not found/);
    assert.throws(() => createDeleteUndo(state, "KAN-404"), /task .* not found/);
    const undo = createDeleteUndo(state, "KAN-18");
    assert.throws(() => applyUndo(state, undo), /already exists/);

    deleteTask(state, "KAN-18");
    undo.columnId = "missing";
    assert.throws(() => applyUndo(state, undo), /column .* not found/);
  });

  test("legt eine normalisierte Stage mit stabiler ID an", () => {
    const state = createInitialBoardState();
    const column = addColumn(state, {
      title: " Qualitätssicherung ",
      color: "#123abc",
      kind: "review",
      limit: "5",
    });
    assert.deepEqual(column, {
      id: "stage-1",
      title: "Qualitätssicherung",
      color: "#123abc",
      kind: "review",
      limit: 5,
      limitMode: "warning",
      allowedTargetIds: null,
      requireCompletedTodos: false,
      taskIds: [],
    });
  });

  test("bearbeitet Stage-Eigenschaften ohne ID, Tasks oder Position zu ändern", () => {
    const state = createInitialBoardState();
    const beforeTasks = [...state.columns[1].taskIds];
    const updated = updateColumn(state, "progress", {
      title: "Entwicklung",
      color: "invalid",
      kind: "active",
      limit: "",
    });
    assert.equal(updated.id, "progress");
    assert.equal(updated.title, "Entwicklung");
    assert.equal(updated.color, "#9297a0");
    assert.equal(updated.limit, null);
    assert.deepEqual(updated.taskIds, beforeTasks);
  });

  test("validiert Stage-Titel, Duplikate, Limits und unbekannte IDs", () => {
    const state = createInitialBoardState();
    assert.throws(() => addColumn(state, { title: " " }), /title is required/);
    assert.throws(() => addColumn(state, { title: "backlog" }), /already exists/);
    assert.throws(() => addColumn(state, { title: "Test", limit: 0 }), /positive integer/);
    assert.throws(
      () => addColumn(state, { title: "Strikt ohne Zahl", limit: "", limitMode: "strict" }),
      /requires a maximum task count/,
    );
    assert.throws(() => updateColumn(state, "missing", { title: "Test" }), /column .* not found/);
  });

  test("sortiert Stages und begrenzt die Zielposition", () => {
    const state = createInitialBoardState();
    moveColumn(state, "done", 0);
    assert.equal(state.columns[0].id, "done");
    moveColumn(state, "done", 999);
    assert.equal(state.columns.at(-1).id, "done");
    assert.throws(() => moveColumn(state, "missing", 0), /column .* not found/);
  });

  test("löscht eine Stage und verschiebt enthaltene Tasks sicher", () => {
    const state = createInitialBoardState();
    const moved = [...state.columns[2].taskIds];
    deleteColumn(state, "review", { moveTasksTo: "backlog" });
    assert.equal(state.columns.some(({ id }) => id === "review"), false);
    moved.forEach((taskId) => assert.ok(state.columns[0].taskIds.includes(taskId)));
    moved.forEach((taskId) => assert.ok(state.tasks[taskId]));
  });

  test("verhindert Datenverlust und das Löschen der letzten Stage", () => {
    const state = createInitialBoardState();
    assert.throws(() => deleteColumn(state, "review"), /valid target column/);
    assert.throws(() => deleteColumn(state, "review", { moveTasksTo: "review" }), /valid target column/);
    assert.throws(() => deleteColumn(state, "missing"), /column .* not found/);

    state.columns = [state.columns[0]];
    assert.throws(() => deleteColumn(state, "backlog"), /at least one column/);
  });

  test("kann Tasks bei ausdrücklich destruktiver Löschung entfernen", () => {
    const state = createInitialBoardState();
    const deletedIds = [...state.columns[2].taskIds];
    deleteColumn(state, "review", { deleteTasks: true });
    deletedIds.forEach((taskId) => assert.equal(state.tasks[taskId], undefined));
  });

  test("löscht eine leere Stage ohne Zielspalte", () => {
    const state = createInitialBoardState();
    const stage = addColumn(state, { title: "Leer" });
    deleteColumn(state, stage.id);
    assert.equal(state.columns.some(({ id }) => id === stage.id), false);
  });

  test("blockiert neue Tasks an einem erreichten harten WIP-Limit", () => {
    const state = createInitialBoardState();
    state.columns[2].limit = 2;
    state.columns[2].limitMode = "strict";
    assert.equal(canAcceptTasks(state, "review"), false);
    assert.throws(
      () => addTask(state, { title: "Neu", category: "QA", priority: "low", assigneeId: "user-1", columnId: "review" }),
      /WIP limit/,
    );
    assert.throws(() => moveTask(state, "KAN-18", "review"), /WIP limit/);
  });

  test("erlaubt Sortieren innerhalb einer vollen Stage und Herausbewegen", () => {
    const state = createInitialBoardState();
    state.columns[2].limit = 2;
    state.columns[2].limitMode = "strict";
    assert.equal(canAcceptTasks(state, "review", 1, "KAN-09"), true);
    moveTask(state, "KAN-14", "review", 0);
    assert.deepEqual(state.columns[2].taskIds, ["KAN-14", "KAN-09"]);
    moveTask(state, "KAN-14", "backlog");
    assert.equal(state.columns[2].taskIds.includes("KAN-14"), false);
  });

  test("warnt bei weichem Limit, blockiert die State-Operation aber nicht", () => {
    const state = createInitialBoardState();
    state.columns[1].limit = 2;
    state.columns[1].limitMode = "warning";
    assert.equal(canAcceptTasks(state, "progress"), true);
    moveTask(state, "KAN-18", "progress");
    assert.equal(state.columns[1].taskIds.length, 3);
  });

  test("verhindert Stage-Löschung bei unzureichender harter Zielkapazität", () => {
    const state = createInitialBoardState();
    state.columns[0].limit = 3;
    state.columns[0].limitMode = "strict";
    assert.throws(
      () => deleteColumn(state, "review", { moveTasksTo: "backlog" }),
      /WIP limit/,
    );
    assert.ok(state.columns.some(({ id }) => id === "review"));
  });

  test("erlaubt standardmäßig Übergänge in alle Stages", () => {
    const state = createInitialBoardState();
    assert.equal(canMoveTaskTo(state, "KAN-18", "done"), true);
    moveTask(state, "KAN-18", "done");
    assert.ok(state.columns.find(({ id }) => id === "done")?.taskIds.includes("KAN-18"));
  });

  test("blockiert nicht konfigurierte Stage-Übergänge zentral", () => {
    const state = createInitialBoardState();
    updateColumn(state, "backlog", { title: "Backlog", allowedTargetIds: ["progress"] });
    assert.equal(canMoveTaskTo(state, "KAN-18", "progress"), true);
    assert.equal(canMoveTaskTo(state, "KAN-18", "done"), false);
    assert.throws(() => moveTask(state, "KAN-18", "done"), /transition .* not allowed/);
    assert.ok(state.columns.find(({ id }) => id === "backlog")?.taskIds.includes("KAN-18"));
  });

  test("erlaubt Sortieren innerhalb einer Stage trotz Übergangsregeln", () => {
    const state = createInitialBoardState();
    updateColumn(state, "backlog", { title: "Backlog", allowedTargetIds: [] });
    assert.equal(canMoveTaskTo(state, "KAN-24", "backlog"), true);
    moveTask(state, "KAN-24", "backlog", 0);
    assert.equal(state.columns[0].taskIds[0], "KAN-24");
  });

  test("validiert unbekannte Kapazitätsziele", () => {
    assert.throws(
      () => canAcceptTasks(createInitialBoardState(), "missing"),
      /column .* not found/,
    );
  });

  test("verwaltet Todos einer Aufgabe vollständig", () => {
    const state = createInitialBoardState();
    const todo = addTaskTodo(state, "KAN-18", "  Entwurf prüfen  ");
    assert.deepEqual(todo, { id: "todo-1", text: "Entwurf prüfen", completed: false });
    updateTaskTodo(state, "KAN-18", todo.id, { text: "Entwurf freigeben", completed: true });
    assert.deepEqual(state.tasks["KAN-18"].todos[0], { id: "todo-1", text: "Entwurf freigeben", completed: true });
    deleteTaskTodo(state, "KAN-18", todo.id);
    assert.deepEqual(state.tasks["KAN-18"].todos, []);
  });

  test("validiert Task-Todos und vergibt stabile IDs", () => {
    const state = createInitialBoardState();
    addTaskTodo(state, "KAN-18", "Erster Schritt");
    assert.equal(addTaskTodo(state, "KAN-18", "Zweiter Schritt").id, "todo-2");
    assert.throws(() => addTaskTodo(state, "KAN-18", " "), /todo text is required/);
    assert.throws(() => addTaskTodo(state, "KAN-404", "Test"), /task .* not found/);
    assert.throws(() => updateTaskTodo(state, "KAN-18", "missing", { completed: true }), /todo .* not found/);
    assert.throws(() => deleteTaskTodo(state, "KAN-18", "missing"), /todo .* not found/);
  });

  test("blockiert Ziel-Stages bei offenen Todos, wenn die Abschlussregel aktiv ist", () => {
    const state = createInitialBoardState();
    addTaskTodo(state, "KAN-18", "Qualität prüfen");
    updateColumn(state, "done", { title: "Erledigt", requireCompletedTodos: true });
    assert.equal(canMoveTaskTo(state, "KAN-18", "done"), false);
    assert.throws(() => moveTask(state, "KAN-18", "done"), /open todos/);
    updateTaskTodo(state, "KAN-18", "todo-1", { completed: true });
    assert.equal(canMoveTaskTo(state, "KAN-18", "done"), true);
    moveTask(state, "KAN-18", "done");
  });

  test("erlaubt Abschluss-Stages für Tasks ohne Todos", () => {
    const state = createInitialBoardState();
    updateColumn(state, "done", { title: "Erledigt", requireCompletedTodos: true });
    assert.equal(canMoveTaskTo(state, "KAN-18", "done"), true);
  });

  test("speichert und entfernt ein validiertes Fälligkeitsdatum", () => {
    const state = createInitialBoardState();
    updateTask(state, "KAN-18", { dueDate: "2026-08-14" });
    assert.equal(state.tasks["KAN-18"].dueDate, "2026-08-14");
    updateTask(state, "KAN-18", { dueDate: "" });
    assert.equal(state.tasks["KAN-18"].dueDate, null);
    assert.throws(() => updateTask(state, "KAN-18", { dueDate: "2026-02-30" }), /due date/);
  });

  test("ermittelt den Status eines Fälligkeitsdatums deterministisch", () => {
    const today = new Date(2026, 6, 22);
    assert.equal(getDueDateStatus(null, today), "none");
    assert.equal(getDueDateStatus("2026-07-21", today), "overdue");
    assert.equal(getDueDateStatus("2026-07-22", today), "today");
    assert.equal(getDueDateStatus("2026-07-25", today), "soon");
    assert.equal(getDueDateStatus("2026-08-01", today), "upcoming");
  });
});
