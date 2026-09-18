// Premier test de vérification : l'application se charge et le module RH est accessible.
// Sert de fondation à l'infrastructure Playwright avant d'automatiser les parcours métier.
const { test, expect } = require("@playwright/test");

test.describe("Vérification de base de la plateforme", () => {
  test("le portail se charge et propose le module RH comme disponible", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/OPH · Plateforme ERP/);

    const rhCard = page.locator('a.card[href="rh/"]');
    await expect(rhCard).toBeVisible();
    await expect(rhCard.locator("h3")).toHaveText("Ressources Humaines");
    await expect(rhCard.locator(".badge")).toHaveText(/Disponible/);
  });

  test("le module RH se charge avec le tableau de bord et la navigation par défaut", async ({ page }) => {
    await page.goto("/rh/");
    await expect(page).toHaveTitle(/OPH · Gestion RH/);

    await expect(page.locator("#pageTitle")).toHaveText("Tableau de bord");
    await expect(page.locator("#nav a", { hasText: "Agents" })).toBeVisible();
    await expect(page.locator("#nav a", { hasText: "Congés" })).toBeVisible();

    // Profil par défaut au premier chargement : RH (accès complet).
    await expect(page.locator("#sessRole")).toHaveValue("rh");
  });
});
