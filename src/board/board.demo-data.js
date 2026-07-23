import { createInitialBoardState } from "./board.state.js";

/** @param {import("./board.persistence.js").BoardWorkspace} workspace */
export function ensureShowcaseData(workspace) {
  let changed = false;
  if (!workspace.users["user-demo-mara"]) {
    workspace.users["user-demo-mara"] = { id: "user-demo-mara", name: "Mara Klein", initials: "MK", preferences: { theme: "system" } };
    changed = true;
  }
  if (!workspace.users["user-demo-lukas"]) {
    workspace.users["user-demo-lukas"] = { id: "user-demo-lukas", name: "Lukas Stein", initials: "LS", preferences: { theme: "system" } };
    changed = true;
  }
  if (!workspace.boards["demo-launch"]) {
    workspace.boards["demo-launch"] = createLaunchShowcase(workspace.activeUserId);
    changed = true;
  }
  if (!workspace.boards["demo-support"]) {
    workspace.boards["demo-support"] = createSupportShowcase(workspace.activeUserId);
    changed = true;
  }
  return changed;
}

/** @param {string} ownerId @returns {import("./board.state.js").BoardState} */
function createLaunchShowcase(ownerId) {
  const board = createInitialBoardState();
  const members = [...new Set([ownerId, "user-demo-mara", "user-demo-lukas"])];
  board.project = { name: "Product Launch", path: "Showcase / Product Launch", description: "Website-Launch mit Review-Gates, Deadlines und Team-Zuständigkeiten.", ownerId, memberIds: members };
  board.columns = [
    demoColumn("ideas", "Ideen", "#9297a0", "backlog", null, "warning", ["planning"], false, ["LAUNCH-01"]),
    demoColumn("planning", "In Umsetzung", "#e5a84b", "active", 3, "strict", ["review"], false, ["LAUNCH-02", "LAUNCH-03"]),
    demoColumn("review", "Freigabe", "#8b7cf6", "review", 2, "warning", ["live", "planning"], true, ["LAUNCH-04"]),
    demoColumn("live", "Live", "#57b894", "done", null, "warning", ["planning"], true, ["LAUNCH-05"]),
  ];
  board.tasks = {
    "LAUNCH-01": demoTask("LAUNCH-01", "Launch-Kampagne konzipieren", "Marketing", "medium", ownerId, relativeDate(10), [["Zielgruppe definieren", true], ["Kanäle priorisieren", false], ["Budget abstimmen", false]]),
    "LAUNCH-02": demoTask("LAUNCH-02", "Pricing-Seite finalisieren", "Frontend", "high", "user-demo-mara", relativeDate(0), [["Responsive Layout", true], ["Tracking Events", false], ["Copy einpflegen", true], ["QA durchführen", false]]),
    "LAUNCH-03": demoTask("LAUNCH-03", "Release Notes vorbereiten", "Docs", "low", "user-demo-lukas", relativeDate(3), [["Features sammeln", true], ["Screenshots ergänzen", false]]),
    "LAUNCH-04": demoTask("LAUNCH-04", "Checkout End-to-End prüfen", "QA", "high", ownerId, relativeDate(-1), [["Desktop geprüft", true], ["Mobile geprüft", false], ["Zahlung geprüft", true]]),
    "LAUNCH-05": demoTask("LAUNCH-05", "Design-System veröffentlicht", "Design", "medium", "user-demo-mara", relativeDate(-5), [["Tokens dokumentiert", true], ["Komponenten freigegeben", true]]),
  };
  return board;
}

/** @param {string} ownerId @returns {import("./board.state.js").BoardState} */
function createSupportShowcase(ownerId) {
  const board = createInitialBoardState();
  const members = [...new Set([ownerId, "user-demo-mara", "user-demo-lukas"])];
  board.project = { name: "Support Operations", path: "Showcase / Support Operations", description: "Triage-Board mit harten WIP-Limits und geregelten Eskalationen.", ownerId: "user-demo-mara", memberIds: members };
  board.columns = [
    demoColumn("inbox", "Eingang", "#9297a0", "backlog", 5, "warning", ["triage"], false, ["SUP-31", "SUP-32"]),
    demoColumn("triage", "Triage", "#e5a84b", "active", 2, "strict", ["solve", "inbox"], false, ["SUP-28"]),
    demoColumn("solve", "Lösung", "#8b7cf6", "review", 3, "strict", ["closed", "triage"], false, ["SUP-24"]),
    demoColumn("closed", "Geschlossen", "#57b894", "done", null, "warning", ["triage"], true, ["SUP-19"]),
  ];
  board.tasks = {
    "SUP-31": demoTask("SUP-31", "Login nach Passwortwechsel blockiert", "Incident", "high", "user-demo-lukas", relativeDate(0), [["Logs sichern", false], ["Kunden informieren", false]]),
    "SUP-32": demoTask("SUP-32", "Export enthält falsche Zeitzone", "Bug", "medium", null, relativeDate(7), []),
    "SUP-28": demoTask("SUP-28", "Webhook-Ausfälle analysieren", "Platform", "high", "user-demo-mara", relativeDate(2), [["Monitoring prüfen", true], ["Retries auswerten", false]]),
    "SUP-24": demoTask("SUP-24", "CSV-Encoding korrigieren", "Bug", "medium", ownerId, relativeDate(-2), [["Fix implementieren", true], ["Regressionstest", false]]),
    "SUP-19": demoTask("SUP-19", "Hilfecenter aktualisieren", "Docs", "low", "user-demo-lukas", relativeDate(-8), [["Artikel schreiben", true], ["Review abschließen", true]]),
  };
  return board;
}

/** @param {string} id @param {string} title @param {string} color @param {import("./board.state.js").ColumnKind} kind @param {number|null} limit @param {import("./board.state.js").LimitMode} limitMode @param {string[]} allowedTargetIds @param {boolean} requireCompletedTodos @param {string[]} taskIds */
function demoColumn(id, title, color, kind, limit, limitMode, allowedTargetIds, requireCompletedTodos, taskIds) {
  return { id, title, color, kind, limit, limitMode, allowedTargetIds, requireCompletedTodos, taskIds };
}

/** @param {string} id @param {string} title @param {string} category @param {"low"|"medium"|"high"} priority @param {string|null} assigneeId @param {string} dueDate @param {Array<[string, boolean]>} todos */
function demoTask(id, title, category, priority, assigneeId, dueDate, todos) {
  return { id, title, category, priority, comments: todos.length, dueDate, assigneeId, todos: todos.map(([text, completed], index) => ({ id: `todo-${index + 1}`, text, completed })) };
}

/** @param {number} offsetDays */
function relativeDate(offsetDays) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
