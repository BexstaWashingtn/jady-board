import { pathToFileURL } from "node:url";

import { loadConfig } from "../config.js";
import { createDatabase } from "./database.js";
import { linkExternalIdentity } from "./external-identity-link.js";

/** @param {string[]} arguments_ */
export function parseClerkLinkArguments(arguments_) {
  /** @type {Record<string, string>} */
  const values = {};
  let dryRun = false;
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--dry-run") {
      if (dryRun) throw new Error("--dry-run may only be specified once.");
      dryRun = true;
      continue;
    }
    const match = /^(--local-user|--issuer|--subject)(?:=(.*))?$/.exec(argument);
    if (!match) throw new Error(`Unknown argument: ${argument}`);
    const name = match[1].slice(2);
    const inlineValue = match[2];
    const value = inlineValue === undefined ? arguments_[++index] : inlineValue;
    if (!value || value.startsWith("--")) throw new Error(`${match[1]} requires a value.`);
    if (values[name] !== undefined) throw new Error(`${match[1]} may only be specified once.`);
    values[name] = value.trim();
  }
  if (!values["local-user"] || !values.issuer || !values.subject) throw new Error(usage());
  return { localUserId: values["local-user"], issuer: values.issuer, subject: values.subject, dryRun };
}

/** @param {string[]} arguments_ */
export async function runClerkUserLink(arguments_) {
  const { dryRun, ...link } = parseClerkLinkArguments(arguments_);
  const database = createDatabase(loadConfig());
  try {
    return await linkExternalIdentity(database, link, { dryRun });
  } finally {
    await database.end();
  }
}

function usage() {
  return "Usage: npm run db:link-clerk-user -- --local-user <uuid> --issuer <https-url> --subject <user_...> [--dry-run]";
}

async function main() {
  const result = await runClerkUserLink(process.argv.slice(2));
  process.stdout.write(`${result.status}: local user ${result.localUserId}${result.dryRun ? " (dry run)" : ""}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
