// ============================================================================
// GED — Gestion Électronique des Documents — couche de service (données + logique).
//
// Brique transverse, sans dépendance DOM, chargeable depuis n'importe quel module
// de l'ERP (module GED lui-même, module RH, futurs modules Marchés/Finance/Juridique...).
//
// Contexte technique du dépôt : application 100% statique (aucun serveur, aucune base
// de données, aucune authentification réelle — cf. CLAUDE.md). Cette couche reproduit
// donc, côté client, l'esprit d'une architecture GED réelle (StorageProvider abstrait,
// modèle de données séparé du stockage physique, contrôle des droits, journalisation),
// mais TOUT s'exécute dans le navigateur : les vérifications de droits ci-dessous sont
// une simulation pédagogique, pas une sécurité serveur. Un déploiement réel nécessiterait
// un backend qui applique les mêmes règles côté serveur (cf. section « Sécurité » du
// rapport de livraison).
//
// Réutilise l'identité et l'annuaire des agents déjà en place dans le module RH
// (mêmes clés localStorage : "oph_rh_v1" et "oph_rh_v1_session") plutôt que de
// réinventer une session ou un référentiel agents séparé.
// ============================================================================
(function (global) {
  "use strict";

  const META_KEY = "oph_ged_v1";
  const RH_DB_KEY = "oph_rh_v1";
  const RH_SESSION_KEY = "oph_rh_v1_session";
  const IDB_NAME = "oph_ged_files_v1";
  const IDB_STORE = "blobs";

  function uid(prefix) {
    return prefix + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-5);
  }
  function nowStamp() {
    const d = new Date();
    return d.toLocaleDateString("fr-FR") + " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }
  function extensionOf(filename) {
    const m = /\.([a-z0-9]+)$/i.exec(filename || "");
    return m ? m[1].toLowerCase() : "";
  }
  // Sépare le nom affiché du nom physique : jamais le chemin réel du fichier, jamais
  // de caractères permettant une évasion de dossier (path traversal) si ce nom devait
  // un jour servir de clé de stockage lisible.
  function sanitizeName(name) {
    return String(name || "document")
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
      .replace(/^\.+/, "")
      .slice(0, 180) || "document";
  }

  /* ------------------------------------------------------------------------
   * StorageProvider : abstraction du stockage physique du fichier, séparée du
   * modèle de métadonnées. Le reste de l'application ne connaît qu'une
   * "storageKey" opaque, jamais un chemin réel — un futur backend pourrait
   * fournir un ObjectStorageProvider / S3CompatibleStorageProvider qui
   * respecte la même interface (save/load/remove) sans rien changer ailleurs.
   * ------------------------------------------------------------------------ */
  class StorageProvider {
    async save(_blob) { throw new Error("StorageProvider.save non implémenté"); }
    async load(_key) { throw new Error("StorageProvider.load non implémenté"); }
    async remove(_key) { throw new Error("StorageProvider.remove non implémenté"); }
  }

  class IndexedDBStorageProvider extends StorageProvider {
    _open() {
      if (this._dbPromise) return this._dbPromise;
      this._dbPromise = new Promise((resolve, reject) => {
        if (!global.indexedDB) { reject(new Error("IndexedDB indisponible sur ce navigateur")); return; }
        const req = global.indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = () => { req.result.createObjectStore(IDB_STORE); };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      return this._dbPromise;
    }
    async save(blob) {
      const db = await this._open();
      const key = uid("blob_");
      await new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).put(blob, key);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      return key;
    }
    async load(key) {
      if (!key) return null;
      const db = await this._open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readonly");
        const req = tx.objectStore(IDB_STORE).get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    }
    async remove(key) {
      if (!key) return;
      const db = await this._open();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).delete(key);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    }
  }

  /* ------------------------------------------------------------------------
   * Référentiel / configuration par défaut — rien n'est codé en dur dans la
   * logique : catégories, classifications, espaces et dossiers sont des
   * données modifiables (écran d'administration à prévoir en évolution).
   * ------------------------------------------------------------------------ */
  function defaultSpaces() {
    return [
      { id: "esp_rh", nom: "RH" },
      { id: "esp_marches", nom: "Marchés" },
      { id: "esp_finance", nom: "Finance" },
      { id: "esp_juridique", nom: "Juridique" },
      { id: "esp_administration", nom: "Administration" }
    ];
  }
  function defaultFolders() {
    return [
      { id: "dos_rh_agents", espaceId: "esp_rh", parentId: null, nom: "Agents" }
    ];
  }
  // Catégories reprises telles quelles du module RH existant (Carrière / Médical /
  // Formation / Information personnelle / Bulletins de paie) pour ne rien casser côté
  // dossier agent, complétées par des catégories transverses pour les autres espaces.
  function defaultCategories() {
    return [
      { id: "cat_carriere", nom: "Carrière", champs: [] },
      { id: "cat_medical", nom: "Médical", champs: [] },
      { id: "cat_formation", nom: "Formation", champs: [
        { k: "organisme", l: "Organisme", t: "text" },
        { k: "duree", l: "Durée", t: "text" },
        { k: "certificatObtenu", l: "Certificat obtenu", t: "bool" }
      ] },
      { id: "cat_info_perso", nom: "Information personnelle", champs: [] },
      { id: "cat_paie", nom: "Bulletins de paie", champs: [{ k: "periode", l: "Période", t: "month" }] },
      { id: "cat_contrat", nom: "Contrat", champs: [
        { k: "typeContrat", l: "Type de contrat", t: "text" },
        { k: "dateDebut", l: "Date de début", t: "date" },
        { k: "dateFin", l: "Date de fin", t: "date" }
      ] },
      { id: "cat_juridique", nom: "Juridique", champs: [] },
      { id: "cat_marche", nom: "Marché", champs: [] },
      { id: "cat_finance", nom: "Finance", champs: [] },
      { id: "cat_administratif", nom: "Documents administratifs", champs: [] }
    ];
  }
  function defaultClassifications() {
    return [
      { id: "public", nom: "Public", niveau: 0 },
      { id: "interne", nom: "Interne", niveau: 1 },
      { id: "confidentiel", nom: "Confidentiel", niveau: 2 },
      { id: "tres_confidentiel", nom: "Très confidentiel", niveau: 3 }
    ];
  }
  function defaultConfig() {
    return {
      retentionCorbeilleJours: 30,
      nomTemplate: "{TYPE}_{NOM}_{DATE}",
      // Liste blanche implicite via liste noire d'extensions dangereuses (exécutables,
      // scripts) — un dépôt de fichier de ce type est refusé côté client, comme le
      // ferait un contrôle serveur dans une vraie GED.
      extensionsInterdites: ["exe", "bat", "cmd", "sh", "js", "mjs", "jar", "msi", "com", "scr", "vbs", "vbe", "ps1", "apk", "dll"],
      tailleMaxMo: 25,
      legacyImported: false
    };
  }
  function seed() {
    return {
      spaces: defaultSpaces(),
      folders: defaultFolders(),
      categories: defaultCategories(),
      classifications: defaultClassifications(),
      documents: [],
      versions: [],
      tags: ["Contrat", "Formation", "Paie", "Médical", "Administratif", "Juridique"],
      auditLog: [],
      config: defaultConfig()
    };
  }
  function migrate(db) {
    if (!db.spaces) db.spaces = defaultSpaces();
    if (!db.folders) db.folders = defaultFolders();
    if (!db.categories) db.categories = defaultCategories();
    if (!db.classifications) db.classifications = defaultClassifications();
    if (!db.documents) db.documents = [];
    if (!db.versions) db.versions = [];
    if (!db.tags) db.tags = [];
    if (!db.auditLog) db.auditLog = [];
    if (!db.config) db.config = defaultConfig();
    if (db.config.legacyImported === undefined) db.config.legacyImported = false;
    return db;
  }

  let DB = null;
  const storage = new IndexedDBStorageProvider();

  function persist() {
    try { global.localStorage.setItem(META_KEY, JSON.stringify(DB)); }
    catch (e) { console.warn("GED: échec de sauvegarde locale", e); }
  }

  // Reprend l'historique documentaire déjà présent dans le module RH (DB.documents,
  // uniquement des métadonnées, aucun fichier réel n'a jamais existé pour ces entrées)
  // pour que rien ne disparaisse de l'écran "Documents" du dossier agent après bascule
  // vers la GED. Se déclenche une seule fois (config.legacyImported).
  const LEGACY_TYPE_TO_CATEGORY = {
    "Aménagement horaire": "cat_carriere", "Attestation diverse": "cat_carriere",
    "CDD - Avenant": "cat_carriere", "CDD - Contrat de travail": "cat_carriere",
    "CDI - Avenant": "cat_carriere", "CDI - Contrat de travail": "cat_carriere",
    "Correspondances": "cat_carriere", "Décès": "cat_carriere", "Décision": "cat_carriere",
    "Discipline": "cat_carriere", "Fiche de poste": "cat_carriere", "Fin de contrat": "cat_carriere",
    "Maternité": "cat_carriere", "Notations": "cat_carriere", "Réorganisation horaire": "cat_carriere",
    "Aptitude médical": "cat_medical",
    "Attestations de formation": "cat_formation",
    "Cartes CPS": "cat_info_perso", "CV": "cat_info_perso", "Diplômes": "cat_info_perso",
    "Recrutement": "cat_info_perso",
    "Documents administratifs": "cat_administratif"
  };
  function importLegacyRhDocuments() {
    if (DB.config.legacyImported) return;
    let rhDb = null;
    try {
      const raw = global.localStorage.getItem(RH_DB_KEY);
      if (raw) rhDb = JSON.parse(raw);
    } catch (e) { /* pas de données RH lisibles, rien à importer */ }
    if (rhDb && Array.isArray(rhDb.documents)) {
      rhDb.documents.forEach((d) => {
        DB.documents.push({
          id: uid("doc_"),
          nom: d.libelle || "Document",
          nomOriginal: d.libelle || "Document",
          extension: extensionOf(d.libelle),
          mimeType: "",
          taille: 0,
          dateCreation: d.dateAjout || todayISO(),
          dateModification: d.dateAjout || todayISO(),
          auteurId: d.agentId,
          categorieId: LEGACY_TYPE_TO_CATEGORY[d.type] || "cat_administratif",
          dossierId: "dos_rh_agents",
          module: "rh",
          entite: { type: "agent", id: d.agentId },
          statut: "ARCHIVE",
          version: 1,
          dateArchivage: d.dateAjout || null,
          dateExpiration: null,
          classification: d.confidentiel ? "confidentiel" : "interne",
          tags: [d.type].filter(Boolean),
          metadonnees: { typeDocumentHistorique: d.type || "" },
          storageKey: null,
          sansFichier: true, // aucun fichier physique n'existait pour ces enregistrements historiques
          corbeille: null,
          historique: [{ action: "Import depuis l'historique RH", acteurId: d.agentId, date: nowStamp(), commentaire: "" }]
        });
      });
    }
    DB.config.legacyImported = true;
  }

  function purgeExpiredTrash() {
    // Pas de tâche planifiée possible dans une app statique : la purge s'exécute donc
    // "à la demande" à chaque chargement, et peut aussi être déclenchée manuellement
    // par un profil habilité (cf. purgerCorbeilleMaintenant côté UI).
    const now = Date.now();
    const before = DB.documents.length;
    const purges = [];
    DB.documents = DB.documents.filter((d) => {
      if (d.corbeille && d.corbeille.expireLe && new Date(d.corbeille.expireLe).getTime() <= now) {
        purges.push(d);
        return false;
      }
      return true;
    });
    purges.forEach((d) => {
      if (d.storageKey) storage.remove(d.storageKey).catch(() => {});
      (DB.versions || []).filter((v) => v.documentId === d.id).forEach((v) => { if (v.storageKey && v.storageKey !== d.storageKey) storage.remove(v.storageKey).catch(() => {}); });
      DB.versions = DB.versions.filter((v) => v.documentId !== d.id);
      logAudit("Suppression définitive automatique (rétention corbeille expirée)", d.id, "system", "OK");
    });
    if (purges.length) persist();
    return before - DB.documents.length;
  }

  function load() {
    try {
      const raw = global.localStorage.getItem(META_KEY);
      DB = raw ? migrate(JSON.parse(raw)) : seed();
    } catch (e) {
      DB = seed();
    }
    importLegacyRhDocuments();
    purgeExpiredTrash();
    persist();
    return DB;
  }

  /* ------------------------------------------------------------------------
   * Session / identité — réutilise exactement le mécanisme déjà en place dans
   * le module RH (aucune authentification réelle, simulation par sélecteur de
   * profil), plutôt que d'en recréer un second.
   * ------------------------------------------------------------------------ */
  function getSession() {
    try {
      const raw = global.localStorage.getItem(RH_SESSION_KEY);
      if (raw) return Object.assign({ role: "rh", asAgentId: null }, JSON.parse(raw));
    } catch (e) { /* session RH absente ou illisible */ }
    return { role: "rh", asAgentId: null };
  }
  function getAgentDirectory() {
    try {
      const raw = global.localStorage.getItem(RH_DB_KEY);
      if (raw) { const rh = JSON.parse(raw); return Array.isArray(rh.agents) ? rh.agents : []; }
    } catch (e) { /* annuaire RH absent ou illisible */ }
    return [];
  }
  function getAgent(agentId) {
    return getAgentDirectory().find((a) => a.id === agentId) || null;
  }

  /* ------------------------------------------------------------------------
   * Droits / habilitations — même esprit que dossierAccess() du module RH :
   * un rôle (rh/agent/responsable/df) + un périmètre (soi-même / son équipe /
   * tout). Centralisé ici pour être appliqué de façon identique par l'UI GED
   * et par toute future intégration d'un autre module.
   * IMPORTANT (rappel) : ceci s'exécute dans le navigateur de l'utilisateur.
   * Ce n'est PAS un contrôle d'accès serveur — cf. en-tête de fichier.
   * ------------------------------------------------------------------------ */
  const ACTIONS = ["lecture", "creation", "modification", "deplacement", "telechargement", "suppression", "restauration", "suppressionDefinitive", "gestionDroits", "gestionCategories", "administration"];

  function scopeOf(doc, session) {
    session = session || getSession();
    if (session.role === "rh") return "rh";
    const isOwner = doc.entite && doc.entite.type === "agent" && doc.entite.id === session.asAgentId;
    if (isOwner) return "self";
    if (session.role === "responsable" && doc.entite && doc.entite.type === "agent") {
      const owner = getAgent(doc.entite.id);
      if (owner && owner.superieurId === session.asAgentId) return "team";
    }
    return "none";
  }
  function can(action, doc, session) {
    session = session || getSession();
    const scope = doc ? scopeOf(doc, session) : (session.role === "rh" ? "rh" : "self");
    if (session.role === "rh") return true; // la RH administre l'ensemble de la GED, comme le reste du module RH
    if (scope === "none") return false;
    const classif = doc ? (DB.classifications.find((c) => c.id === doc.classification) || { niveau: 0 }) : { niveau: 0 };
    switch (action) {
      case "lecture":
      case "telechargement":
        if (scope === "self") return true;
        if (scope === "team") return classif.niveau <= 1; // équipe : public/interne uniquement, comme canViewDocument() côté RH
        return false;
      case "creation":
      case "modification":
      case "deplacement":
      case "suppression":
        // Un agent gère ses propres pièces ; un responsable gère aussi celles de son
        // équipe directe (même règle que canEditDocuments() côté dossier agent RH).
        return scope === "self" || scope === "team";
      case "restauration":
      case "suppressionDefinitive":
      case "gestionDroits":
      case "gestionCategories":
      case "administration":
        return false; // réservé à la RH (administration GED)
      default:
        return false;
    }
  }

  /* ------------------------------------------------------------------------
   * Journal d'audit — toute opération sensible est tracée : utilisateur,
   * action, document, date/heure, résultat. Pas d'adresse IP : une page
   * statique servie par le navigateur de l'utilisateur n'y a pas accès et ne
   * doit pas en inventer une.
   * ------------------------------------------------------------------------ */
  function logAudit(action, documentId, acteurId, resultat) {
    DB.auditLog.push({ id: uid("log_"), action, documentId, acteurId: acteurId || (getSession().asAgentId), date: nowStamp(), resultat: resultat || "OK" });
    if (DB.auditLog.length > 5000) DB.auditLog = DB.auditLog.slice(-5000); // limite raisonnable en localStorage
  }
  function getAuditLog(filters) {
    filters = filters || {};
    return DB.auditLog.filter((l) => {
      if (filters.documentId && l.documentId !== filters.documentId) return false;
      if (filters.acteurId && l.acteurId !== filters.acteurId) return false;
      if (filters.action && l.action !== filters.action) return false;
      return true;
    }).slice().reverse();
  }

  /* ------------------------------------------------------------------------
   * Nommage — proposition automatique configurable (gabarit dans config.nomTemplate),
   * jamais imposée : l'utilisateur peut toujours renommer.
   * ------------------------------------------------------------------------ */
  function suggestName({ type, nomAgent, date, extension }) {
    const tmpl = (DB.config && DB.config.nomTemplate) || "{TYPE}_{NOM}_{DATE}";
    const clean = (s) => sanitizeName(String(s || "").toUpperCase().replace(/\s+/g, "_"));
    const base = tmpl
      .replace("{TYPE}", clean(type || "DOCUMENT"))
      .replace("{NOM}", clean(nomAgent || ""))
      .replace("{DATE}", date || todayISO());
    return base.replace(/_+/g, "_").replace(/^_|_$/g, "") + (extension ? "." + extension : "");
  }

  /* ------------------------------------------------------------------------
   * Recherche — filtres combinables (nom, catégorie, dossier, agent/entité,
   * date, auteur, tags, métadonnées, classification). La recherche "par
   * contenu" n'est pas indexée dans cette première étape (aucun moteur
   * d'indexation disponible côté client) : seul le nom du fichier est
   * cherché, ce qui est signalé comme tel plutôt que simulé.
   * ------------------------------------------------------------------------ */
  function getDocuments(filters) {
    filters = filters || {};
    const session = filters.session || getSession();
    return DB.documents.filter((d) => {
      if (!filters.inclureCorbeille && d.corbeille) return false;
      if (filters.corbeilleUniquement && !d.corbeille) return false;
      if (!can("lecture", d, session)) return false;
      if (filters.nom && !(d.nom || "").toLowerCase().includes(filters.nom.toLowerCase())) return false;
      if (filters.categorieId && d.categorieId !== filters.categorieId) return false;
      if (filters.dossierId && d.dossierId !== filters.dossierId) return false;
      if (filters.espaceId) {
        const folder = DB.folders.find((f) => f.id === d.dossierId);
        if (!folder || folder.espaceId !== filters.espaceId) return false;
      }
      if (filters.module && d.module !== filters.module) return false;
      if (filters.entiteType && (!d.entite || d.entite.type !== filters.entiteType)) return false;
      if (filters.entiteId && (!d.entite || d.entite.id !== filters.entiteId)) return false;
      if (filters.auteurId && d.auteurId !== filters.auteurId) return false;
      if (filters.classification && d.classification !== filters.classification) return false;
      if (filters.statut && d.statut !== filters.statut) return false;
      if (filters.tag && !(d.tags || []).includes(filters.tag)) return false;
      if (filters.dateDebut && (d.dateCreation || "") < filters.dateDebut) return false;
      if (filters.dateFin && (d.dateCreation || "") > filters.dateFin) return false;
      if (filters.metadonnees) {
        for (const k of Object.keys(filters.metadonnees)) {
          if ((d.metadonnees || {})[k] !== filters.metadonnees[k]) return false;
        }
      }
      return true;
    }).sort((a, b) => (b.dateModification || "").localeCompare(a.dateModification || ""));
  }
  function getDocument(id) { return DB.documents.find((d) => d.id === id) || null; }
  function getDocumentsForEntity(module, entiteType, entiteId, filters) {
    return getDocuments(Object.assign({}, filters, { module, entiteType, entiteId }));
  }
  function getVersions(documentId) {
    return DB.versions.filter((v) => v.documentId === documentId).sort((a, b) => b.numero - a.numero);
  }

  /* ------------------------------------------------------------------------
   * Validation de dépôt — contrôle type/taille/nom AVANT tout enregistrement.
   * Mêmes règles appliquées quel que soit l'appelant (UI GED ou module RH).
   * ------------------------------------------------------------------------ */
  function validateFile(file) {
    const errors = [];
    const ext = extensionOf(file.name);
    if (!ext) errors.push("Le fichier doit avoir une extension.");
    if (DB.config.extensionsInterdites.includes(ext)) errors.push(`Extension ".${ext}" non autorisée pour des raisons de sécurité.`);
    const maxBytes = (DB.config.tailleMaxMo || 25) * 1024 * 1024;
    if (file.size > maxBytes) errors.push(`Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} Mo, maximum ${DB.config.tailleMaxMo} Mo).`);
    if (file.size === 0) errors.push("Le fichier est vide.");
    return { valide: errors.length === 0, erreurs: errors };
  }
  function findDuplicate(nom, dossierId, taille) {
    return DB.documents.find((d) => !d.corbeille && d.dossierId === dossierId && d.nom === nom && d.taille === taille) || null;
  }

  /* ------------------------------------------------------------------------
   * CRUD documents / versions / corbeille — équivalent fonctionnel des
   * endpoints décrits dans le cahier des charges (POST /documents,
   * POST /documents/:id/versions, POST /documents/:id/restore, ...),
   * exposés ici comme des fonctions JS puisqu'aucun serveur ne peut recevoir
   * de vraies requêtes HTTP dans une page statique.
   * ------------------------------------------------------------------------ */
  async function createDocument({ file, nom, categorieId, dossierId, module, entite, classification, tags, metadonnees, statut }, session) {
    session = session || getSession();
    if (!can("creation", { entite, classification: classification || "interne" }, session)) {
      logAudit("Création refusée (droits insuffisants)", null, session.asAgentId, "REFUS");
      throw new Error("Vous n'avez pas le droit de déposer un document ici.");
    }
    const check = validateFile(file);
    if (!check.valide) throw new Error(check.erreurs.join(" "));
    const finalName = sanitizeName(nom || file.name);
    const dup = findDuplicate(finalName, dossierId, file.size);
    if (dup) throw new Error(`Un document identique existe déjà dans ce dossier : « ${dup.nom} ».`);
    const storageKey = await storage.save(file);
    const doc = {
      id: uid("doc_"),
      nom: finalName,
      nomOriginal: file.name,
      extension: extensionOf(file.name),
      mimeType: file.type || "",
      taille: file.size,
      dateCreation: todayISO(),
      dateModification: todayISO(),
      auteurId: session.asAgentId,
      categorieId: categorieId || null,
      dossierId: dossierId || null,
      module: module || "ged",
      entite: entite || null,
      statut: statut || "BROUILLON",
      version: 1,
      dateArchivage: null,
      dateExpiration: null,
      classification: classification || "interne",
      tags: tags || [],
      metadonnees: metadonnees || {},
      storageKey,
      sansFichier: false,
      corbeille: null,
      historique: [{ action: "Création", acteurId: session.asAgentId, date: nowStamp(), commentaire: "" }]
    };
    DB.documents.push(doc);
    DB.versions.push({ id: uid("ver_"), documentId: doc.id, numero: 1, storageKey, taille: file.size, auteurId: session.asAgentId, date: nowStamp(), commentaire: "Version initiale" });
    persist();
    logAudit("Création", doc.id, session.asAgentId, "OK");
    return doc;
  }

  function updateDocument(id, patch, session) {
    session = session || getSession();
    const doc = getDocument(id);
    if (!doc) throw new Error("Document introuvable.");
    const isMove = patch.dossierId !== undefined && patch.dossierId !== doc.dossierId;
    const action = isMove ? "deplacement" : "modification";
    if (!can(action, doc, session)) {
      logAudit(`${isMove ? "Déplacement" : "Modification"} refusé(e) (droits insuffisants)`, id, session.asAgentId, "REFUS");
      throw new Error("Vous n'avez pas le droit de modifier ce document.");
    }
    const before = { nom: doc.nom, dossierId: doc.dossierId, classification: doc.classification };
    Object.assign(doc, patch);
    doc.nom = sanitizeName(doc.nom);
    doc.dateModification = todayISO();
    const changes = [];
    if (patch.nom && patch.nom !== before.nom) changes.push(`renommé « ${before.nom} » → « ${doc.nom} »`);
    if (isMove) changes.push("déplacé");
    if (patch.classification && patch.classification !== before.classification) changes.push(`classification → ${patch.classification}`);
    doc.historique.push({ action: changes.join(", ") || "Modification", acteurId: session.asAgentId, date: nowStamp(), commentaire: "" });
    persist();
    logAudit(changes.join(", ") || "Modification", id, session.asAgentId, "OK");
    return doc;
  }

  async function addVersion(id, file, commentaire, session) {
    session = session || getSession();
    const doc = getDocument(id);
    if (!doc) throw new Error("Document introuvable.");
    if (!can("modification", doc, session) && !can("creation", doc, session)) {
      logAudit("Nouvelle version refusée (droits insuffisants)", id, session.asAgentId, "REFUS");
      throw new Error("Vous n'avez pas le droit d'ajouter une version à ce document.");
    }
    const check = validateFile(file);
    if (!check.valide) throw new Error(check.erreurs.join(" "));
    const storageKey = await storage.save(file);
    const numero = doc.version + 1;
    DB.versions.push({ id: uid("ver_"), documentId: doc.id, numero, storageKey, taille: file.size, auteurId: session.asAgentId, date: nowStamp(), commentaire: commentaire || "" });
    doc.storageKey = storageKey;
    doc.taille = file.size;
    doc.mimeType = file.type || doc.mimeType;
    doc.version = numero;
    doc.dateModification = todayISO();
    doc.sansFichier = false;
    doc.historique.push({ action: `Nouvelle version (v${numero})`, acteurId: session.asAgentId, date: nowStamp(), commentaire: commentaire || "" });
    persist();
    logAudit(`Nouvelle version v${numero}`, id, session.asAgentId, "OK");
    return doc;
  }

  function restoreVersion(id, numero, session) {
    session = session || getSession();
    const doc = getDocument(id);
    if (!doc) throw new Error("Document introuvable.");
    if (!can("modification", doc, session)) throw new Error("Vous n'avez pas le droit de restaurer une version de ce document.");
    const version = DB.versions.find((v) => v.documentId === id && v.numero === numero);
    if (!version) throw new Error("Version introuvable.");
    // La restauration crée une NOUVELLE version reprenant l'ancien fichier : aucune
    // version existante n'est jamais écrasée ni perdue.
    const nextNumero = doc.version + 1;
    DB.versions.push({ id: uid("ver_"), documentId: id, numero: nextNumero, storageKey: version.storageKey, taille: version.taille, auteurId: session.asAgentId, date: nowStamp(), commentaire: `Restauration de la version ${numero}` });
    doc.storageKey = version.storageKey;
    doc.taille = version.taille;
    doc.version = nextNumero;
    doc.dateModification = todayISO();
    doc.historique.push({ action: `Restauration de la version ${numero} (nouvelle version v${nextNumero})`, acteurId: session.asAgentId, date: nowStamp(), commentaire: "" });
    persist();
    logAudit(`Restauration version ${numero}`, id, session.asAgentId, "OK");
    return doc;
  }

  function deleteDocument(id, session) {
    session = session || getSession();
    const doc = getDocument(id);
    if (!doc) throw new Error("Document introuvable.");
    if (!can("suppression", doc, session)) {
      logAudit("Suppression refusée (droits insuffisants)", id, session.asAgentId, "REFUS");
      throw new Error("Vous n'avez pas le droit de supprimer ce document.");
    }
    const retention = DB.config.retentionCorbeilleJours || 30;
    const expire = new Date(Date.now() + retention * 86400000).toISOString().slice(0, 10);
    doc.corbeille = { supprimeLe: todayISO(), supprimePar: session.asAgentId, expireLe: expire };
    doc.historique.push({ action: "Mise à la corbeille", acteurId: session.asAgentId, date: nowStamp(), commentaire: "" });
    persist();
    logAudit("Suppression (corbeille)", id, session.asAgentId, "OK");
    return doc;
  }
  function restoreDocument(id, session) {
    session = session || getSession();
    const doc = getDocument(id);
    if (!doc) throw new Error("Document introuvable.");
    if (!can("restauration", doc, session)) {
      logAudit("Restauration refusée (droits insuffisants)", id, session.asAgentId, "REFUS");
      throw new Error("Vous n'avez pas le droit de restaurer ce document.");
    }
    doc.corbeille = null;
    doc.historique.push({ action: "Restauration depuis la corbeille", acteurId: session.asAgentId, date: nowStamp(), commentaire: "" });
    persist();
    logAudit("Restauration", id, session.asAgentId, "OK");
    return doc;
  }
  async function purgeDocument(id, session) {
    session = session || getSession();
    const doc = getDocument(id);
    if (!doc) throw new Error("Document introuvable.");
    if (!doc.corbeille) throw new Error("Seul un document déjà à la corbeille peut être supprimé définitivement.");
    if (!can("suppressionDefinitive", doc, session)) {
      logAudit("Suppression définitive refusée (droits insuffisants)", id, session.asAgentId, "REFUS");
      throw new Error("Vous n'avez pas le droit de supprimer définitivement ce document.");
    }
    if (doc.storageKey) await storage.remove(doc.storageKey).catch(() => {});
    for (const v of getVersions(id)) { if (v.storageKey && v.storageKey !== doc.storageKey) await storage.remove(v.storageKey).catch(() => {}); }
    DB.versions = DB.versions.filter((v) => v.documentId !== id);
    DB.documents = DB.documents.filter((d) => d.id !== id);
    persist();
    logAudit("Suppression définitive", id, session.asAgentId, "OK");
  }
  function purgerCorbeilleMaintenant() {
    const n = purgeExpiredTrash();
    return n;
  }

  async function downloadDocument(id, session) {
    session = session || getSession();
    const doc = getDocument(id);
    if (!doc) throw new Error("Document introuvable.");
    if (!can("telechargement", doc, session)) {
      logAudit("Téléchargement refusé (droits insuffisants)", id, session.asAgentId, "REFUS");
      throw new Error("Vous n'avez pas le droit de télécharger ce document.");
    }
    if (doc.sansFichier || !doc.storageKey) throw new Error("Aucun fichier numérisé n'est associé à cet enregistrement historique.");
    const blob = await storage.load(doc.storageKey);
    if (!blob) throw new Error("Fichier introuvable dans le stockage local.");
    logAudit("Téléchargement", id, session.asAgentId, "OK");
    return blob;
  }
  // Aperçu : ne fonctionne que pour les types que le navigateur sait afficher nativement
  // (images, PDF, texte) — un vrai visualiseur pour d'autres formats sortirait du
  // périmètre "fondations" de cette étape.
  const PREVIEWABLE_MIME = /^image\/|^application\/pdf$|^text\//;
  function isPreviewable(doc) {
    return !!doc.mimeType && PREVIEWABLE_MIME.test(doc.mimeType);
  }
  async function getPreviewBlob(id, session) {
    const doc = getDocument(id);
    if (!doc || !isPreviewable(doc)) return null;
    session = session || getSession();
    if (!can("lecture", doc, session)) return null;
    if (doc.sansFichier || !doc.storageKey) return null;
    const blob = await storage.load(doc.storageKey);
    if (blob) logAudit("Consultation (aperçu)", id, session.asAgentId, "OK");
    return blob;
  }

  /* ------------------------------------------------------------------------
   * Espaces / dossiers — arborescence configurable (pas de catégories figées).
   * ------------------------------------------------------------------------ */
  function getSpaces() { return DB.spaces.slice(); }
  function getFolders(espaceId) { return DB.folders.filter((f) => !espaceId || f.espaceId === espaceId); }
  function getFolder(id) { return DB.folders.find((f) => f.id === id) || null; }
  function createFolder(espaceId, parentId, nom, session) {
    session = session || getSession();
    if (session.role !== "rh") throw new Error("Seule la RH (administration GED) peut créer un dossier pour l'instant.");
    const folder = { id: uid("dos_"), espaceId, parentId: parentId || null, nom: sanitizeName(nom) };
    DB.folders.push(folder);
    persist();
    logAudit(`Création du dossier « ${folder.nom} »`, null, session.asAgentId, "OK");
    return folder;
  }
  function getOrCreateAgentFolder(agentId) {
    // Chaque agent dispose d'un sous-dossier dédié sous RH/Agents, créé à la volée
    // (pas de pré-création en masse : conforme à "ne pas coder en dur l'arborescence").
    const id = "dos_agent_" + agentId;
    let f = getFolder(id);
    if (!f) {
      f = { id, espaceId: "esp_rh", parentId: "dos_rh_agents", nom: agentId };
      DB.folders.push(f);
      persist();
    }
    return f;
  }

  function getCategories() { return DB.categories.slice(); }
  function getCategory(id) { return DB.categories.find((c) => c.id === id) || null; }
  function getClassifications() { return DB.classifications.slice(); }
  function getTags() { return DB.tags.slice(); }
  function getConfig() { return Object.assign({}, DB.config); }

  function formatSize(bytes) {
    if (!bytes) return "0 o";
    const units = ["o", "Ko", "Mo", "Go"];
    let i = 0, v = bytes;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
    return v.toFixed(v >= 10 || i === 0 ? 0 : 1) + " " + units[i];
  }

  global.GED = {
    // cycle de vie
    load, save: persist,
    // identité / droits
    getSession, getAgentDirectory, getAgent, can, scopeOf, ACTIONS,
    // référentiels
    getSpaces, getFolders, getFolder, createFolder, getOrCreateAgentFolder,
    getCategories, getCategory, getClassifications, getTags, getConfig,
    // documents
    createDocument, updateDocument, addVersion, restoreVersion, getVersions,
    deleteDocument, restoreDocument, purgeDocument, purgerCorbeilleMaintenant,
    downloadDocument, getPreviewBlob, isPreviewable,
    getDocuments, getDocument, getDocumentsForEntity,
    validateFile, findDuplicate, suggestName, formatSize, sanitizeName, extensionOf,
    // audit
    logAudit, getAuditLog,
    // avancé / tests
    _storage: storage, StorageProvider, IndexedDBStorageProvider
  };
})(typeof window !== "undefined" ? window : globalThis);
