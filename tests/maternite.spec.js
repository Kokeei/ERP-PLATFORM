// Parcours "maternité" : check-list générée automatiquement, pièces jointes
// obligatoires/facultatives, blocage de la clôture, rappels d'échéance.
const { test, expect } = require("@playwright/test");

async function createMaterniteDossier(page, agentName) {
  await page.click("#addBtn");
  const option = page.locator('select[data-k="agentId"] option', { hasText: agentName }).first();
  const value = await option.evaluate((el) => el.value);
  await page.selectOption('select[data-k="agentId"]', value);
  await page.click("#saveModal");
}

test.describe("Maternité — profil RH", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/rh/");
    await page.locator("#nav a", { hasText: "Maternité" }).click();
    await expect(page.locator("#pageTitle")).toHaveText("Maternité");
  });

  test("la création d'un dossier génère automatiquement la check-list (cas nominal)", async ({ page }) => {
    await createMaterniteDossier(page, "AH SCHA");

    await expect(page.locator("#toast")).toHaveText("Enregistrement créé");
    const row = page.locator("tbody tr", { hasText: "AH SCHA" });
    await expect(row).toContainText("0/5 tâches réalisées");
    await expect(row.locator(".badge")).toHaveText("En cours");
  });

  test("une tâche facultative se marque comme faite sans pièce jointe", async ({ page }) => {
    await createMaterniteDossier(page, "AH SCHA");
    await page.locator("tbody tr", { hasText: "AH SCHA" }).locator("[data-checklist]").click();

    // "Organisation du remplacement" est facultative : aucune boîte de dialogue ne doit apparaître.
    const facultativeRow = page.locator(".tache-row", { hasText: "Organisation du remplacement" });
    let dialogAppeared = false;
    page.once("dialog", () => { dialogAppeared = true; });
    await facultativeRow.locator("[data-marquer-fait]").click();

    await expect(facultativeRow.locator(".badge").first()).toHaveText("Fait");
    expect(dialogAppeared).toBe(false);
  });

  test("la clôture est bloquée tant que les pièces jointes obligatoires manquent (cas limite)", async ({ page }) => {
    await createMaterniteDossier(page, "AH SCHA");
    await page.locator("tbody tr", { hasText: "AH SCHA" }).locator("[data-checklist]").click();

    await expect(page.locator("#cloturerDossier")).toBeDisabled();
    await expect(page.locator(".hint", { hasText: "clôture est bloquée" })).toBeVisible();
  });

  test("fournir les justificatifs obligatoires débloque puis permet la clôture (cycle complet)", async ({ page }) => {
    await createMaterniteDossier(page, "AH SCHA");
    await page.locator("tbody tr", { hasText: "AH SCHA" }).locator("[data-checklist]").click();

    const obligatoires = [
      "Déclaration de grossesse",
      "Demande de congé maternité",
      "Attestation de droits CPS"
    ];
    for (const intitule of obligatoires) {
      const row = page.locator(".tache-row", { hasText: intitule });
      page.once("dialog", (dialog) => dialog.accept("Justificatif.pdf"));
      await row.locator("[data-marquer-fait]").click();
      await expect(row.locator(".badge").first()).toHaveText("Fait");
    }

    await expect(page.locator("#cloturerDossier")).toBeEnabled();

    await page.click("#cloturerDossier");
    await expect(page.locator("#toast")).toHaveText("Dossier maternité clôturé");

    await expect(page.locator("tbody tr", { hasText: "AH SCHA" }).locator(".badge")).toHaveText("Clôturé");
  });

  test("annuler la saisie du justificatif ne marque pas la tâche comme faite", async ({ page }) => {
    await createMaterniteDossier(page, "AH SCHA");
    await page.locator("tbody tr", { hasText: "AH SCHA" }).locator("[data-checklist]").click();

    const row = page.locator(".tache-row", { hasText: "Déclaration de grossesse" });
    page.once("dialog", (dialog) => dialog.dismiss());
    await row.locator("[data-marquer-fait]").click();

    // Cette tâche est aussi proche de son échéance (rappel affiché) : on cible le badge de
    // statut, qui est toujours rendu en premier, pour éviter toute ambiguïté avec le rappel.
    await expect(row.locator(".badge").first()).toHaveText("À faire");
  });

  test("un rappel d'échéance est visible sur les tâches à venir", async ({ page }) => {
    await createMaterniteDossier(page, "AH SCHA");
    await page.locator("tbody tr", { hasText: "AH SCHA" }).locator("[data-checklist]").click();

    // Échéance à 7 jours par défaut = seuil de rappel par défaut : le badge doit apparaître
    // dès la création, sans dépendre d'une date de seed fixe.
    const firstRow = page.locator(".tache-row", { hasText: "Déclaration de grossesse" });
    await expect(firstRow.locator(".badge.warn, .badge.bad")).toContainText(/Échéance|retard/);
  });
});
