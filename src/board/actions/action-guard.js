/**
 * Wraps controller actions at the UI boundary so expected domain validation
 * errors become user-visible feedback instead of uncaught event exceptions.
 *
 * @template {Record<string, (...args: any[]) => any>} T
 * @param {T} actions
 * @param {(error: unknown) => void} onError
 * @returns {T}
 */
export function guardActions(actions, onError) {
  return /** @type {T} */ (Object.fromEntries(
    Object.entries(actions).map(([name, action]) => [
      name,
      (...args) => {
        try {
          const result = action(...args);
          if (result && typeof result.then === "function") {
            return Promise.resolve(result).catch(onError);
          }
          return result;
        } catch (error) {
          onError(error);
          return undefined;
        }
      },
    ]),
  ));
}

/** @param {unknown} error */
export function actionErrorMessage(error) {
  if (!(error instanceof Error) || !error.message.trim()) {
    return "Die Aktion konnte nicht ausgeführt werden.";
  }
  return error.message.replace(/^Board:\s*/, "");
}
