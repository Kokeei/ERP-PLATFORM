// Parcours E2E du module GED (Gestion Électronique des Documents) : accès, arborescence,
// dépôt, consultation, téléchargement, versioning, corbeille/restauration, droits, et
// intégration avec le dossier agent du module RH.
const path = require("path");
const { test, expect } = require("@playwright/test");

const FIXTURE_TXT = path.join(__dirname, "fixtures", "document-test.txt");
const FIXTURE_PDF = path.join(__dirname, "fixtures", "document-test.pdf");

async function gotoGed(page) {
  await page.goto("/ged/");
}
async function openAgentsFolder(page) {
  await page.locator('[data-folder="dos_rh_agents"]').click();
}

test.describe("GED — accès et navigation", () => {
  test("le portail propose la GED comme module disponible", async ({ page }) => {
    await page.goto("/");
    const card = page.locator('a.card[href="ged/"]');
    await expect(card).toBeVisible();
    await expect(card.locator("h3")).toHaveText("GED");
    await expect(card.locator(".badge")).toHaveText(/Disponible/);
  });

  test("le module GED se charge avec l'arborescence des espaces existants", async ({ page }) => {
    await gotoGed(page);
    await expect(page).toHaveTitle(/OPH · GED/);
    await expect(page.locator("#pageTitle")).toHaveText("Parcourir");
    await expect(page.locator(".ged-space-head", { hasText: "RH" })).toBeVisible();
    await expect(page.locator(".ged-space-head", { hasText: "Marchés" })).toBeVisible();
    await expect(page.locator('[data-folder="dos_rh_agents"]')).toBeVisible();
  });
});

test.describe("GED — création de dossier (profil RH)", () => {
  test("la RH peut créer un nouveau dossier dans un espace (cas nominal)", async ({ page }) => {
    await gotoGed(page);
    page.once("dialog", (d) => d.accept("Marchés publics 2026"));
    await page.locator('[data-new-folder="esp_marches"]').click();
    await expect(page.locator(".ged-folder", { hasText: "Marchés publics 2026" })).toBeVisible();
  });

  test("un agent en self-service ne voit pas l'action de création de dossier", async ({ page }) => {
    await gotoGed(page);
    await page.selectOption("#sessRole", "agent");
    await expect(page.locator("[data-new-folder]")).toHaveCount(0);
  });
});

test.describe("GED — dépôt, consultation et téléchargement (profil RH)", () => {
  test("dépose un document dans un dossier et le retrouve dans la liste (cas nominal)", async ({ page }) => {
    await gotoGed(page);
    await openAgentsFolder(page);
    await page.click("#uploadBtn");
    await page.setInputFiles("#gedFileInput", FIXTURE_TXT);
    await expect(page.locator(".ged-upload-status", { hasText: "Déposé" })).toBeVisible();
    await page.click("#gedCancelUpload");

    const row = page.locator("tbody tr", { hasText: "document-test.txt" });
    await expect(row).toHaveCount(1);
  });

  test("refuse un fichier avec une extension dangereuse (cas erreur)", async ({ page }) => {
    await gotoGed(page);
    await openAgentsFolder(page);
    await page.click("#uploadBtn");
    // Fabrique un faux .exe à la volée à partir de la fixture texte (contenu non pertinent ici).
    await page.evaluate(async () => {
      const input = document.getElementById("gedFileInput");
      const file = new File(["contenu"], "programme.exe", { type: "application/octet-stream" });
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event("change"));
    });
    await expect(page.locator(".ged-errors")).toContainText("non autorisée");
    await expect(page.locator(".ged-upload-status", { hasText: "Échec" })).toBeVisible();
  });

  test("consulte le détail d'un document et le télécharge", async ({ page }) => {
    await gotoGed(page);
    await openAgentsFolder(page);
    await page.click("#uploadBtn");
    await page.setInputFiles("#gedFileInput", FIXTURE_PDF);
    await expect(page.locator(".ged-upload-status", { hasText: "Déposé" })).toBeVisible();
    await page.click("#gedCancelUpload");

    await page.locator("tbody tr", { hasText: "document-test.pdf" }).click();
    await expect(page.locator(".modal-head h3")).toHaveText("document-test.pdf");
    await expect(page.locator(".info-list")).toContainText("Version");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.click("#gedDlBtn")
    ]);
    expect(download.suggestedFilename()).toBe("document-test.pdf");
  });
});

