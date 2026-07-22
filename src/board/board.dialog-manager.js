const DIALOG_SELECTOR = '[role="dialog"][aria-modal="true"]';
const BACKGROUND_SELECTOR = ".topbar, .workspace, #undo-region";
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/** @typedef {{ selector: string, index: number } | null} FocusDescriptor */

/**
 * Coordinates modal focus behavior across full application re-renders.
 *
 * @param {{ onEscape: () => void }} options
 */
export function createDialogManager({ onEscape }) {
  let hadDialogBeforeRender = false;
  /** @type {FocusDescriptor} */
  let backgroundFocus = null;
  /** @type {FocusDescriptor} */
  let dialogFocus = null;

  function beforeRender() {
    const dialog = document.querySelector(DIALOG_SELECTOR);
    hadDialogBeforeRender = dialog instanceof HTMLElement;
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return;
    const descriptor = describeFocus(active);
    if (hadDialogBeforeRender && dialog?.contains(active) && descriptor) dialogFocus = descriptor;
    else if (!hadDialogBeforeRender && descriptor) backgroundFocus = descriptor;
  }

  function afterRender() {
    const dialog = document.querySelector(DIALOG_SELECTOR);
    setBackgroundInert(dialog instanceof HTMLElement);

    if (!(dialog instanceof HTMLElement)) {
      if (hadDialogBeforeRender) restoreFocus(document, backgroundFocus);
      dialogFocus = null;
      return;
    }

    if (hadDialogBeforeRender && restoreFocus(dialog, dialogFocus)) return;
    focusInitialControl(dialog);
  }

  /** @param {KeyboardEvent} event */
  function handleKeydown(event) {
    const dialog = document.querySelector(DIALOG_SELECTOR);
    if (!(dialog instanceof HTMLElement)) return;

    if (event.key === "Escape") {
      event.preventDefault();
      onEscape();
      return;
    }
    if (event.key !== "Tab") return;

    const controls = focusableControls(dialog);
    if (!controls.length) {
      event.preventDefault();
      dialog.tabIndex = -1;
      dialog.focus();
      return;
    }
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /** @param {MouseEvent} event */
  function handleClick(event) {
    if (document.querySelector(DIALOG_SELECTOR)) return;
    const target = event.target;
    if (target instanceof HTMLElement) backgroundFocus = describeFocus(target);
  }

  function destroy() {
    document.removeEventListener("keydown", handleKeydown);
    document.removeEventListener("click", handleClick, true);
    setBackgroundInert(false);
    backgroundFocus = null;
    dialogFocus = null;
  }

  document.addEventListener("keydown", handleKeydown);
  document.addEventListener("click", handleClick, true);
  return { beforeRender, afterRender, destroy };
}

/** @param {HTMLElement} dialog */
function focusInitialControl(dialog) {
  const preferred = dialog.querySelector('input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])');
  if (preferred instanceof HTMLElement) { preferred.focus(); return; }
  const first = focusableControls(dialog)[0];
  if (first) { first.focus(); return; }
  dialog.tabIndex = -1;
  dialog.focus();
}

/** @param {HTMLElement} dialog @returns {HTMLElement[]} */
function focusableControls(dialog) {
  /** @type {HTMLElement[]} */
  const controls = [];
  dialog.querySelectorAll(FOCUSABLE_SELECTOR).forEach((element) => {
    if (element instanceof HTMLElement && !element.hidden) controls.push(element);
  });
  return controls;
}

/** @param {boolean} inert */
function setBackgroundInert(inert) {
  document.querySelectorAll(BACKGROUND_SELECTOR).forEach((element) => {
    if (!(element instanceof HTMLElement)) return;
    element.inert = inert;
    if (inert) element.setAttribute("aria-hidden", "true");
    else element.removeAttribute("aria-hidden");
  });
}

/** @param {HTMLElement} element */
function describeFocus(element) {
  if (element.id) return { selector: `#${escapeSelector(element.id)}`, index: 0 };
  const attributes = ["aria-label", "name", "data-task-id"];
  for (const attribute of attributes) {
    const value = element.getAttribute(attribute);
    if (value) return indexedDescriptor(`[${attribute}="${escapeAttribute(value)}"]`, element);
  }
  const className = [...element.classList][0];
  return className ? indexedDescriptor(`.${escapeSelector(className)}`, element) : null;
}

/** @param {string} selector @param {HTMLElement} element */
function indexedDescriptor(selector, element) {
  const matches = [...document.querySelectorAll(selector)];
  return { selector, index: Math.max(0, matches.indexOf(element)) };
}

/** @param {ParentNode} root @param {{selector: string, index: number} | null} descriptor */
function restoreFocus(root, descriptor) {
  if (!descriptor) return false;
  const target = root.querySelectorAll(descriptor.selector)[descriptor.index];
  if (!(target instanceof HTMLElement)) return false;
  target.focus();
  return true;
}

/** @param {string} value */
function escapeAttribute(value) { return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"'); }
/** @param {string} value */
function escapeSelector(value) { return value.replace(/([^a-zA-Z0-9_-])/g, "\\$1"); }
