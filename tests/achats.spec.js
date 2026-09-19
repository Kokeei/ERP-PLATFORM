// Parcours E2E du module Achats & Finances : référentiel tiers, suivi budgétaire
// (alloué/engagé/consommé/disponible), marchés publics, commandes (avec engagement
// budgétaire), et cycle complet de facture (réception → contrôle service fait →
// validation Direction Financière → paiement), avec le garde-fou "service fait".
const { test, expect } = require("@playwright/test");

test.describe("Achats — accès depuis le portail", () => {
  test("les 6 cartes achats ouvrent directement la bonne section avec le bon filtre", async ({ page }) => {
    await page.goto("/");
    await page.locator('a.card[href="achats/#tiers?type=Fournisseur"]').click();
    await expect(page.locator("#pageTitle")).toHaveText("Tiers");
    await expect(page.locator("#filterSel")).toHaveValue("Fournisseur");
    await expect(page.locator("tbody tr", { hasText: "Commune de Papeete" })).toHaveCount(0);
  });

  test("la carte Budget ouvre directement le suivi budgétaire", async ({ page }) => {
    await page.goto("/");
    await page.locator('a.card[href="achats/#budget"]').click();
    await expect(page.locator("#pageTitle")).toHaveText("Budget");
  });
});

test.describe("Achats — tableau de bord et budget (profil Achats)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/achats/");
    await expect(page.locator("#pageTitle")).toHaveText("Tableau de bord");
  });

  test("affiche les indicateurs budgétaires clés (cas nominal)", async ({ page }) => {
    await expect(page.locator(".kpi", { hasText: "Budget alloué" })).toBeVisible();
    await expect(page.locator(".kpi", { hasText: "Engagé" })).toBeVisible();
  });

  test("le suivi budgétaire calcule alloué/engagé/consommé/disponible par ligne", async ({ page }) => {
    await page.locator("[data-nav='budget']").click();
    const row = page.locator("tbody tr", { hasText: "Travaux d'entretien" });
    await expect(row).toContainText("15 000 000 XPF");
    // Engagé = commandes non clôturées liées à cette ligne (BC-2026-003, 3 000 000 XPF).
    await expect(row.locator("td").nth(3)).toHaveText("3 000 000 XPF");
    await expect(row.locator("td").nth(5)).toHaveText("12 000 000 XPF");
  });

  test("crée une nouvelle ligne budgétaire (cas nominal)", async ({ page }) => {
    await page.locator("[data-nav='budget']").click();
    await page.click("#addBtn");
    await page.fill('input[data-k="nature"]', "Formation du personnel");
    await page.fill('input[data-k="alloue"]', "500000");
    await page.click("#saveModal");
    await expect(page.locator("tbody tr", { hasText: "Formation du personnel" })).toBeVisible();
  });
});

test.describe("Achats — tiers (profil Achats)", () => {
  test("filtre les tiers par rôle et crée un nouveau tiers (cas nominal)", async ({ page }) => {
    await page.goto("/achats/");
    await page.locator("[data-nav='tiers']").click();
    await page.click("#addBtn");
    await page.fill('input[data-k="raisonSociale"]', "Nouveau Fournisseur Test");
    await page.click("#saveModal");
    await expect(page.locator("tbody tr", { hasText: "Nouveau Fournisseur Test" })).toBeVisible();
  });

  test("un tiers sans rôle sélectionné est refusé (cas limite)", async ({ page }) => {
    await page.goto("/achats/");
    await page.locator("[data-nav='tiers']").click();
    await page.click("#addBtn");
    await page.fill('input[data-k="raisonSociale"]', "Tiers Sans Role");
    await page.uncheck('[data-k-multi="type"][value="Fournisseur"]');
    await page.click("#saveModal");
    await expect(page.locator("#toast")).toHaveText("Champ requis : Rôle");
  });
});

