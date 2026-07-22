/** @param {import("./board.types.js").UserView} user @param {string} name @param {boolean} checked @param {boolean} disabled @returns {import("../../core/JaDyDoCo.js").JaDyNode} */
export function memberOption(user, name, checked, disabled) {
  return {
    tagName: "label",
    class: "member-option",
    children: [
      { tagName: "input", type: "checkbox", name, value: user.id, checked, disabled },
      { tagName: "span", class: "avatar", text: user.initials },
      { tagName: "span", text: user.name },
    ],
  };
}



