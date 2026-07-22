import { backupWorkspace, persistWorkspace } from "../board.persistence.js";
import {
  MAX_BACKUP_BYTES,
  backupFilename,
  parseWorkspaceBackup,
  serializeWorkspaceBackup,
} from "../board.transfer.js";

/** @param {import("./action-context.js").BoardActionContext} context */
export function createTransferActions(context) {
  return {
    openWorkspaceImportPicker() {
      const input = document.querySelector("#workspace-backup-file");
      if (input instanceof HTMLInputElement) input.click();
    },

    exportWorkspace() {
      const now = new Date();
      const blob = new Blob([serializeWorkspaceBackup(context.workspace, now)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = backupFilename(now);
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      context.overlays.transfer.lastExportedAt = now.toISOString();
      context.render();
    },

    /** @param {Event} event */
    async previewWorkspaceImport(event) {
      const input = event.currentTarget;
      if (!(input instanceof HTMLInputElement)) return;
      const file = input.files?.[0];
      input.value = "";
      if (!file) return;

      context.overlays.transfer.preview = null;
      context.overlays.transfer.error = null;
      if (file.size > MAX_BACKUP_BYTES) {
        context.overlays.transfer.error = "Die Backup-Datei ist größer als 5 MB.";
        context.render();
        return;
      }

      try {
        context.overlays.transfer.preview = parseWorkspaceBackup(await file.text());
      } catch (error) {
        context.overlays.transfer.error = error instanceof Error ? error.message : "Das Backup konnte nicht gelesen werden.";
      }
      context.render();
    },

    cancelWorkspaceImport() {
      context.overlays.transfer.preview = null;
      context.overlays.transfer.error = null;
      context.render();
    },

    confirmWorkspaceImport() {
      const preview = context.overlays.transfer.preview;
      if (!preview) return;
      if (!backupWorkspace(context.workspace)) {
        context.overlays.transfer.error = "Der aktuelle Workspace konnte nicht gesichert werden. Der Import wurde abgebrochen.";
        context.render();
        return;
      }
      if (!persistWorkspace(preview.workspace)) {
        context.overlays.transfer.error = "Das Backup konnte nicht im Browserspeicher gesichert werden. Der Import wurde abgebrochen.";
        context.render();
        return;
      }

      context.workspace.activeBoardId = preview.workspace.activeBoardId;
      context.workspace.boards = preview.workspace.boards;
      context.workspace.activeUserId = preview.workspace.activeUserId;
      context.workspace.users = preview.workspace.users;
      Object.keys(context.boardViewStates).forEach((id) => delete context.boardViewStates[id]);
      context.setState(context.workspace.boards[context.workspace.activeBoardId]);
      context.setViewState(context.getBoardViewState(context.workspace.activeBoardId));
      context.clearUndoTimer();
      context.closeBoardAdministration();
      context.overlays.appSettingsOpen = false;
      context.overlays.transfer.preview = null;
      context.overlays.transfer.error = null;
      context.applyUserTheme();
      context.registerNotice("Backup erfolgreich importiert.");
    },
  };
}
