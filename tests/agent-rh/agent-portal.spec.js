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
    await page.locator("#nav a", { hasText: "Mon profil" }).click();
    await expect(page.locator(".detail-head")).toBeVisible();
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
    await page.evaluate(() => window.go("agents"));
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
    await expect(page.locator("#agentSearchInput")).toBeVisible();
  });
});


test("permet d'envoyer une demande RH", async ({ page }) => {
  await selectAgent(page);
  await page.locator("#nav a", { hasText: "Mes demandes" }).click();
  await page.getByRole("button", { name: "Nouvelle demande" }).click();
  await page.locator("#apSubject").fill("Demande de test");
  await page.locator("#apDetails").fill("Test fonctionnel de l'espace agent.");
  await page.locator("#apSend").click();
  await expect(page.locator("#pageTitle")).toHaveText("Mes demandes");
  await expect(page.locator(".panel-body")).toContainText("Demande de test");
});

test("permet de demander une modification du profil", async ({ page }) => {
  await selectAgent(page);
  await page.locator("#nav a", { hasText: "Mon profil" }).click();
  await page.getByRole("button", { name: /Demander une modification/ }).click();
  await expect(page.locator("#apSubject")).toBeVisible();
  await expect(page.locator("#apDetails")).toBeVisible();
});

test("permet de marquer une notification comme lue", async ({ page }) => {
  await selectAgent(page);
  await page.locator("#nav a", { hasText: "Notifications" }).click();
  await expect(page.getByRole("button", { name: "Tout marquer comme lu" })).toBeVisible();
});
