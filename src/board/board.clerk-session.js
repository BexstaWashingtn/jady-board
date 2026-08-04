/** @typedef {{isSignedIn?: boolean, session?: {getToken: () => Promise<string|null>}, load: (options?: unknown) => Promise<void>, mountSignIn: (node: HTMLDivElement, options?: unknown) => void, unmountSignIn?: (node: HTMLDivElement) => void, signOut: () => Promise<void>}} ClerkBrowser */

/**
 * Loads ClerkJS and its UI bundle from the Frontend API encoded in Clerk's
 * publishable key. This preserves the no-build frontend architecture.
 *
 * @param {string} publishableKey
 * @param {{document?: Document, browser?: Window & typeof globalThis, loadScript?: (url: string, attributes?: Record<string, string>) => Promise<void>}} [dependencies]
 * @returns {Promise<ClerkBrowser>}
 */
export async function loadClerkBrowser(publishableKey, dependencies = {}) {
  const documentObject = dependencies.document ?? globalThis.document;
  const browser = dependencies.browser ?? globalThis.window;
  const loadScript = dependencies.loadScript ?? ((url, attributes) => appendScript(documentObject, url, attributes));
  const frontendApi = clerkFrontendApi(publishableKey);
  await loadScript(`https://${frontendApi}/npm/@clerk/ui@1/dist/ui.browser.js`, {});
  await loadScript(`https://${frontendApi}/npm/@clerk/clerk-js@6/dist/clerk.browser.js`, {
    "data-clerk-publishable-key": publishableKey,
  });
  const browserValues = /** @type {Record<string, any>} */ (browser);
  const clerk = /** @type {ClerkBrowser|undefined} */ (browserValues.Clerk);
  const clerkUi = /** @type {unknown} */ (browserValues.__internal_ClerkUICtor);
  if (!clerk) throw new Error("ClerkJS konnte nicht initialisiert werden.");
  await clerk.load({ ui: { ClerkUI: clerkUi } });
  return clerk;
}

/** @param {string} publishableKey */
export function clerkFrontendApi(publishableKey) {
  if (!/^pk_(test|live)_/.test(publishableKey)) throw new Error("Der Clerk Publishable Key ist ungültig.");
  const encoded = publishableKey.split("_")[2];
  try {
    const decoded = atob(encoded).replace(/\$$/, "");
    if (!/^[a-z0-9.-]+$/i.test(decoded)) throw new Error("invalid domain");
    return decoded;
  } catch { throw new Error("Der Clerk Publishable Key enthält keine gültige Frontend-API-Domain."); }
}

/** @param {Document} documentObject @param {string} url @param {Record<string, string>} [attributes] @returns {Promise<void>} */
function appendScript(documentObject, url, attributes = {}) {
  return new Promise((resolve, reject) => {
    const existing = documentObject.querySelector(`script[src="${url}"]`);
    if (existing) { resolve(); return; }
    const script = documentObject.createElement("script");
    script.src = url;
    script.async = true;
    script.crossOrigin = "anonymous";
    Object.entries(attributes).forEach(([name, value]) => script.setAttribute(name, value));
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error(`Clerk-Ressource konnte nicht geladen werden: ${url}`)), { once: true });
    documentObject.head.append(script);
  });
}
