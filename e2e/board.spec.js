import { expect, test } from "@playwright/test";

const storageKey = "jadydoco.board";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate((key) => localStorage.removeItem(key), storageKey);
  await page.reload();
});

test("startet mit einem nutzbaren Kanban-Board", async ({ page }) => {
  await expect(page).toHaveTitle(/JaDy Board/);
  await expect(page.getByRole("heading", { level: 1, name: "Product Board" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Kanban-Board" })).toBeVisible();
  await expect(page.locator(".task-card")).toHaveCount(9);
  await expect(page.getByRole("button", { name: "+ Neue Aufgabe" })).toBeVisible();
});

test("erstellt eine Aufgabe über den vollständigen Browser-Workflow", async ({ page }) => {
  await page.getByRole("button", { name: "+ Neue Aufgabe" }).click();

  const dialog = page.getByRole("dialog", { name: "Task zum Board hinzufügen" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Titel").fill("Browser-Smoke-Test ergänzen");
  await dialog.getByLabel("Priorität").selectOption("high");
  await dialog.getByLabel("Kategorie").fill("QA");
  await dialog.getByLabel("Verantwortlich").fill("E2");
  await dialog.getByRole("button", { name: "Aufgabe erstellen" }).click();

  await expect(dialog).toBeHidden();
  const card = page.getByRole("button", { name: /Browser-Smoke-Test ergänzen öffnen/ });
  await expect(card).toBeVisible();
  await expect(card).toContainText("QA");
  await expect(card).toContainText("Hoch");
});

test("behält erstellte Aufgaben nach einem Reload", async ({ page }) => {
  await page.getByRole("button", { name: "+ Neue Aufgabe" }).click();
  const dialog = page.getByRole("dialog", { name: "Task zum Board hinzufügen" });
  await dialog.getByLabel("Titel").fill("Persistente Browser-Aufgabe");
  await dialog.getByRole("button", { name: "Aufgabe erstellen" }).click();

  const savedWorkspace = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey);
  expect(savedWorkspace.version).toBe(4);
  expect(Object.values(savedWorkspace.boards["board-1"].tasks))
    .toEqual(expect.arrayContaining([expect.objectContaining({ title: "Persistente Browser-Aufgabe" })]));

  await page.reload();
  await expect(page.getByRole("button", { name: /Persistente Browser-Aufgabe öffnen/ })).toBeVisible();
});

test("verschiebt eine Aufgabe per Drag-and-drop und bietet Undo an", async ({ page }) => {
  const task = page.locator('.task-card[data-task-id="KAN-18"]');
  const target = page.locator('.kanban-column[data-status="progress"]');

  await page.evaluate(() => {
    const source = document.querySelector('.task-card[data-task-id="KAN-18"]');
    const destination = document.querySelector('.kanban-column[data-status="progress"]');
    if (!source || !destination) throw new Error("Drag source or destination is missing.");
    const dataTransfer = new DataTransfer();
    source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer }));
    destination.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer }));
    destination.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer }));
    source.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer }));
  });

  await expect(target.locator('.task-card[data-task-id="KAN-18"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Rückgängig" })).toBeVisible();

  const savedColumn = await page.evaluate((key) => {
    const workspace = JSON.parse(localStorage.getItem(key));
    return workspace.boards["board-1"].columns.find(({ id }) => id === "progress");
  }, storageKey);
  expect(savedColumn.taskIds).toContain("KAN-18");
});

test("verwaltet den Dialogfokus per Tastatur", async ({ page }) => {
  const trigger = page.getByRole("button", { name: "+ Neue Aufgabe" });
  await trigger.focus();
  await page.keyboard.press("Enter");

  const dialog = page.getByRole("dialog", { name: "Task zum Board hinzufügen" });
  await expect(dialog.getByLabel("Titel")).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("wendet Theme-Tokens und das mobile Layout an", async ({ page }) => {
  const lightStyles = await page.evaluate(() => ({
    page: getComputedStyle(document.documentElement).getPropertyValue("--color-page").trim(),
    surface: getComputedStyle(document.documentElement).getPropertyValue("--color-surface").trim(),
    card: getComputedStyle(document.querySelector(".task-card")).backgroundColor,
  }));
  expect(lightStyles).toEqual({ page: "#f4f5f7", surface: "#ffffff", card: "rgb(255, 255, 255)" });

  await page.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
  const darkStyles = await page.evaluate(() => ({
    page: getComputedStyle(document.documentElement).getPropertyValue("--color-page").trim(),
    surface: getComputedStyle(document.documentElement).getPropertyValue("--color-surface").trim(),
    cardImage: getComputedStyle(document.querySelector(".task-card")).backgroundImage,
  }));
  expect(darkStyles.page).toBe("#111521");
  expect(darkStyles.surface).toBe("#1c2231");
  expect(darkStyles.cardImage).toContain("linear-gradient");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".sidebar")).toBeHidden();
  await expect(page.locator(".topbar")).toHaveCSS("height", "58px");
  await expect(page.locator(".workspace")).toHaveCSS("display", "block");
});
