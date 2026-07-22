/** @param {import("./action-context.js").BoardActionContext} context */
export function createUserActions(context) {
  return {
    openAppSettings() { context.overlays.appSettingsOpen = true; context.render(); },
    closeAppSettings() { context.overlays.appSettingsOpen = false; context.render(); },
    openUserSettings() { context.overlays.userSettingsOpen = true; context.render(); },
    closeUserSettings() { context.overlays.userSettingsOpen = false; context.render(); },

    /** @param {string} userId */
    switchUser(userId) {
      if (!context.workspace.users[userId]) return;
      context.workspace.activeUserId = userId;
      context.closeBoardAdministration();
      context.applyUserTheme();
      context.saveState();
      context.render();
    },

    /** @param {string} theme */
    setTheme(theme) {
      if (theme !== "light" && theme !== "dark" && theme !== "system") return;
      context.workspace.users[context.workspace.activeUserId].preferences.theme = theme;
      context.applyUserTheme();
      context.saveState();
    },

    /** @param {Event} event */
    submitUser(event) {
      event.preventDefault();
      if (!(event.currentTarget instanceof HTMLFormElement)) return;
      const data = new FormData(event.currentTarget);
      const name = String(data.get("name") ?? "").trim();
      if (!name) return;
      const user = context.workspace.users[context.workspace.activeUserId];
      user.name = name;
      user.initials = normalizeInitials(data.get("initials"), name);
      context.saveState();
      context.render();
    },

    /** @param {Event} event */
    createUser(event) {
      event.preventDefault();
      if (!(event.currentTarget instanceof HTMLFormElement)) return;
      const data = new FormData(event.currentTarget);
      const name = String(data.get("name") ?? "").trim();
      if (!name) return;
      const id = nextUserId(context.workspace.users);
      context.workspace.users[id] = { id, name, initials: normalizeInitials(data.get("initials"), name), preferences: { theme: "system" } };
      context.workspace.activeUserId = id;
      context.saveState();
      context.render();
    },

    deleteUser() {
      const { workspace } = context;
      if (Object.keys(workspace.users).length === 1) return;
      const user = workspace.users[workspace.activeUserId];
      const ownedBoard = Object.values(workspace.boards).find((board) => board.project.ownerId === user.id);
      if (ownedBoard) {
        context.registerNotice(`Benutzer kann nicht gelöscht werden: Er besitzt das Board „${ownedBoard.project.name}“.`);
        return;
      }
      if (!window.confirm(`Benutzer „${user.name}“ wirklich löschen?`)) return;
      Object.values(workspace.boards).forEach((board) => {
        board.project.memberIds = board.project.memberIds.filter((id) => id !== user.id);
        Object.values(board.tasks).forEach((task) => {
          if (task.ownerId === user.id) task.ownerId = null;
          task.memberIds = task.memberIds.filter((id) => id !== user.id);
        });
      });
      delete workspace.users[workspace.activeUserId];
      workspace.activeUserId = Object.keys(workspace.users)[0];
      context.saveState();
      context.render();
    },
  };
}

/** @param {unknown} value @param {string} name */
function normalizeInitials(value, name) {
  const entered = String(value ?? "").trim();
  return (entered || name.split(/\s+/).map((part) => part[0]).join("")).toUpperCase().slice(0, 2);
}

/** @param {Record<string, import("../board.persistence.js").BoardUser>} users */
function nextUserId(users) {
  let number = 1;
  while (users[`user-${number}`]) number += 1;
  return `user-${number}`;
}