test.describe("GED — versioning (profil RH)", () => {
  test("ajoute une nouvelle version sans perdre l'historique (cas nominal)", async ({ page }) => {
    await gotoGed(page);
    await openAgentsFolder(page);
    await page.click("#uploadBtn");
    await page.setInputFiles("#gedFileInput", FIXTURE_TXT);
    await expect(page.locator(".ged-upload-status", { hasText: "Déposé" })).toBeVisible();
    await page.click("#gedCancelUpload");

    await page.locator("tbody tr", { hasText: "document-test.txt" }).click();
    // "Nouvelle version" crée dynamiquement un <input type=file> ; Playwright intercepte
    // la boîte de sélection au niveau du navigateur, indépendamment de sa présence dans le DOM.
    page.once("dialog", (d) => d.accept("Correction du contenu"));
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.click("#gedVersionBtn")
    ]);
    await fileChooser.setFiles(FIXTURE_TXT);
    await expect(page.locator(".info-list .row", { hasText: "Version" })).toContainText("v2");
    await expect(page.locator(".ged-version-row")).toHaveCount(2);
  });
});

test.describe("GED — corbeille et restauration (profil RH)", () => {
  test("supprime un document, le retrouve en corbeille puis le restaure (cycle complet)", async ({ page }) => {
    await gotoGed(page);
    await openAgentsFolder(page);
    await page.click("#uploadBtn");
    await page.setInputFiles("#gedFileInput", FIXTURE_TXT);
    await expect(page.locator(".ged-upload-status", { hasText: "Déposé" })).toBeVisible();
    await page.click("#gedCancelUpload");

    await page.locator("tbody tr", { hasText: "document-test.txt" }).click();
    await page.click("#gedDelBtn");
    await expect(page.locator("tbody tr", { hasText: "document-test.txt" })).toHaveCount(0);

    await page.locator('[data-nav="corbeille"]').click();
    const trashRow = page.locator("tbody tr", { hasText: "document-test.txt" });
    await expect(trashRow).toHaveCount(1);

    await trashRow.locator("[data-open]").click();
    await page.click("#gedRestoreBtn");

    await page.locator('[data-nav="parcourir"]').click();
    await openAgentsFolder(page);
    await expect(page.locator("tbody tr", { hasText: "document-test.txt" })).toHaveCount(1);
  });
});

test.describe("GED — contrôle des droits par profil", () => {
  test("un agent en self-service n'a pas accès au journal d'audit", async ({ page }) => {
    await gotoGed(page);
    await page.selectOption("#sessRole", "agent");
    await expect(page.locator("[data-nav]", { hasText: "Journal d'audit" })).toHaveCount(0);
  });

  test("la RH voit le journal d'audit alimenté après un dépôt", async ({ page }) => {
    await gotoGed(page);
    await openAgentsFolder(page);
    await page.click("#uploadBtn");
    await page.setInputFiles("#gedFileInput", FIXTURE_TXT);
    await expect(page.locator(".ged-upload-status", { hasText: "Déposé" })).toBeVisible();
    await page.click("#gedCancelUpload");

    await page.locator('[data-nav="audit"]').click();
    await expect(page.locator("tbody tr", { hasText: "Création" }).first()).toBeVisible();
  });
});

test.describe("GED — intégration avec le dossier agent RH", () => {
  test("les documents historiques du dossier agent apparaissent dans l'onglet Documents", async ({ page }) => {
    await page.goto("/rh/");
    await page.locator('[data-nav="agents"]').click();
    await page.locator("tbody tr", { hasText: "TEHEIURA" }).first().click();
    await page.locator('#detailTabs [data-tab="documents"]').click();
    await page.locator(".doc-cat-head", { hasText: "Information personnelle" }).click();
    const historique = page.locator(".doc-row", { hasText: "CV_Teheiura_Manea.pdf" });
    await expect(historique).toBeVisible();
    await historique.click();
    await expect(page.locator(".modal-body")).toContainText("aucun fichier numérisé");
  });

  test("la RH dépose un nouveau document depuis le dossier agent (cas nominal)", async ({ page }) => {
    await page.goto("/rh/");
    await page.locator('[data-nav="agents"]').click();
    await page.locator("tbody tr", { hasText: "TEHEIURA" }).first().click();
    await page.locator('#detailTabs [data-tab="documents"]').click();
    await page.click("#detailAdd");
    await expect(page.locator(".modal-head h3")).toContainText("Manea TEHEIURA");
    await page.setInputFiles("#gedFileInput", FIXTURE_PDF);
    await expect(page.locator(".ged-upload-status", { hasText: "Déposé" })).toBeVisible();
    await page.click("#gedCancelUpload");

    await page.locator(".doc-cat-head", { hasText: "Carrière" }).click();
    await expect(page.locator(".doc-row", { hasText: "document-test.pdf" })).toBeVisible();
  });
});
