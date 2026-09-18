// Parcours "paie" et "workflow de validation" (contrôle Direction Financière) :
// génération des bulletins, contrôle global, anomalie → correction → revalidation, paiement.
const { test, expect } = require("@playwright/test");

async function generateBulletins(page, periode) {
  await page.click("#genBulletinsBtn");
  await page.fill("#genPeriode", periode);
  await page.click("#genBtn");
}

test.describe("Paie — génération (profil RH)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/rh/");
    await page.locator("#nav a", { hasText: "Paie" }).click();
    await expect(page.locator("#pageTitle")).toHaveText("Paie");
  });

  test("génère les bulletins d'une période (cas nominal)", async ({ page }) => {
    await generateBulletins(page, "2028-01");

    await expect(page.locator("#toast")).toHaveText(/bulletin\(s\) généré\(s\) pour 2028-01/);
    await expect(page.locator("tbody tr", { hasText: "2028-01" }).first()).toBeVisible();
  });

  test("ne recrée pas de doublon si la période a déjà des bulletins (cas limite)", async ({ page }) => {
    await generateBulletins(page, "2028-02");
    await expect(page.locator("#toast")).toContainText("généré");

    await generateBulletins(page, "2028-02");
    await expect(page.locator("#toast")).toHaveText("Tous les agents actifs ont déjà un bulletin pour cette période");
  });

  test("le détail du bulletin affiche le calcul complet", async ({ page }) => {
    await generateBulletins(page, "2028-03");
    await page.locator("tbody tr", { hasText: "2028-03" }).first().locator("[data-view]").click();

    await expect(page.locator(".modal-head")).toContainText("Bulletin de paie");
    await expect(page.locator(".modal-body")).toContainText("Total Brut");
    await expect(page.locator(".modal-body")).toContainText("Net à payer");
  });
});

test.describe("Paie — cycle de contrôle (Direction Financière)", () => {
  test("la DF contrôle tous les bulletins non validés dans une vue globale et peut valider directement", async ({ page }) => {
    await page.goto("/rh/");
    await page.locator("#nav a", { hasText: "Paie" }).click();
    await generateBulletins(page, "2028-04");

    await page.selectOption("#sessRole", "df");
    await page.locator("#nav a", { hasText: "Contrôle des bulletins" }).click();

    const rows = page.locator("tbody tr", { hasText: "2028-04" });
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    // Valide directement depuis la liste, sans ouvrir le détail (contrôle "tous comptes confondus").
    await rows.first().locator("[data-valider-p]").click();
    await expect(page.locator("#toast")).toHaveText("Bulletin validé");
    await expect(page.locator("tbody tr", { hasText: "2028-04" })).toHaveCount(count - 1);
  });

  test("anomalie → correction RH → revalidation (cycle complet)", async ({ page }) => {
    await page.goto("/rh/");
    await page.locator("#nav a", { hasText: "Paie" }).click();
    await generateBulletins(page, "2028-05");

    await page.selectOption("#sessRole", "df");
    await page.locator("#nav a", { hasText: "Contrôle des bulletins" }).click();
    const row = page.locator("tbody tr", { hasText: "2028-05" }).first();
    const agentLabel = (await row.locator("td").first().textContent()).trim();

    page.once("dialog", (dialog) => dialog.accept("Prime à l'emploi incorrecte, à revoir"));
    await row.locator("[data-anomalie-p]").click();

    // L'agent peut déjà avoir d'autres bulletins de démo : on cible toujours ceux de "2028-05".
    const anomalyRow = page.locator("tbody tr", { hasText: agentLabel }).filter({ hasText: "2028-05" });
    await expect(anomalyRow.locator(".badge")).toHaveText("Anomalie");
    await expect(anomalyRow).toContainText("Prime à l'emploi incorrecte, à revoir");

    // La RH corrige et renvoie au contrôle.
    await page.selectOption("#sessRole", "rh");
    await page.locator("#nav a", { hasText: "Paie" }).click();
    const rhRow = page.locator("tbody tr", { hasText: agentLabel }).filter({ hasText: "2028-05" });
    await rhRow.locator("[data-view]").click();
    await expect(page.locator(".anomalie-box")).toContainText("Prime à l'emploi incorrecte, à revoir");
    await page.click("#regenererBulletinBtn");
    await expect(page.locator("#toast")).toHaveText("Bulletin corrigé et renvoyé au contrôle");

    // Il redevient visible au contrôle global de la DF, en Brouillon.
    await page.selectOption("#sessRole", "df");
    await page.locator("#nav a", { hasText: "Contrôle des bulletins" }).click();
    const correctedRow = page.locator("tbody tr", { hasText: agentLabel }).filter({ hasText: "2028-05" });
    await expect(correctedRow.locator(".badge")).toHaveText("Brouillon");

    await correctedRow.locator("[data-valider-p]").click();
    await expect(page.locator("#toast")).toHaveText("Bulletin validé");

    // Une fois validé, on peut le marquer payé.
    await page.selectOption("#sessRole", "rh");
    await page.locator("#nav a", { hasText: "Paie" }).click();
    const finalRow = page.locator("tbody tr", { hasText: agentLabel }).filter({ hasText: "2028-05" });
    await finalRow.locator("[data-view]").click();
    await page.click("#marquerPayeBtn");
    await expect(page.locator("#toast")).toHaveText("Bulletin marqué comme payé");
    await expect(finalRow.locator(".badge")).toHaveText("Payée");
  });
});
