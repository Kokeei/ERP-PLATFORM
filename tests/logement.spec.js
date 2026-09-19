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

  test("crée un nouveau logement rattaché à un lotissement (cas nominal)", async ({ page }) => {
    await page.locator("[data-nav='logements']").click();
    await page.click("#addBtn");
    await page.selectOption('select[data-k="lotissementId"]', { label: "Manutahi" });
    await page.fill('input[data-k="numero"]', "Z99");
    await page.click("#saveModal");
    await expect(page.locator("#toast")).toHaveText("Enregistrement créé");
    await expect(page.locator("tbody tr", { hasText: "Manutahi Z99" })).toBeVisible();
  });

  test("crée un stationnement (garage) au sein d'un lotissement (cas nominal)", async ({ page }) => {
    await page.locator("[data-nav='logements']").click();
    await page.click("#addBtn");
    await page.selectOption('select[data-k="lotissementId"]', { label: "Teavaraa" });
    await page.selectOption('select[data-k="categorie"]', "Stationnement");
    await page.selectOption('select[data-k="type"]', "Garage");
    await page.fill('input[data-k="numero"]', "G-B02");
    await page.click("#saveModal");
    await expect(page.locator("#toast")).toHaveText("Enregistrement créé");
    const row = page.locator("tbody tr", { hasText: "Teavaraa G-B02" });
    await expect(row).toBeVisible();
    await expect(row).toContainText("Stationnement");
  });
});

test.describe("Logement — lotissements (profil Gestion)", () => {
  test("liste les lotissements avec le nombre de logements associés (cas nominal)", async ({ page }) => {
    await page.goto("/logement/");
    await page.locator("[data-nav='lotissements']").click();
    await expect(page.locator("#pageTitle")).toHaveText("Lotissements");
    const row = page.locator("tbody tr", { hasText: "Manutahi" });
    await expect(row).toBeVisible();
  });

  test("crée un nouveau lotissement (cas nominal)", async ({ page }) => {
    await page.goto("/logement/");
    await page.locator("[data-nav='lotissements']").click();
    await page.click("#addBtn");
    await page.fill('input[data-k="nom"]', "Nouveau Lotissement Test");
    await page.click("#saveModal");
    await expect(page.locator("#toast")).toHaveText("Enregistrement créé");
    await expect(page.locator("tbody tr", { hasText: "Nouveau Lotissement Test" })).toBeVisible();
  });
});

test.describe("Logement — réhabilitations (profil Gestion)", () => {
  test("liste les réhabilitations planifiées et en cours sur le parc (cas nominal)", async ({ page }) => {
    await page.goto("/logement/");
    await page.locator("[data-nav='rehabilitations']").click();
    await expect(page.locator("#pageTitle")).toHaveText("Réhabilitations");
    await expect(page.locator("tbody tr", { hasText: "SOPADEP TP" })).toBeVisible();
  });

  test("crée une nouvelle réhabilitation rattachée à un lotissement (cas nominal)", async ({ page }) => {
    await page.goto("/logement/");
    await page.locator("[data-nav='rehabilitations']").click();
    await page.click("#addBtn");
    await page.selectOption('select[data-k="lotissementId"]', { label: "Punavai" });
    await page.fill('input[data-k="objet"]', "Réfection des réseaux d'eau");
    await page.fill('input[data-k="dateDebut"]', "2026-11-01");
    await page.click("#saveModal");
    await expect(page.locator("#toast")).toHaveText("Enregistrement créé");
    await expect(page.locator("tbody tr", { hasText: "Réfection des réseaux d'eau" })).toBeVisible();
  });
});

test.describe("Logement — entretien de l'ensemble du parc (profil Gestion)", () => {
  test("une intervention peut cibler un logement vacant sans bail ni locataire (cas limite)", async ({ page }) => {
    await page.goto("/logement/");
    await page.locator("[data-nav='interventions']").click();
    const row = page.locator("tbody tr", { hasText: "Rafraîchissement des peintures" });
    await expect(row).toBeVisible();
    await expect(row).toContainText("Partie commune / vacant");
  });

  test("crée une intervention sur un logement vacant, sans passer par un bail (cas nominal)", async ({ page }) => {
    await page.goto("/logement/");
    await page.locator("[data-nav='interventions']").click();
    await page.click("#addBtn");
    await page.selectOption('select[data-k="logementId"]', { label: "Ariiheue C02" });
    await page.fill('textarea[data-k="description"]', "Contrôle de la VMC avant remise en location");
    await page.click("#saveModal");
    await expect(page.locator("#toast")).toHaveText("Enregistrement créé");
    await expect(page.locator("tbody tr", { hasText: "Contrôle de la VMC" })).toBeVisible();
  });
});

