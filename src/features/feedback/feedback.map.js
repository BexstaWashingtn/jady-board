/** @typedef {{ undoLastAction: () => void, dismissUndo: () => void, dismissNotice: () => void }} FeedbackActions */

/** @param {string} message @param {FeedbackActions} actions @returns {import("../../core/JaDyDoCo.js").JaDyNode} */
export function createUndoSnackbar(message, actions) {
  return {
    tagName: "aside",
    class: "snackbar",
    attrs: { role: "status" },
    children: [
      { tagName: "span", class: "snackbar__message", text: message },
      { tagName: "button", type: "button", class: "snackbar__undo", text: "Rückgängig", events: { click: actions.undoLastAction } },
      { tagName: "button", type: "button", class: "snackbar__close", text: "×", attrs: { "aria-label": "Meldung schließen" }, events: { click: actions.dismissUndo } },
    ],
  };
}

/** @param {string} message @param {FeedbackActions} actions @returns {import("../../core/JaDyDoCo.js").JaDyNode} */
export function createNoticeSnackbar(message, actions) {
  return {
    tagName: "aside",
    class: "snackbar snackbar--notice",
    attrs: { role: "alert" },
    children: [
      { tagName: "span", class: "snackbar__icon", text: "!" },
      { tagName: "span", class: "snackbar__message", text: message },
      { tagName: "button", type: "button", class: "snackbar__close", text: "×", attrs: { "aria-label": "Meldung schließen" }, events: { click: actions.dismissNotice } },
    ],
  };
}
