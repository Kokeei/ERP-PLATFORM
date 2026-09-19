// Accueil du portail self-service agent (rh/agent-portal.js) : soldes de congés réels
// (annuels / ancienneté / parentaux), date de prochain avancement, heures de délégation
// pour les mandats de représentation du personnel (CE/DP...), et congés à venir triés
// du plus proche au plus lointain plutôt qu'un historique de demandes.
const { test, expect } = require("@playwright/test");

function futureDateISO(daysFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

async function goToAccueil(page) {
  await page.goto("/rh/");
  await page.selectOption("#sessRole", "agent");
  await expect(page.locator("#pageTitle")).toHaveText("Accueil");
}

test.describe("Accueil agent — soldes de congés et informations complémentaires", () => {
  test("affiche les congés annuels, ancienneté et parentaux (pas de RTT fictif)", async ({ page }) => {
    await goToAccueil(page);
    const absences = page.locator(".ad-card", { hasText: "Mes absences" });
    await expect(absences).toContainText("Congés annuels");
    await expect(absences).toContainText("Congés ancienneté");
    await expect(absences).toContainText("Congés parentaux");
    await expect(page.locator(".agent-dash")).not.toContainText("RTT");
  });

  test("affiche la date de prochain avancement dans Mon profil", async ({ page }) => {
    await goToAccueil(page);
    // Manea TEHEIURA (agent par défaut) a une date de prochain avancement dans les données de démonstration.
    await expect(page.locator(".ad-card", { hasText: "Mon profil" })).toContainText("Prochain avancement");
  });

  test("aucune carte de délégation pour un agent sans mandat de représentation", async ({ page }) => {
    await goToAccueil(page);
    await expect(page.locator(".ad-card", { hasText: "Représentation du personnel" })).toHaveCount(0);
  });

  test("affiche les heures de délégation pour un agent avec mandat CE/DP", async ({ page }) => {
    await goToAccueil(page);
    await page.selectOption("#sessAgent", { label: "Moana TETUANUI" });
    const mandat = page.locator(".ad-card", { hasText: "Représentation du personnel" });
    await expect(mandat).toBeVisible();
    await expect(mandat).toContainText("DP");
    await expect(mandat).toContainText("15 h / mois");
  });

  test("aucun indicateur \"demandes en attente\" sur l'accueil", async ({ page }) => {
    await goToAccueil(page);
    await expect(page.locator(".agent-dash")).not.toContainText("Demandes en attente");
  });
});

test.describe("Accueil agent — mes prochains congés", () => {
  test("liste les congés à venir triés du plus proche au plus lointain (cas nominal)", async ({ page }) => {
    await goToAccueil(page);
    const dansDixJours = futureDateISO(10);
    const dansTroisJours = futureDateISO(3);

    // Dépose d'abord le congé le plus lointain, puis le plus proche : l'ordre affiché doit
    // suivre la date, pas l'ordre de création.
    await page.locator("#nav a", { hasText: "Mes absences" }).click();
    await page.click("#addBtn");
    await page.selectOption('select[data-k="type"]', "Congés annuels");
    await page.fill('input[data-k="debut"]', dansDixJours);
    await page.fill('input[data-k="fin"]', dansDixJours);
    await page.click("#saveModal");

    await page.click("#addBtn");
    await page.selectOption('select[data-k="type"]', "Récupération");
    await page.fill('input[data-k="debut"]', dansTroisJours);
    await page.fill('input[data-k="fin"]', dansTroisJours);
    await page.click("#saveModal");

    await page.locator("#nav a", { hasText: "Accueil" }).click();
    const evenements = page.locator(".ad-card", { hasText: "Mes absences" }).locator(".ad-event");
    await expect(evenements).toHaveCount(2);
    await expect(evenements.nth(0)).toContainText("Récupération");
    await expect(evenements.nth(1)).toContainText("Congés annuels");
  });

  test("affiche un état vide quand aucun congé n'est à venir (cas limite)", async ({ page }) => {
    await goToAccueil(page);
    await page.selectOption("#sessAgent", { label: "Rai FAATAU" });
    await expect(page.locator(".ad-card", { hasText: "Mes absences" })).toContainText("Aucun congé à venir");
  });
});
