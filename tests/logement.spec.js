// Parcours E2E du module Gestion Locative : patrimoine, workflow demandeur (dépôt →
// instruction → éligibilité → proposition → attribution automatique du logement,
// création du locataire et du bail), quittances, interventions, self-service
// locataire et demandeur.
const { test, expect } = require("@playwright/test");

test.describe("Logement — accès depuis le portail", () => {
  test("les cartes Locataires et Demandeurs ouvrent directement la bonne section", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('a.card[href="logement/#locataires"]')).toBeVisible();
    await page.locator('a.card[href="logement/#demandeurs"]').click();
    await expect(page.locator("#pageTitle")).toHaveText("Demandeurs");
  });
});

test.describe("Logement — tableau de bord et patrimoine (profil Gestion)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/logement/");
    await expect(page.locator("#pageTitle")).toHaveText("Tableau de bord");
  });

  test("affiche les indicateurs clés du parc immobilier (cas nominal)", async ({ page }) => {
    await expect(page.locator(".kpi", { hasText: "Taux d'occupation" })).toBeVisible();
    await expect(page.locator(".kpi", { hasText: "Logements vacants" })).toBeVisible();
  });

  test("liste et filtre les logements par statut", async ({ page }) => {
    await page.locator("[data-nav='logements']").click();
    await expect(page.locator("#pageTitle")).toHaveText("Patrimoine");
    const total = await page.locator("tbody tr").count();
    expect(total).toBeGreaterThan(0);
    await page.selectOption("#filterSel", "Vacant");
    const vacants = page.locator("tbody tr");
    await expect(vacants.first()).toContainText("Vacant");
  });

  test("crée un nouveau logement (cas nominal)", async ({ page }) => {
    await page.locator("[data-nav='logements']").click();
    await page.click("#addBtn");
    await page.fill('input[data-k="residence"]', "Résidence Test");
    await page.fill('input[data-k="numero"]', "Z99");
    await page.click("#saveModal");
    await expect(page.locator("#toast")).toHaveText("Enregistrement créé");
    await expect(page.locator("tbody tr", { hasText: "Résidence Test" })).toBeVisible();
  });
});

test.describe("Logement — workflow demandeur (profil Gestion)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/logement/");
    await page.locator("[data-nav='demandeurs']").click();
    await expect(page.locator("#pageTitle")).toHaveText("Demandeurs");
  });

  test("un demandeur éligible reçoit une proposition puis une attribution (cycle complet)", async ({ page }) => {
    await page.locator("tbody tr", { hasText: "FAANA" }).click();
    await expect(page.locator(".modal-head h3")).toContainText("FAANA");
    await page.click('[data-act="propose"]');
    await expect(page.locator("#okBtn")).toBeEnabled();
    await page.click("#okBtn");
    await expect(page.locator("#toast")).toHaveText("Logement proposé au demandeur");
    await expect(page.locator("tbody tr", { hasText: "FAANA" }).locator(".badge")).toHaveText("Proposée");

    await page.locator("tbody tr", { hasText: "FAANA" }).click();
    await page.click('[data-act="attribuer"]');
    await expect(page.locator("#toast")).toHaveText("Logement attribué : locataire et bail créés");
    await expect(page.locator("tbody tr", { hasText: "FAANA" }).locator(".badge").first()).toHaveText("Attribuée");

    // Le locataire et le bail doivent exister automatiquement.
    await page.locator("[data-nav='locataires']").click();
    await expect(page.locator("tbody tr", { hasText: "FAANA" })).toHaveCount(1);
    await page.locator("[data-nav='baux']").click();
    await expect(page.locator("tbody tr", { hasText: "FAANA" })).toHaveCount(1);
  });

  test("une demande en instruction peut être refusée (cas limite)", async ({ page }) => {
    await page.locator("tbody tr", { hasText: "MARAEURA" }).click();
    await page.click('[data-act="Refusée"]');
    await expect(page.locator("tbody tr", { hasText: "MARAEURA" }).locator(".badge")).toHaveText("Refusée");
  });

  test("une demande déposée n'a qu'une seule action disponible : passer en instruction (cas limite)", async ({ page }) => {
    await page.locator("tbody tr", { hasText: "AH-PUOU" }).click();
    await expect(page.locator("[data-act]")).toHaveCount(1);
    await page.click('[data-act="Instruction"]');
    await expect(page.locator("tbody tr", { hasText: "AH-PUOU" }).locator(".badge")).toHaveText("Instruction");
  });
});