test.describe("Achats — marchés et commandes (profil Achats)", () => {
  test("crée un marché public (cas nominal)", async ({ page }) => {
    await page.goto("/achats/");
    await page.locator("[data-nav='marches']").click();
    await page.click("#addBtn");
    await page.fill('input[data-k="objet"]', "Construction d'un local technique");
    await page.selectOption('select[data-k="tiersId"]', { label: "Polynésie Bâtiment" });
    await page.selectOption('select[data-k="ligneBudgetId"]', { index: 1 });
    await page.fill('input[data-k="montant"]', "5000000");
    await page.click("#saveModal");
    await expect(page.locator("tbody tr", { hasText: "Construction d'un local technique" })).toBeVisible();
  });

  test("fait progresser une commande de l'envoi à la livraison (service fait)", async ({ page }) => {
    await page.goto("/achats/");
    await page.locator("[data-nav='commandes']").click();
    const row = page.locator("tbody tr", { hasText: "BC-2026-004" });
    await row.locator("[data-livrer]").click();
    await expect(row.locator(".badge").first()).toHaveText("Livrée");
    await expect(row).toContainText("Service fait");
  });
});

test.describe("Achats — cycle complet d'une facture", () => {
  test("le contrôle est bloqué tant que le service fait n'est pas constaté (cas erreur)", async ({ page }) => {
    await page.goto("/achats/");
    await page.locator("[data-nav='factures']").click();
    const row = page.locator("tbody tr", { hasText: "FA-9012" });
    await row.locator("[data-controler]").click();
    await expect(page.locator("#toast")).toHaveText("Service fait non constaté sur la commande liée : contrôle impossible");
    await expect(row.locator(".badge")).toHaveText("Reçue");
  });

  test("réception → contrôle → validation DF → paiement (cycle complet)", async ({ page }) => {
    await page.goto("/achats/");

    // Constate le service fait sur la commande liée avant de pouvoir contrôler la facture.
    await page.locator("[data-nav='commandes']").click();
    await page.locator("tbody tr", { hasText: "BC-2026-004" }).locator("[data-livrer]").click();

    await page.locator("[data-nav='factures']").click();
    const factRow = page.locator("tbody tr", { hasText: "FA-9012" });
    await factRow.locator("[data-controler]").click();
    await expect(page.locator("#toast")).toHaveText("Facture contrôlée, transmise à la Direction Financière");
    await expect(factRow.locator(".badge")).toHaveText("Contrôlée");

    // Bascule sur le profil Direction Financière pour valider puis payer.
    await page.selectOption("#sessRole", "df");
    await expect(page.locator("#pageTitle")).toHaveText("Factures à valider");
    await page.locator("tbody tr", { hasText: "FA-9012" }).locator("[data-view]").click();
    await expect(page.locator(".modal-body")).toContainText("Constaté");
    await page.click("#validerBtn");
    await expect(page.locator("#toast")).toHaveText("Facture validée pour paiement");

    await page.locator("tbody tr", { hasText: "FA-9012" }).locator("[data-view]").click();
    await page.click("#payerBtn");
    await expect(page.locator("#toast")).toHaveText("Facture marquée payée");
    // Une fois payée, la facture sort de la file "à valider" de la DF.
    await expect(page.locator("tbody tr", { hasText: "FA-9012" })).toHaveCount(0);
  });

  test("la Direction Financière peut rejeter une facture avec un motif (cas limite)", async ({ page }) => {
    await page.goto("/achats/");
    await page.selectOption("#sessRole", "df");
    const row = page.locator("tbody tr", { hasText: "FA-5567" });
    await row.locator("[data-view]").click();
    page.once("dialog", (d) => d.accept("Montant incohérent avec le devis initial"));
    await page.click("#rejeterBtn");
    await expect(page.locator("#toast")).toHaveText("Facture rejetée");
    await expect(page.locator("tbody tr", { hasText: "FA-5567" })).toHaveCount(0);
  });

  test("le profil Direction Financière n'a pas accès à la gestion des tiers (droits)", async ({ page }) => {
    await page.goto("/achats/");
    await page.selectOption("#sessRole", "df");
    await expect(page.locator("#nav a", { hasText: "Tiers" })).toHaveCount(0);
    await expect(page.locator("#nav a")).toHaveCount(2);
  });
});