test.describe("Logement — aides au logement (AFL/ALE) sur les quittances", () => {
  test("le montant de la quittance déduit l'aide au logement du bail éligible (cas nominal)", async ({ page }) => {
    await page.goto("/logement/");
    await page.locator("[data-nav='quittances']").click();
    await page.click("#genBtn");
    const row = page.locator("tbody tr", { hasText: "TEPAVA" }).first();
    await expect(row).toContainText("d'aide déduite");
  });

  test("un bail sans aide au logement n'affiche aucune déduction sur sa quittance (cas limite)", async ({ page }) => {
    await page.goto("/logement/");
    await page.locator("[data-nav='quittances']").click();
    await page.click("#genBtn");
    const row = page.locator("tbody tr", { hasText: "TERIIERO" }).first();
    await expect(row).not.toContainText("d'aide déduite");
  });
});

test.describe("Logement — accession à la propriété", () => {
  test("un bail en accession à la propriété apparaît distinctement dans la liste des baux (cas nominal)", async ({ page }) => {
    await page.goto("/logement/");
    await page.locator("[data-nav='baux']").click();
    await expect(page.locator("tbody tr", { hasText: "Accession à la propriété" })).toBeVisible();
  });

  test("le locataire en accession voit \"Mensualité\" et le prix de vente au lieu du loyer (cas nominal)", async ({ page }) => {
    await page.goto("/logement/");
    await page.evaluate(() => {
      const logement = DB.logements.find(l => l.statut === "Vacant" && (l.categorie || "Logement") === "Logement");
      const locataire = { id: "lo_test_accession", civ: "M.", nom: "ACCESSIONTEST", prenom: "Jean" };
      DB.locataires.push(locataire);
      DB.baux.push({ id: "bx_test_accession", locataireId: locataire.id, logementId: logement.id, dateEffet: todayISO(), loyer: 90000, charges: 0, depotGarantie: 0, statut: "Actif", modeOccupation: "Accession à la propriété", prixVente: 20000000, aideType: "Aucune", aideMontant: 0 });
      save();
    });
    await page.selectOption("#sessRole", "locataire");
    await page.selectOption("#sessId", { label: "Jean ACCESSIONTEST" });
    await page.locator("#nav a", { hasText: "Mon bail" }).click();
    await expect(page.locator(".info-list .row", { hasText: "Mensualité" })).toBeVisible();
    await expect(page.locator(".info-list .row", { hasText: "Prix de vente" })).toBeVisible();
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
    await expect(page.locator("tbody tr", { hasText: "FAANA" }).locator(".badge").last()).toHaveText("Proposée");

    await page.locator("tbody tr", { hasText: "FAANA" }).click();
    await page.click('[data-act="attribuer"]');
    await expect(page.locator("#toast")).toHaveText("Logement attribué : locataire et bail créés");
    await expect(page.locator("tbody tr", { hasText: "FAANA" }).locator(".badge").last()).toHaveText("Attribuée");

    // Le locataire et le bail doivent exister automatiquement.
    await page.locator("[data-nav='locataires']").click();
    await expect(page.locator("tbody tr", { hasText: "FAANA" })).toHaveCount(1);
    await page.locator("[data-nav='baux']").click();
    await expect(page.locator("tbody tr", { hasText: "FAANA" })).toHaveCount(1);
  });

  test("une demande en instruction peut être refusée (cas limite)", async ({ page }) => {
    await page.locator("tbody tr", { hasText: "MARAEURA" }).click();
    await page.click('[data-act="Refusée"]');
    await expect(page.locator("tbody tr", { hasText: "MARAEURA" }).locator(".badge").last()).toHaveText("Refusée");
  });

  test("une demande déposée n'a qu'une seule action disponible : passer en instruction (cas limite)", async ({ page }) => {
    await page.locator("tbody tr", { hasText: "AH-PUOU" }).click();
    await expect(page.locator("[data-act]")).toHaveCount(1);
    await page.click('[data-act="Instruction"]');
    await expect(page.locator("tbody tr", { hasText: "AH-PUOU" }).locator(".badge").last()).toHaveText("Instruction");
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

test.describe("Logement — fiche détail d'un lotissement (profil Gestion)", () => {
  test("affiche identité, équipements, typologie et logements accessibles PMR (cas nominal)", async ({ page }) => {
    await page.goto("/logement/");
    await page.locator("[data-nav='lotissements']").click();
    await page.locator("tbody tr", { hasText: "Teavaraa" }).click();
    await expect(page.locator(".modal-head h3")).toContainText("Teavaraa");
    await expect(page.locator(".kpi", { hasText: "Accessibles PMR" })).toContainText("1");
    await expect(page.locator(".badge.ok", { hasText: "Aire de jeux" })).toBeVisible();
    await expect(page.locator(".badge.mut", { hasText: "Ascenseur" })).toBeVisible();
    await expect(page.locator(".modal-body table", { hasText: "T4" }).first()).toBeVisible();
  });

  test("les boutons modifier/supprimer de la liste n'ouvrent pas la fiche détail (cas limite)", async ({ page }) => {
    await page.goto("/logement/");
    await page.locator("[data-nav='lotissements']").click();
    await page.locator("tbody tr", { hasText: "Manutahi" }).locator("[data-edit]").click();
    await expect(page.locator(".modal-head h3")).toHaveText("Modifier lotissement");
  });
});

test.describe("Logement — pistes foncières (profil Gestion)", () => {
  test("liste les pistes foncières repérées (cas nominal)", async ({ page }) => {
    await page.goto("/logement/");
    await page.locator("[data-nav='pistes-foncieres']").click();
    await expect(page.locator("#pageTitle")).toHaveText("Pistes foncières");
    await expect(page.locator("tbody tr", { hasText: "Taharuu" })).toBeVisible();
  });

  test("crée une nouvelle piste foncière (cas nominal)", async ({ page }) => {
    await page.goto("/logement/");
    await page.locator("[data-nav='pistes-foncieres']").click();
    await page.click("#addBtn");
    await page.fill('input[data-k="nom"]', "Réserve Vaitupa");
    await page.click("#saveModal");
    await expect(page.locator("#toast")).toHaveText("Enregistrement créé");
    await expect(page.locator("tbody tr", { hasText: "Réserve Vaitupa" })).toBeVisible();
  });
});

test.describe("Logement — projets de construction (profil Gestion)", () => {
  test("liste les projets pilotés par les chargés d'opération (cas nominal)", async ({ page }) => {
    await page.goto("/logement/");
    await page.locator("[data-nav='projets-construction']").click();
    await expect(page.locator("#pageTitle")).toHaveText("Projets de construction");
    await expect(page.locator("tbody tr", { hasText: "Extension Punavai tranche 2" })).toContainText("Indigo");
  });

  test("crée un nouveau projet de construction (cas nominal)", async ({ page }) => {
    await page.goto("/logement/");
    await page.locator("[data-nav='projets-construction']").click();
    await page.click("#addBtn");
    await page.fill('input[data-k="nom"]', "Extension Ariiheue");
    await page.fill('input[data-k="chargeOperation"]', "Test CHARGE");
    await page.click("#saveModal");
    await expect(page.locator("#toast")).toHaveText("Enregistrement créé");
    await expect(page.locator("tbody tr", { hasText: "Extension Ariiheue" })).toBeVisible();
  });
});

test.describe("Logement — demande AAHI (aide à l'amélioration de l'habitat individuel)", () => {
  test("l'attribution AAHI n'enregistre qu'une aide, sans création de bail (cas nominal)", async ({ page }) => {
    await page.goto("/logement/");
    await page.locator("[data-nav='demandeurs']").click();
    await page.locator("tbody tr", { hasText: "TEAI" }).click();
    await expect(page.locator("[data-act]")).toHaveCount(2);
    await page.click('[data-act="attribuerAahi"]');
    await page.fill("#montantInp", "650000");
    await page.click("#okBtn");
    await expect(page.locator("#toast")).toHaveText("Aide AAHI attribuée");
    await expect(page.locator("tbody tr", { hasText: "TEAI" }).locator(".badge").last()).toHaveText("Attribuée");

    await page.locator("tbody tr", { hasText: "TEAI" }).click();
    await expect(page.locator(".info-list")).toContainText("650 000 XPF");
    await page.click("#cancelModal");

    await page.locator("[data-nav='baux']").click();
    await expect(page.locator("tbody tr", { hasText: "TEAI" })).toHaveCount(0);
  });
});

test.describe("Logement — demande FARE (habitat individuel sur terrain propre)", () => {
  test("l'attribution Fare capture le type et le terrain, sans création de bail (cas nominal)", async ({ page }) => {
    await page.goto("/logement/");
    await page.locator("[data-nav='demandeurs']").click();
    await page.locator("tbody tr", { hasText: "TAUFA" }).click();
    await page.click('[data-act="attribuerFare"]');
    await page.selectOption("#typeInp", "F4");
    await page.click("#okBtn");
    await expect(page.locator("#toast")).toHaveText("Fare attribué");
    await expect(page.locator("tbody tr", { hasText: "TAUFA" }).locator(".badge").last()).toHaveText("Attribuée");

    await page.locator("tbody tr", { hasText: "TAUFA" }).click();
    await expect(page.locator(".info-list")).toContainText("F4");
    await page.click("#cancelModal");

    await page.locator("[data-nav='baux']").click();
    await expect(page.locator("tbody tr", { hasText: "TAUFA" })).toHaveCount(0);
  });
});

test.describe("Logement — demande CHE (hébergement étudiant, cycle complet)", () => {
  test("un étudiant proposé puis attribué devient locataire étudiant avec un bail CHE annuel (cycle complet)", async ({ page }) => {
    await page.goto("/logement/");
    await page.locator("[data-nav='demandeurs']").click();
    await page.locator("tbody tr", { hasText: "Toriki MARAE" }).click();
    await page.click('[data-act="proposeChe"]');
    await expect(page.locator("#okBtn")).toBeEnabled();
    await page.click("#okBtn");
    await expect(page.locator("#toast")).toHaveText("Hébergement CHE proposé au demandeur");
    await expect(page.locator("tbody tr", { hasText: "Toriki MARAE" }).locator(".badge").last()).toHaveText("Proposée");

    await page.locator("tbody tr", { hasText: "Toriki MARAE" }).click();
    await page.click('[data-act="attribuerChe"]');
    await expect(page.locator("#toast")).toHaveText("Hébergement CHE attribué : locataire et bail créés");

    await page.locator("[data-nav='baux']").click();
    await expect(page.locator("tbody tr", { hasText: "Toriki MARAE" })).toContainText("CHE");
  });

  test("un logement CHE à pleine capacité n'est plus proposable (cas limite)", async ({ page }) => {
    await page.goto("/logement/");
    await page.evaluate(() => {
      // Sature toutes les places CHE restantes (Outumaoro + Paraita) pour vérifier le garde-fou de capacité.
      DB.logements.filter(l => l.categorie === "CHE").forEach(l => {
        const restantes = (l.capacite || 1) - occupantsCount(l.id);
        for (let i = 0; i < restantes; i++) {
          const locataire = { id: "lo_test_che_full_" + l.id + "_" + i, civ: "M.", nom: "COLOC", prenom: "Test" + i, estEtudiant: true };
          DB.locataires.push(locataire);
          DB.baux.push({ id: "bx_test_che_full_" + l.id + "_" + i, locataireId: locataire.id, logementId: l.id, dateEffet: todayISO(), loyer: l.loyerBase, charges: 0, depotGarantie: 0, statut: "Actif", modeOccupation: "CHE", anneeAcademique: "2025-2026" });
        }
        l.statut = "Occupé";
      });
      save();
    });
    await page.locator("[data-nav='demandeurs']").click();
    await page.locator("tbody tr", { hasText: "Toriki MARAE" }).click();
    await page.click('[data-act="proposeChe"]');
    await expect(page.locator("#okBtn")).toBeDisabled();
    await expect(page.locator("#logSelect")).toContainText("Aucune place disponible");
  });
});
