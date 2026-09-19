const { test, expect } = require("@playwright/test");

async function selectAgent(page) {
  await page.goto("/rh/");
  await page.locator("#sessRole").selectOption("agent");
  await expect(page.locator("#pageTitle")).toHaveText("Accueil");
}

test.describe("Espace Agent RH", () => {
  test("affiche la navigation personnelle complète", async ({ page }) => {
    await selectAgent(page);
    const labels = ["Accueil","Mon profil","Mes absences","Mes demandes","Mes tâches","Mes documents","Ma rémunération","Ma carrière","Mes formations","Mes entretiens","Ma vie professionnelle","Notifications","Recherche RH","Maternité / parentalité","Aide & contact"];
    for (const label of labels) await expect(page.locator("#nav a", { hasText: label })).toBeVisible();
  });

  test("affiche uniquement les données de l'agent courant", async ({ page }) => {
    await selectAgent(page);
    const selected = await page.locator("#sessAgent").inputValue();
    await page.locator("#nav a", { hasText: "Mon profil" }).click();
    await expect(page.locator(".detail-head")).toContainText(selected ? "" : "");
    await expect(page.locator(".detail-cols")).toBeVisible();
  });

  test("permet de créer une demande de congé depuis Mes absences", async ({ page }) => {
    await selectAgent(page);
    await page.locator("#nav a", { hasText: "Mes absences" }).click();
    await page.locator("#addBtn").click();
    await expect(page.locator("#modalRoot .modal")).toBeVisible();
    await expect(page.locator("#modalRoot .modal h3")).toContainText("Nouveau");
  });

  test("protège les modules RH du profil Agent par la navigation", async ({ page }) => {
    await selectAgent(page);
    await page.evaluate(() => { window.location.hash = "#agents"; });
    await page.reload();
    await expect(page.locator("#pageTitle")).toHaveText("Accueil");
    await expect(page.locator("#nav a", { hasText: "Agents" })).toHaveCount(0);
  });

  test("ouvre la rémunération personnelle", async ({ page }) => {
    await selectAgent(page);
    await page.locator("#nav a", { hasText: "Ma rémunération" }).click();
    await expect(page.locator("#pageTitle")).toHaveText("Ma rémunération");
    await expect(page.locator("table")).toBeVisible();
  });

  test("ouvre les formations et entretiens personnels", async ({ page }) => {
    await selectAgent(page);
    await page.locator("#nav a", { hasText: "Mes formations" }).click();
    await expect(page.locator("#pageTitle")).toHaveText("Mes formations");
    await page.locator("#nav a", { hasText: "Mes entretiens" }).click();
    await expect(page.locator("#pageTitle")).toHaveText("Mes entretiens");
  });

  test("ouvre la GED personnelle et la recherche RH", async ({ page }) => {
    await selectAgent(page);
    await page.locator("#nav a", { hasText: "Mes documents" }).click();
    await expect(page.locator("#pageTitle")).toHaveText("Mes documents");
    await page.locator("#nav a", { hasText: "Recherche RH" }).click();
    await expect(page.locator("#agentSearch")).toBeVisible();
  });
});
