// Parcours "formations" et "évaluations" : distinction demande / suivi réalisé,
// workflow de validation hiérarchique, évaluations à chaud et à froid (Teams simulé).
const { test, expect } = require("@playwright/test");

async function createFormationDemand(page, { intitule, agentName }) {
  await page.click("#addBtn");
  await page.fill('input[data-k="intitule"]', intitule);
  const option = page.locator('select[data-k="agentId"] option', { hasText: agentName }).first();
  const value = await option.evaluate((el) => el.value);
  await page.selectOption('select[data-k="agentId"]', value);
  await page.click("#saveModal");
}

test.describe("Formations — profil RH", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/rh/");
    await page.locator("#nav a", { hasText: "Formations" }).click();
    await expect(page.locator("#pageTitle")).toHaveText("Formations");
  });

  test("création d'une demande puis validation (cas nominal)", async ({ page }) => {
    await createFormationDemand(page, { intitule: "Excel avancé", agentName: "TETUANUI" });
    const row = page.locator("tbody tr", { hasText: "Excel avancé" });
    await expect(row.locator(".badge")).toHaveText("Demandée");

    await row.locator("[data-fvalide]").click();
    await expect(page.locator("#toast")).toHaveText("Demande de formation validée");
    await expect(row.locator(".badge")).toHaveText("Validée");
  });

  test("refus d'une demande de formation", async ({ page }) => {
    await createFormationDemand(page, { intitule: "Excel intermédiaire", agentName: "TETUANUI" });
    const row = page.locator("tbody tr", { hasText: "Excel intermédiaire" });

    await row.locator("[data-frefuse]").click();
    await expect(page.locator("#toast")).toHaveText("Demande de formation refusée");
    await expect(row.locator(".badge")).toHaveText("Annulée");
  });

  test("une formation validée peut être marquée réalisée, puis évaluée à chaud et à froid", async ({ page }) => {
    await createFormationDemand(page, { intitule: "Excel expert", agentName: "TETUANUI" });
    const row = page.locator("tbody tr", { hasText: "Excel expert" });
    await row.locator("[data-fvalide]").click();
    await row.locator("[data-frealise]").click();
    await expect(page.locator("#toast")).toHaveText("Formation marquée réalisée");
    await expect(row.locator(".badge")).toHaveText("Réalisée");

    // Évaluation à chaud : pas encore d'évaluation à froid disponible tant qu'elle n'est pas envoyée.
    await expect(row.locator('[data-feval$="-froid"]')).toHaveCount(0);
    await row.locator('[data-feval$="-chaud"]').click();
    await expect(page.locator(".modal-head")).toContainText("Évaluation à chaud");
    await page.click("#sendEval");
    await expect(page.locator("#toast")).toHaveText("Évaluation envoyée sur Teams");
    await page.fill("#evalReponse", "Contenu clair, formatrice disponible.");
    await page.click("#saveEval");
    await expect(page.locator("#toast")).toHaveText("Réponse enregistrée");

    // L'évaluation à froid devient disponible une fois celle à chaud envoyée.
    await expect(row.locator('[data-feval$="-froid"]')).toHaveCount(1);
    await row.locator('[data-feval$="-froid"]').click();
    await expect(page.locator(".modal-head")).toContainText("Évaluation à froid");
    await page.click("#sendEval");
    await page.fill("#evalReponse", "Compétences réellement appliquées sur le poste.");
    await page.click("#saveEval");
    await expect(page.locator("#toast")).toHaveText("Réponse enregistrée");
  });
});

test.describe("Formations — self-service (profil Agent)", () => {
  test("un agent dépose sa propre demande sans pouvoir la valider lui-même", async ({ page }) => {
    await page.goto("/rh/");
    await page.selectOption("#sessRole", "agent");
    const agentOption = page.locator("#sessAgent option", { hasText: "Poema TERIItAHI" });
    await page.selectOption("#sessAgent", await agentOption.evaluate((el) => el.value));

    await page.locator("#nav a", { hasText: "Mon dossier" }).click();
    await page.locator("#detailTabs button", { hasText: "Formations" }).click();
    await page.click("#detailAdd");

    await expect(page.locator(".field label", { hasText: "Statut" })).toHaveCount(0);

    await page.fill('input[data-k="intitule"]', "Communication interpersonnelle");
    await page.click("#saveModal");

    await expect(page.locator("#toast")).toHaveText("Enregistrement créé");
    const row = page.locator("tbody tr", { hasText: "Communication interpersonnelle" });
    await expect(row.locator(".badge")).toHaveText("Demandée");
    // Lecture seule : ni bouton de validation ni bouton d'édition depuis son propre dossier.
    await expect(row.locator("[data-fvalide]")).toHaveCount(0);
  });
});
