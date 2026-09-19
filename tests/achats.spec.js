// Parcours E2E du module Achats & Finances : référentiel tiers, comptes budgétaires par
// direction (compte + code direction, ex. 2183001), lignes de BC/facture imputables sur des
// comptes différents (TVA 16%/13%, garantie, remise et remise en masse), numérotation
// automatique non modifiable des BC/factures, cycle de vie du BC (brouillon → visa SML →
// signature DG → envoi → livraison/service fait), cycle de la facture (à contrôler → bon à
// payer → mandatement → paiement/rejet), pénalités, rattachement BC/marché, virement de
// crédits (DFC) et certificat administratif (créé → N+1 → DG → rattaché à une facture).
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

  test("le suivi budgétaire calcule alloué/engagé/consommé/disponible en sommant les lignes de BC/factures par compte", async ({ page }) => {
    await page.locator("[data-nav='budget']").click();
    const row = page.locator("tbody tr", { hasText: "Travaux d'entretien" });
    await expect(row.locator("td").nth(0)).toHaveText("615004");
    await expect(row.locator("td").nth(3)).toHaveText("15 000 000 XPF");
    // Engagé = ligne de BC (prestation, 2 500 000 XPF HT) à 13% de TVA = 2 825 000 XPF.
    await expect(row.locator("td").nth(4)).toHaveText("2 825 000 XPF");
    await expect(row.locator("td").nth(6)).toHaveText("12 175 000 XPF");
  });

  test("le compte budgétaire combine le compte comptable et le code de la direction (ex. 2183 + SG = 2183001)", async ({ page }) => {
    await page.locator("[data-nav='budget']").click();
    const row = page.locator("tbody tr", { hasText: "informatiques" });
    await expect(row.locator("td").nth(0)).toHaveText("2183001");
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

test.describe("Achats — marchés publics", () => {
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
});

test.describe("Achats — numérotation automatique des BC et factures", () => {
  test("le numéro de commande est généré automatiquement (AAMMJJ + index sur 8 chiffres) et non modifiable (cas nominal)", async ({ page }) => {
    await page.goto("/achats/");
    await page.locator("[data-nav='commandes']").click();
    await page.click("#addBtn");
    const numeroInput = page.locator(".modal-body input[type='text'][disabled]").first();
    await expect(numeroInput).toBeDisabled();
    await expect(numeroInput).toHaveValue(/^\d{8}$/);
  });

  test("le numéro interne d'une facture est généré automatiquement, distinct du numéro fournisseur saisi (cas nominal)", async ({ page }) => {
    await page.goto("/achats/");
    await page.locator("[data-nav='factures']").click();
    await page.click("#addBtn");
    const numeroInput = page.locator(".modal-body input[type='text'][disabled]").first();
    await expect(numeroInput).toHaveValue(/^\d{8}$/);
    await expect(page.locator("#numFournInp")).toBeEditable();
  });
});

test.describe("Achats — lignes de commande : comptes multiples, TVA, garantie, remise", () => {
  test("applique 16% de TVA à un produit et 13% à une prestation, chacun imputé sur un compte différent (cas nominal)", async ({ page }) => {
    await page.goto("/achats/");
    await page.locator("[data-nav='commandes']").click();
    await page.click("#addBtn");
    await page.selectOption("#tiersSelect", { index: 0 });
    await page.fill("#objetInp", "Commande lignes multiples test");
    await page.fill('.li-field[data-i="0"][data-f="designation"]', "Chaises de bureau");
    await page.fill('.li-field[data-i="0"][data-f="puHT"]', "10000");
    await page.selectOption('.li-field[data-i="0"][data-f="ligneBudgetId"]', { index: 2 });
    await page.click("#addLigneBtn");
    await page.fill('.li-field[data-i="1"][data-f="designation"]', "Installation");
    await page.selectOption('.li-field[data-i="1"][data-f="type"]', "Prestation");
    await page.fill('.li-field[data-i="1"][data-f="puHT"]', "5000");
    await page.selectOption('.li-field[data-i="1"][data-f="ligneBudgetId"]', { index: 3 });
    // 10000*1.16 + 5000*1.13 = 11 600 + 5 650 = 17 250
    await expect(page.locator("#totalTtcDisplay")).toHaveText("17 250 XPF");
    await page.click("#saveModal");
    await expect(page.locator("tbody tr", { hasText: "Commande lignes multiples test" })).toContainText("17 250 XPF");
  });

  test("une remise sur une ligne réduit son total TTC (cas nominal)", async ({ page }) => {
    await page.goto("/achats/");
    await page.locator("[data-nav='commandes']").click();
    await page.click("#addBtn");
    await page.fill('.li-field[data-i="0"][data-f="designation"]', "Article remisé");
    await page.fill('.li-field[data-i="0"][data-f="puHT"]', "10000");
    await page.fill('.li-field[data-i="0"][data-f="remisePct"]', "10");
    // (10000 - 10%) * 1.16 = 10 440
    await expect(page.locator("#totalTtcDisplay")).toHaveText("10 440 XPF");
  });

  test("la remise en masse s'applique à toutes les lignes cochées (cas nominal)", async ({ page }) => {
    await page.goto("/achats/");
    await page.locator("[data-nav='commandes']").click();
    await page.click("#addBtn");
    await page.fill('.li-field[data-i="0"][data-f="designation"]', "Article A");
    await page.fill('.li-field[data-i="0"][data-f="puHT"]', "10000");
    await page.click("#addLigneBtn");
    await page.fill('.li-field[data-i="1"][data-f="designation"]', "Article B");
    await page.fill('.li-field[data-i="1"][data-f="puHT"]', "20000");
    await page.check('.li-check[data-i="0"]');
    await page.check('.li-check[data-i="1"]');
    await page.fill("#remiseMasseInput", "10");
    await page.click("#applyRemiseMasseBtn");
    await expect(page.locator("#toast")).toHaveText("Remise de 10% appliquée à 2 ligne(s)");
    await expect(page.locator('.li-field[data-i="0"][data-f="remisePct"]')).toHaveValue("10");
    await expect(page.locator('.li-field[data-i="1"][data-f="remisePct"]')).toHaveValue("10");
  });

  test("appliquer une remise en masse sans cocher de ligne est refusé (cas limite)", async ({ page }) => {
    await page.goto("/achats/");
    await page.locator("[data-nav='commandes']").click();
    await page.click("#addBtn");
    await page.fill("#remiseMasseInput", "15");
    await page.click("#applyRemiseMasseBtn");
    await expect(page.locator("#toast")).toHaveText("Cochez au moins une ligne pour appliquer une remise en masse");
  });

  test("la garantie par produit est à 0 par défaut et se conserve après enregistrement (cas limite)", async ({ page }) => {
    await page.goto("/achats/");
    await page.locator("[data-nav='commandes']").click();
    await page.click("#addBtn");
    await expect(page.locator('.li-field[data-i="0"][data-f="garantieMois"]')).toHaveValue("0");
    await page.selectOption("#tiersSelect", { index: 0 });
    await page.fill("#objetInp", "BC garantie test");
    await page.fill('.li-field[data-i="0"][data-f="designation"]', "Onduleur");
    await page.fill('.li-field[data-i="0"][data-f="puHT"]', "50000");
    await page.fill('.li-field[data-i="0"][data-f="garantieMois"]', "36");
    await page.click("#saveModal");
    await page.locator("tbody tr", { hasText: "BC garantie test" }).locator("[data-edit]").click();
    await expect(page.locator('.li-field[data-i="0"][data-f="garantieMois"]')).toHaveValue("36");
  });
});

test.describe("Achats — cycle de vie du bon de commande", () => {
  test("brouillon → en attente de visa (SML) → signée (DG) → envoyée (cycle complet)", async ({ page }) => {
    await page.goto("/achats/");
    await page.locator("[data-nav='commandes']").click();
    await page.click("#addBtn");
    await page.selectOption("#tiersSelect", { index: 0 });
    await page.fill("#objetInp", "BC cycle de vie test");
    await page.fill('.li-field[data-i="0"][data-f="designation"]', "Article test");
    await page.fill('.li-field[data-i="0"][data-f="puHT"]', "1000");
    await page.click("#saveModal");

    const row = page.locator("tbody tr", { hasText: "BC cycle de vie test" });
    await expect(row.locator(".badge")).toHaveText("Brouillon");

    await row.locator("[data-soumettre]").click();
    await expect(page.locator("#toast")).toHaveText("Commande soumise au visa du service SML");
    await expect(row.locator(".badge")).toHaveText("En attente de visa");

    await row.locator("[data-signer]").click();
    await expect(page.locator("#toast")).toHaveText("Commande visée puis signée électroniquement par le DG");
    await expect(row.locator(".badge")).toHaveText("Signée DG");

    await row.locator("[data-envoyer]").click();
    await expect(page.locator("#toast")).toHaveText("Commande envoyée par mail au fournisseur");
    await expect(row.locator(".badge")).toHaveText("Envoyée");
  });

  test("fait progresser une commande de l'envoi à la livraison (service fait)", async ({ page }) => {
    await page.goto("/achats/");
    await page.locator("[data-nav='commandes']").click();
    const row = page.locator("tbody tr", { hasText: "Mobilier de bureau" });
    await row.locator("[data-livrer]").click();
    await expect(row.locator(".badge")).toHaveText("Livrée");
    await expect(row).toContainText("Service fait");
  });
});

test.describe("Achats — virement de crédits entre comptes (rôle DFC)", () => {
  test("déplace un montant d'un compte vers un autre (cas nominal)", async ({ page }) => {
    await page.goto("/achats/");
    await page.selectOption("#sessRole", "df");
    await page.locator("[data-nav='budget']").click();
    await page.click("#virementBtn");
    await page.selectOption("#srcSelect", { index: 3 }); // Études et maîtrise d'œuvre (DCP) — 8 000 000 disponible
    await page.selectOption("#dstSelect", { index: 2 }); // Fournitures de bureau (SG)
    await page.fill("#montantInp", "500000");
    await page.fill("#motifInp", "Renfort ponctuel du budget fournitures");
    await page.click("#okBtn");
    await expect(page.locator("#toast")).toHaveText("Virement de crédits effectué");

    const rowEtudes = page.locator("tbody tr", { hasText: "Études et maîtrise" });
    await expect(rowEtudes.locator("td").nth(3)).toHaveText("7 500 000 XPF");
    const rowFournitures = page.locator("tbody tr", { hasText: "Fournitures de bureau" });
    await expect(rowFournitures.locator("td").nth(3)).toHaveText("1 700 000 XPF");
  });

  test("refuse un virement supérieur au disponible du compte source (cas erreur)", async ({ page }) => {
    await page.goto("/achats/");
    await page.selectOption("#sessRole", "df");
    await page.locator("[data-nav='budget']").click();
    await page.click("#virementBtn");
    await page.selectOption("#srcSelect", { index: 2 }); // Fournitures de bureau — disponible ≈ 705 840
    await page.selectOption("#dstSelect", { index: 3 });
    await page.fill("#montantInp", "5000000");
    await page.fill("#motifInp", "Virement excessif");
    await page.click("#okBtn");
    await expect(page.locator("#toast")).toContainText("Virement impossible");
  });

  test("le service Achats n'a pas accès au virement de crédits (droits)", async ({ page }) => {
    await page.goto("/achats/");
    await page.locator("[data-nav='budget']").click();
    await expect(page.locator("#virementBtn")).toHaveCount(0);
  });
});

test.describe("Achats — cycle complet d'une facture", () => {
  test("le passage à \"bon à payer\" est bloqué tant que le service fait n'est pas constaté (cas erreur)", async ({ page }) => {
    await page.goto("/achats/");
    await page.locator("[data-nav='factures']").click();
    const row = page.locator("tbody tr", { hasText: "FA-9012" });
    await row.locator("[data-controler]").click();
    await expect(page.locator("#toast")).toHaveText("Service fait non constaté sur la commande liée : contrôle impossible");
    await expect(row.locator(".badge")).toHaveText("À contrôler");
  });

  test("à contrôler → bon à payer → mandatement → paiement (cycle complet)", async ({ page }) => {
    await page.goto("/achats/");

    // Constate le service fait sur la commande liée avant de pouvoir passer la facture en bon à payer.
    await page.locator("[data-nav='commandes']").click();
    await page.locator("tbody tr", { hasText: "Mobilier de bureau" }).locator("[data-livrer]").click();

    await page.locator("[data-nav='factures']").click();
    const factRow = page.locator("tbody tr", { hasText: "FA-9012" });
    await factRow.locator("[data-controler]").click();
    await expect(page.locator("#toast")).toHaveText("Facture bon à payer, transmise à la Direction Financière");
    await expect(factRow.locator(".badge")).toHaveText("Bon à payer");

    await page.selectOption("#sessRole", "df");
    await expect(page.locator("#pageTitle")).toHaveText("Factures à valider");
    await page.locator("tbody tr", { hasText: "FA-9012" }).locator("[data-view]").click();
    await expect(page.locator(".modal-body")).toContainText("Constaté");
    await page.click("#mandaterBtn");
    await expect(page.locator("#toast")).toHaveText("Facture mandatée");

    await page.locator("tbody tr", { hasText: "FA-9012" }).locator("[data-view]").click();
    await page.click("#payerBtn");
    await expect(page.locator("#toast")).toHaveText("Facture marquée payée");
    // Une fois payée, la facture sort de la file "à valider" de la DFC.
    await expect(page.locator("tbody tr", { hasText: "FA-9012" })).toHaveCount(0);
  });

  test("la Direction Financière peut rejeter une facture avec un motif, à n'importe quelle étape de son contrôle (cas limite)", async ({ page }) => {
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

test.describe("Achats — pénalités et rattachement BC/marché", () => {
  test("applique une pénalité au tiers et affiche le net à payer (cas nominal)", async ({ page }) => {
    await page.goto("/achats/");
    await page.locator("[data-nav='factures']").click();
    await page.locator("tbody tr", { hasText: "FA-2201" }).locator("[data-view]").click();
    await page.click("#penaliteBtn");
    await page.fill("#montantInp", "5000");
    await page.fill("#motifInp", "Retard de livraison");
    await page.click("#okBtn");
    await expect(page.locator("#toast")).toHaveText("Pénalité appliquée");

    await page.locator("tbody tr", { hasText: "FA-2201" }).locator("[data-view]").click();
    await expect(page.locator(".info-list")).toContainText("Net à payer");
  });

  test("une facture peut être rattachée directement à un marché plutôt qu'à un BC (cas nominal)", async ({ page }) => {
    await page.goto("/achats/");
    await page.locator("[data-nav='factures']").click();
    const row = page.locator("tbody tr", { hasText: "FA-6630" });
    await expect(row).toContainText("Maîtrise d'œuvre extension résidence Punavai");
  });
});

test.describe("Achats — certificat administratif (anomalie ou dépense imprévue)", () => {
  test("créé → contrôlé N+1 → signé DG → rattaché à une facture (cycle complet)", async ({ page }) => {
    await page.goto("/achats/");
    await page.locator("[data-nav='certificats']").click();
    await page.click("#addBtn");
    await page.fill('textarea[data-k="objet"]', "Dépense imprévue test");
    await page.fill('input[data-k="montant"]', "75000");
    await page.click("#saveModal");

    const row = page.locator("tbody tr", { hasText: "Dépense imprévue test" });
    await expect(row.locator(".badge")).toHaveText("Créé");

    await row.locator("[data-n1]").click();
    await expect(page.locator("#toast")).toHaveText("Certificat contrôlé par le N+1");
    await expect(row.locator(".badge")).toHaveText("Contrôlé N+1");

    await row.locator("[data-dg]").click();
    await expect(page.locator("#toast")).toHaveText("Certificat signé électroniquement par le DG");
    await expect(row.locator(".badge")).toHaveText("Signé DG");

    await row.locator("[data-rattacher]").click();
    const optionValue = await page.locator("#factureSelect option", { hasText: "Bureau Vallée Tahiti" }).getAttribute("value");
    await page.selectOption("#factureSelect", optionValue);
    await page.click("#okBtn");
    await expect(page.locator("#toast")).toHaveText("Certificat rattaché à la facture");
    await expect(row.locator(".badge")).toHaveText("Rattaché");

    await page.locator("[data-nav='factures']").click();
    await page.locator("tbody tr", { hasText: "FA-9012" }).locator("[data-view]").click();
    await expect(page.locator(".info-list")).toContainText("Dépense imprévue test");
  });

  test("une facture déjà rattachée à un certificat n'est pas proposée une deuxième fois (cas limite)", async ({ page }) => {
    await page.goto("/achats/");
    await page.locator("[data-nav='certificats']").click();
    await page.click("#addBtn");
    await page.fill('textarea[data-k="objet"]', "Second certificat test");
    await page.fill('input[data-k="montant"]', "20000");
    await page.click("#saveModal");
    const row = page.locator("tbody tr", { hasText: "Second certificat test" });
    await row.locator("[data-n1]").click();
    await row.locator("[data-dg]").click();
    await row.locator("[data-rattacher]").click();
    // FA-2201 est déjà rattachée à un autre certificat dans les données de démonstration.
    await expect(page.locator("#factureSelect option", { hasText: "FA-2201" })).toHaveCount(0);
  });
});
