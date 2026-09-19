// Parcours "gestion des agents" : consultation, recherche, création, modification,
// validation des champs obligatoires, et droits différenciés selon le profil.
const { test, expect } = require("@playwright/test");

test.describe("Gestion des agents — profil RH", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/rh/");
    await page.locator("#nav a", { hasText: "Agents" }).click();
    await expect(page.locator("#pageTitle")).toHaveText("Agents");
  });

  test("liste et recherche des agents (cas nominal)", async ({ page }) => {
    await expect(page.locator("tbody tr", { hasText: "TEHEIURA" })).toBeVisible();

    await page.fill("#searchInp", "WONG");
    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("WONG");
  });

  test("ouverture de la fiche d'un agent", async ({ page }) => {
    await page.locator("tbody tr", { hasText: "TEHEIURA" }).click();

    await expect(page.locator("#pageTitle")).toHaveText("Manea TEHEIURA");
    await expect(page.locator("#editAgentBtn")).toBeVisible();
  });

  test("création d'un agent (cas nominal)", async ({ page }) => {
    await page.click("#addBtn");
    await expect(page.locator(".overlay")).toBeVisible();

    await page.fill('input[data-k="nom"]', "TESTAGENT");
    await page.fill('input[data-k="prenom"]', "Playwright");
    await page.click("#saveModal");

    await expect(page.locator("#toast")).toHaveText("Enregistrement créé");
    await expect(page.locator(".overlay")).toHaveCount(0);

    await page.fill("#searchInp", "TESTAGENT");
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.locator("tbody tr").first()).toContainText("Playwright TESTAGENT");
  });

  test("la création échoue proprement si le nom est manquant (cas limite)", async ({ page }) => {
    await page.click("#addBtn");
    await page.fill('input[data-k="prenom"]', "SansNom");
    // Le champ "nom" reste vide.
    await page.click("#saveModal");

    await expect(page.locator("#toast")).toHaveText("Champ requis : Nom");
    // Le formulaire ne doit pas se fermer tant que la validation échoue.
    await expect(page.locator(".overlay")).toBeVisible();
  });

  test("modification d'un agent existant (cas nominal)", async ({ page }) => {
    await page.locator("tbody tr", { hasText: "TAMA" }).click();
    await page.click("#editAgentBtn");
    await expect(page.locator(".overlay")).toBeVisible();

    await page.fill('input[data-k="fonction"]', "Référent support N2");
    await page.click("#saveModal");

    await expect(page.locator("#toast")).toHaveText("Modifications enregistrées");
    await expect(page.locator(".detail-head")).toContainText("Référent support N2");
  });
});

test.describe("Gestion des agents — droits différenciés par profil", () => {
  test("un agent en self-service n'a pas accès à la liste des agents", async ({ page }) => {
    await page.goto("/rh/");
    await page.selectOption("#sessRole", "agent");

    await expect(page.locator("#nav a")).toHaveCount(15);
    await expect(page.locator("#nav a", { hasText: "Agents" })).toHaveCount(0);
    await expect(page.locator("#pageTitle")).toHaveText("Accueil");
  });

  test("un responsable ne voit que son équipe directe et ne peut pas modifier leur fiche", async ({ page }) => {
    await page.goto("/rh/");
    await page.selectOption("#sessRole", "responsable");
    await page.selectOption("#sessAgent", { label: "Hina WONG" });

    await page.locator("#nav a", { hasText: "Mon équipe" }).click();
    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("TAMA");

    await rows.first().click();
    await expect(page.locator("#pageTitle")).toHaveText("Teiva TAMA");
    await expect(page.locator("#editAgentBtn")).toHaveCount(0);
    await expect(page.locator("#backBtn")).toHaveText(/Mon équipe/);
  });
});
