// Parcours "congés" et "workflow de validation" : création, escalade hiérarchique
// (N+1 → N+2 → RH), validation/refus, demi-journée, historique, self-service.
const { test, expect } = require("@playwright/test");

async function selectAgentOption(page, selector, name) {
  const option = page.locator(`${selector} option`, { hasText: name }).first();
  const value = await option.evaluate((el) => el.value);
  await page.selectOption(selector, value);
}

async function createConge(page, { agentName, type = "Congés annuels", debut, fin, demiJournee, motif }) {
  await page.click("#addBtn");
  await selectAgentOption(page, 'select[data-k="agentId"]', agentName);
  await page.selectOption('select[data-k="type"]', type);
  await page.fill('input[data-k="debut"]', debut);
  await page.fill('input[data-k="fin"]', fin);
  if (demiJournee) await page.selectOption('select[data-k="demiJournee"]', demiJournee);
  if (motif) await page.fill('textarea[data-k="motif"]', motif);
  await page.click("#saveModal");
}

test.describe("Congés — profil RH", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/rh/");
    await page.locator("#nav a", { hasText: "Congés" }).click();
    await expect(page.locator("#pageTitle")).toHaveText("Congés & absences");
  });

  test("création d'une demande et notification Teams (cas nominal)", async ({ page }) => {
    // MARURAI a TEHEIURA pour N+1, qui n'est jamais en congé validé aux dates de ce test :
    // scénario indépendant de la date du jour, contrairement au cas d'escalade ci-dessous.
    await createConge(page, { agentName: "MARURAI", debut: "2027-03-08", fin: "2027-03-10" });

    await expect(page.locator("#toast")).toHaveText("Demande créée et transmise sur Teams à Manea TEHEIURA");
    // MARURAI a déjà un congé de démo : on cible précisément la ligne créée par ce test.
    const row = page.locator("tbody tr", { hasText: "08/03/2027" });
    await expect(row).toContainText("MARURAI");
    await expect(row).toContainText("Manea TEHEIURA");
    await expect(row).toContainText("Supérieur n+1");
    await expect(row.locator(".badge")).toHaveText("En attente");
  });

  test("validation d'une demande depuis la liste (cas nominal)", async ({ page }) => {
    await createConge(page, { agentName: "FAATAU", debut: "2027-03-15", fin: "2027-03-16" });
    const row = page.locator("tbody tr", { hasText: "FAATAU" });

    await row.locator("[data-approve]").click();

    await expect(page.locator("#toast")).toHaveText("Demande validée");
    await expect(row.locator(".badge")).toHaveText("Validé");
  });

  test("refus d'une demande (cas nominal)", async ({ page }) => {
    await createConge(page, { agentName: "FAATAU", debut: "2027-03-20", fin: "2027-03-21" });
    const row = page.locator("tbody tr", { hasText: "FAATAU" });

    await row.locator("[data-refuse]").click();

    await expect(page.locator("#toast")).toHaveText("Demande refusée");
    await expect(row.locator(".badge")).toHaveText("Refusé");
  });

  test("demi-journée : décompte automatique de 0,5 jour (cas limite)", async ({ page }) => {
    await createConge(page, {
      agentName: "TETUANUI",
      debut: "2027-04-05",
      fin: "2027-04-05",
      demiJournee: "Matin"
    });

    const row = page.locator("tbody tr", { hasText: "TETUANUI" });
    await expect(row.locator("td").nth(3)).toHaveText("0.5");
  });

  test("l'historique conserve la trace de la décision", async ({ page }) => {
    await createConge(page, { agentName: "FAATAU", debut: "2027-05-03", fin: "2027-05-04" });
    const row = page.locator("tbody tr", { hasText: "FAATAU" });
    await row.locator("[data-approve]").click();

    await row.locator("[data-history]").click();
    const items = page.locator(".wf-item");
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText("Création de la demande");
    await expect(items.nth(1)).toContainText("Valider");
  });

  test("escalade hiérarchique quand le N+1 est absent (cas limite)", async ({ page }) => {
    // Construit son propre scénario d'absence (plutôt que de dépendre d'une donnée de
    // seed liée à une date fixe) pour rester fiable quelle que soit la date d'exécution.
    const today = new Date().toISOString().slice(0, 10);
    await createConge(page, { agentName: "WONG", debut: today, fin: today });
    await page.locator("tbody tr", { hasText: "WONG" }).locator("[data-approve]").click();

    // TAMA a WONG pour N+1 et TEHEIURA pour N+2.
    await createConge(page, { agentName: "TAMA", debut: "2027-06-10", fin: "2027-06-11" });

    const tamaRow = page.locator("tbody tr", { hasText: "TAMA" }).first();
    await expect(tamaRow).toContainText("Manea TEHEIURA");
    await expect(tamaRow).toContainText("Supérieur n+2");
  });
});

test.describe("Congés — self-service (profil Agent)", () => {
  test("un agent dépose sa propre demande sans pouvoir choisir le statut", async ({ page }) => {
    await page.goto("/rh/");
    await page.selectOption("#sessRole", "agent");
    await selectAgentOption(page, "#sessAgent", "Teiva TAMA");

    await page.locator("#nav a", { hasText: "Mes absences" }).click();
    await page.click("#addBtn");

    await expect(page.locator(".field label", { hasText: "Statut" })).toHaveCount(0);
    await expect(page.locator(".field label", { hasText: "Validé par" })).toHaveCount(0);

    await page.selectOption('select[data-k="type"]', "Congés annuels");
    await page.fill('input[data-k="debut"]', "2027-07-01");
    await page.fill('input[data-k="fin"]', "2027-07-02");
    await page.click("#saveModal");

    await expect(page.locator("#toast")).toContainText("Demande créée");
    await expect(page.locator("tbody tr").first().locator(".badge")).toHaveText("En attente");
  });
});

test.describe("Congés — validations (profil Responsable)", () => {
  test("un responsable retrouve dans sa file les demandes où il est l'approbateur courant", async ({ page }) => {
    // Prépare l'escalade côté RH : WONG absente aujourd'hui, TAMA dépose une demande.
    await page.goto("/rh/");
    await page.locator("#nav a", { hasText: "Congés" }).click();
    const today = new Date().toISOString().slice(0, 10);
    await createConge(page, { agentName: "WONG", debut: today, fin: today });
    await page.locator("tbody tr", { hasText: "WONG" }).locator("[data-approve]").click();
    await createConge(page, { agentName: "TAMA", debut: "2027-08-10", fin: "2027-08-11" });

    // TEHEIURA devient l'approbateur courant (N+2) : il doit voir la demande dans sa file.
    // TAMA a déjà un congé de démo par ailleurs en attente ; comme WONG (son N+1) est absente
    // aujourd'hui, les deux escaladent vers TEHEIURA et apparaissent tous les deux ici — on
    // cible précisément celui créé par ce test.
    await page.selectOption("#sessRole", "responsable");
    await selectAgentOption(page, "#sessAgent", "Manea TEHEIURA");
    await page.locator("#nav a", { hasText: "Validations congés" }).click();

    const row = page.locator("tbody tr", { hasText: "10/08/2027" });
    await expect(row).toBeVisible();
    await expect(row).toContainText("TAMA");

    await row.locator("[data-approve]").click();
    await expect(page.locator("#toast")).toHaveText("Demande validée");
    await expect(page.locator("tbody tr", { hasText: "10/08/2027" })).toHaveCount(0);
  });
});
