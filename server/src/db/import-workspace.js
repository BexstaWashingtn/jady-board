import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { loadConfig } from "../config.js";
import { createDatabase } from "./database.js";
import { createWorkspaceImportPlan, importWorkspace } from "./workspace-import.js";

/** @param {string[]} arguments_ */
export async function runWorkspaceImport(arguments_) {
  const dryRun = arguments_.includes("--dry-run");
  const filename = arguments_.find((argument) => argument !== "--dry-run");
  if (!filename) throw new Error("Usage: npm run db:import -- [--dry-run] <backup.json>");
  const source = await readFile(filename, "utf8");
  const plan = createWorkspaceImportPlan(source);
  const summary = {
    fingerprint: plan.fingerprint,
    users: plan.users.length,
    boards: plan.boards.length,
    stages: plan.stages.length,
    tasks: plan.tasks.length,
    todos: plan.todos.length,
    transitions: plan.transitions.length,
  };
  if (dryRun) return { dryRun: true, ...summary };

  const database = createDatabase(loadConfig());
  try {
    await importWorkspace(database, plan);
    return { dryRun: false, ...summary };
  } finally {
    await database.end();
  }
}

async function main() {
  const result = await runWorkspaceImport(process.argv.slice(2));
  process.stdout.write(`${result.dryRun ? "Validated" : "Imported"} workspace: ${JSON.stringify(result)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