test.describe("Logement — quittances (profil Gestion)", () => {
  test("génère les quittances du mois sans doublon (cas nominal + cas limite)", async ({ page }) => {
    await page.goto("/logement/");
    await page.locator("[data-nav='quittances']").click();
    await page.click("#genBtn");
    await expect(page.locator("#toast")).toContainText("généré");
    await page.click("#genBtn");
    await expect(page.locator("#toast")).toHaveText("Toutes les quittances de ce mois ont déjà été générées");
  });

  test("marque une quittance comme payée", async ({ page }) => {
    await page.goto("/logement/");
    await page.locator("[data-nav='quittances']").click();
    await page.selectOption("#filterSel", "Impayée");
    const row = page.locator("tbody tr").first();
    await row.locator("[data-payee]").click();
    await expect(page.locator("#toast")).toHaveText("Quittance marquée payée");
  });
});

test.describe("Logement — self-service Locataire", () => {
  test("un locataire voit son bail, ses quittances et peut signaler une intervention (cas nominal)", async ({ page }) => {
    await page.goto("/logement/");
    await page.selectOption("#sessRole", "locataire");
    await expect(page.locator("#pageTitle")).toHaveText("Mon espace");
    await expect(page.locator("#nav a")).toHaveCount(4);

    await page.locator("#nav a", { hasText: "Mon bail" }).click();
    await expect(page.locator(".detail-cols")).toBeVisible();

    await page.locator("#nav a", { hasText: "Mes interventions" }).click();
    await page.click("#addBtn");
    await expect(page.locator(".field label", { hasText: "Statut" })).toHaveCount(0);
    await page.fill('textarea[data-k="description"]', "Robinet qui goutte dans la salle de bain");
    await page.click("#saveModal");
    await expect(page.locator("tbody tr", { hasText: "Robinet qui goutte" })).toBeVisible();
  });

  test("un locataire sans bail actif ne peut pas signaler d'intervention (cas erreur)", async ({ page }) => {
    await page.goto("/logement/");
    await page.evaluate(() => {
      // Crée un locataire de test sans bail pour vérifier le garde-fou applicatif.
      const l = { id: "lo_test_sansbail", civ: "M.", nom: "SANSBAIL", prenom: "Test" };
      DB.locataires.push(l);
      save();
    });
    await page.selectOption("#sessRole", "locataire");
    await page.selectOption("#sessId", { label: "Test SANSBAIL" });
    await page.locator("#nav a", { hasText: "Mes interventions" }).click();
    await page.click("#addBtn");
    await expect(page.locator("#toast")).toHaveText("Aucun bail actif associé à ce compte");
    await expect(page.locator(".modal")).toHaveCount(0);
  });
});

test.describe("Logement — self-service Demandeur", () => {
  test("un demandeur suit l'avancement de son dossier (cas nominal)", async ({ page }) => {
    await page.goto("/logement/");
    await page.selectOption("#sessRole", "demandeur");
    await page.selectOption("#sessId", { label: "Rava TEHEI" });
    await expect(page.locator("#pageTitle")).toHaveText("Suivi de ma demande");
    await expect(page.locator(".detail-head .meta")).toContainText("Proposée");
    await expect(page.locator(".kpi-grid")).toBeVisible();
  });

  test("un dossier refusé affiche le motif plutôt que la frise d'avancement (cas limite)", async ({ page }) => {
    await page.goto("/logement/");
    await page.selectOption("#sessRole", "demandeur");
    await page.selectOption("#sessId", { label: "Hiro MARO" });
    await expect(page.locator(".panel-body p")).toContainText("Votre demande a été refusée");
    await expect(page.locator(".kpi-grid")).toHaveCount(0);
  });
});
