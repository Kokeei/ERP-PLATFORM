// ============================================================================
// GED — widgets d'interface réutilisables (dépôt de fichiers, panneau détail
// document, arborescence). Utilisé à la fois par le module GED autonome
// (ged/index.html) et par l'onglet "Documents" du dossier agent RH.
//
// Convention : s'appuie sur un conteneur `#modalRoot` présent dans la page hôte
// et sur des classes CSS déjà standard dans l'ERP (.overlay/.modal/.btn/.badge/
// .panel...) — reprises telles quelles côté RH, redéfinies dans ged/ged.css
// pour le module GED autonome. Ne dépend d'aucun global propre à rh/index.html.
// ============================================================================
(function (global) {
  "use strict";
  const G = global.GED;
  if (!G) { console.error("ged-ui.js requiert ged-core.js (window.GED) chargé au préalable."); return; }

  const ICONS = {
    file: '<path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
    pdf: '<path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5"/><path d="M8 13h1.5a1.5 1.5 0 0 0 0-3H8v6M13 10v6h1.5a2 2 0 0 0 0-6zM19 10h-2v6"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    upload: '<path d="M12 3v12m0-12 5 5m-5-5-5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
    download: '<path d="M12 3v12m0 0 5-5m-5 5-5-5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/>',
    restore: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v5h5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    eye: '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>'
  };
  function svg(name, cls) { return `<svg class="${cls || "ic"}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ICONS.file}</svg>`; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function iconForDoc(doc) {
    if ((doc.mimeType || "").startsWith("image/")) return "image";
    if (doc.mimeType === "application/pdf" || doc.extension === "pdf") return "pdf";
    return "file";
  }
  function fmtDate(iso) { if (!iso) return "—"; const [y, m, d] = iso.split("-"); return d && m && y ? `${d}/${m}/${y}` : iso; }
  function agentLabel(agentId) { const a = G.getAgent(agentId); return a ? `${a.prenom} ${a.nom}` : (agentId || "—"); }
  function badge(text, tone) { return `<span class="badge ${tone || ""}">${esc(text)}</span>`; }
  function classifTone(classifId) {
    if (classifId === "tres_confidentiel") return "bad";
    if (classifId === "confidentiel") return "warn";
    return "ok";
  }
  function statutTone(s) {
    if (s === "REFUSE") return "bad";
    if (s === "SIGNE" || s === "ARCHIVE") return "ok";
    if (s === "A_VALIDER" || s === "A_SIGNER") return "warn";
    return "";
  }

  function toast(msg) {
    let host = document.getElementById("gedToastHost");
    if (!host) { host = document.createElement("div"); host.id = "gedToastHost"; host.style.cssText = "position:fixed;bottom:18px;right:18px;z-index:200;display:flex;flex-direction:column;gap:8px"; document.body.appendChild(host); }
    const el = document.createElement("div");
    el.className = "ged-toast";
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  function closeModal() { const mr = document.getElementById("modalRoot"); if (mr) mr.innerHTML = ""; }

  /* ------------------------------------------------------------------------
   * Modale de dépôt : sélection / glisser-déposer, multi-fichiers, contrôle
   * type/taille avant envoi, détection de doublon, retour d'erreurs clair.
   * ------------------------------------------------------------------------ */
  function openUploadModal({ dossierId, module, entite, classification, categorieId, categoriesFiltre, tags, metadonnees, onUploaded, titre }) {
    const mr = document.getElementById("modalRoot");
    if (!mr) { console.error("Aucun #modalRoot dans la page hôte."); return; }
    const categories = categoriesFiltre ? G.getCategories().filter((c) => categoriesFiltre.includes(c.id)) : G.getCategories();
    const classifications = G.getClassifications();
    mr.innerHTML = `<div class="overlay" id="gedOverlay"><div class="modal" role="dialog" aria-modal="true">
      <div class="modal-head"><h3>${esc(titre || "Déposer un document")}</h3><div class="spacer"></div><button class="close-x" id="gedCloseUpload">${svg("x")}</button></div>
      <div class="modal-body">
        <div class="ged-dropzone" id="gedDropzone" tabindex="0">
          ${svg("upload", "ic ged-dropzone-ic")}
          <div>Glissez-déposez un ou plusieurs fichiers ici, ou</div>
          <button class="btn" id="gedPickFile" type="button">Parcourir…</button>
          <input type="file" id="gedFileInput" multiple hidden>
          <div class="hint">Taille max ${G.getConfig().tailleMaxMo} Mo par fichier. Extensions exécutables refusées.</div>
        </div>
        <div class="ged-field">
          <label>Catégorie</label>
          <select id="gedCatSelect">${categories.map((c) => `<option value="${c.id}" ${c.id === categorieId ? "selected" : ""}>${esc(c.nom)}</option>`).join("")}</select>
        </div>
        <div class="ged-field">
          <label>Classification</label>
          <select id="gedClassifSelect">${classifications.map((c) => `<option value="${c.id}" ${c.id === classification ? "selected" : ""}>${esc(c.nom)}</option>`).join("")}</select>
        </div>
        <div id="gedUploadList" class="ged-upload-list"></div>
        <div id="gedUploadErrors" class="ged-errors"></div>
      </div>
      <div class="modal-foot"><button class="btn" id="gedCancelUpload">Fermer</button></div>
    </div></div>`;
    const close = closeModal;
    document.getElementById("gedCloseUpload").onclick = close;
    document.getElementById("gedCancelUpload").onclick = close;
    document.getElementById("gedOverlay").onclick = (e) => { if (e.target.id === "gedOverlay") close(); };
    const dz = document.getElementById("gedDropzone");
    const input = document.getElementById("gedFileInput");
    document.getElementById("gedPickFile").onclick = () => input.click();
    dz.onclick = (e) => { if (e.target === dz) input.click(); };
    ["dragenter", "dragover"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("drag"); }));
    ["dragleave", "drop"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("drag"); }));
    dz.addEventListener("drop", (e) => handleFiles(e.dataTransfer.files));
    input.onchange = () => handleFiles(input.files);

    async function handleFiles(fileList) {
      const files = Array.from(fileList || []);
      const errBox = document.getElementById("gedUploadErrors");
      const listBox = document.getElementById("gedUploadList");
      errBox.innerHTML = "";
      for (const file of files) {
        const row = document.createElement("div");
        row.className = "ged-upload-row";
        row.innerHTML = `<span>${svg("file", "ic")}</span><span class="ged-upload-name">${esc(file.name)}</span><span class="ged-upload-status">En cours…</span>`;
        listBox.appendChild(row);
        try {
          const doc = await G.createDocument({
            file, nom: file.name, dossierId,
            categorieId: document.getElementById("gedCatSelect").value,
            classification: document.getElementById("gedClassifSelect").value,
            module, entite, tags: tags || [], metadonnees: metadonnees || {}
          });
          row.querySelector(".ged-upload-status").innerHTML = `<span class="ok-txt">${svg("check", "ic")} Déposé</span>`;
          toast(`« ${doc.nom} » déposé`);
          if (onUploaded) onUploaded(doc);
        } catch (e) {
          row.querySelector(".ged-upload-status").innerHTML = `<span class="bad-txt">Échec</span>`;
          const p = document.createElement("div");
          p.className = "hint bad-txt";
          p.textContent = `${file.name} : ${e.message}`;
          errBox.appendChild(p);
        }
      }
    }
  }

  /* ------------------------------------------------------------------------
   * Panneau détail document (modale) : métadonnées, tags, classification,
   * versions, historique, actions selon droits.
   * ------------------------------------------------------------------------ */
  function openDocumentDetail(docId, { onChange } = {}) {
    const mr = document.getElementById("modalRoot");
    if (!mr) return;
    const doc = G.getDocument(docId);
    if (!doc) { toast("Document introuvable."); return; }
    const session = G.getSession();
    const cat = G.getCategory(doc.categorieId);
    const classif = G.getClassifications().find((c) => c.id === doc.classification);
    const versions = G.getVersions(doc.id);
    const inTrash = !!doc.corbeille;

    const actions = [];
    if (!inTrash && !doc.sansFichier && G.can("telechargement", doc, session)) actions.push(`<button class="btn" id="gedDlBtn">${svg("download", "ic")} Télécharger</button>`);
    if (!inTrash && G.can("modification", doc, session)) actions.push(`<button class="btn" id="gedRenameBtn">${svg("edit", "ic")} Renommer</button>`);
    if (!inTrash && G.can("modification", doc, session)) actions.push(`<button class="btn" id="gedVersionBtn">${svg("upload", "ic")} Nouvelle version</button>`);
    if (!inTrash && G.can("suppression", doc, session)) actions.push(`<button class="btn" id="gedDelBtn">${svg("trash", "ic")} Supprimer</button>`);
    if (inTrash && G.can("restauration", doc, session)) actions.push(`<button class="btn primary" id="gedRestoreBtn">${svg("restore", "ic")} Restaurer</button>`);
    if (inTrash && G.can("suppressionDefinitive", doc, session)) actions.push(`<button class="btn" id="gedPurgeBtn">${svg("x", "ic")} Supprimer définitivement</button>`);

    const previewBox = G.isPreviewable(doc) ? `<div class="ged-preview" id="gedPreview"><span class="hint">Chargement de l'aperçu…</span></div>` : "";

    mr.innerHTML = `<div class="overlay" id="gedOverlay"><div class="modal" role="dialog" aria-modal="true" style="max-width:760px">
      <div class="modal-head">${svg(iconForDoc(doc))}<h3>${esc(doc.nom)}</h3><div class="spacer"></div><button class="close-x" id="gedCloseDetail">${svg("x")}</button></div>
      <div class="modal-body">
        ${inTrash ? `<div class="ged-trash-banner">À la corbeille depuis le ${fmtDate(doc.corbeille.supprimeLe)} · suppression définitive prévue le ${fmtDate(doc.corbeille.expireLe)}</div>` : ""}
        ${previewBox}
        <div class="info-list">
          <div class="row"><span class="l">Taille</span><span class="v">${doc.sansFichier ? "—" : G.formatSize(doc.taille)}</span></div>
          <div class="row"><span class="l">Catégorie</span><span class="v">${esc(cat ? cat.nom : "—")}</span></div>
          <div class="row"><span class="l">Classification</span><span class="v">${badge(classif ? classif.nom : "—", classifTone(doc.classification))}</span></div>
          <div class="row"><span class="l">Statut</span><span class="v">${badge(doc.statut, statutTone(doc.statut))}</span></div>
          <div class="row"><span class="l">Version</span><span class="v">v${doc.version}</span></div>
          <div class="row"><span class="l">Propriétaire</span><span class="v">${esc(agentLabel(doc.auteurId))}</span></div>
          <div class="row"><span class="l">Créé le</span><span class="v">${fmtDate(doc.dateCreation)}</span></div>
          <div class="row"><span class="l">Modifié le</span><span class="v">${fmtDate(doc.dateModification)}</span></div>
          <div class="row"><span class="l">Tags</span><span class="v">${(doc.tags || []).map((t) => badge(t)).join(" ") || "—"}</span></div>
        </div>
        ${doc.sansFichier ? `<p class="hint">Enregistrement historique migré depuis l'ancien classement — aucun fichier numérisé n'y est associé.</p>` : ""}
        <div class="ged-versions">
          <h4>Versions (${versions.length})</h4>
          ${versions.map((v) => `<div class="ged-version-row"><span>v${v.numero}</span><span>${fmtDate(v.date.split(" ")[0]?.split("/").reverse().join("-") || "")}</span><span>${esc(agentLabel(v.auteurId))}</span><span>${G.formatSize(v.taille)}</span>${v.commentaire ? `<span class="hint">${esc(v.commentaire)}</span>` : ""}${v.numero !== doc.version && !inTrash && G.can("modification", doc, session) ? `<button class="btn ghost sm" data-restore-version="${v.numero}">Restaurer</button>` : ""}</div>`).join("")}
        </div>
        <div class="ged-history">
          <h4>Historique</h4>
          ${(doc.historique || []).slice().reverse().map((h) => `<div class="wf-item"><div class="wf-dot"></div><div class="wf-body"><div class="wf-top"><strong>${esc(h.action)}</strong><span class="wf-date">${esc(h.date)}</span></div><div class="wf-actor">${esc(agentLabel(h.acteurId))}</div></div></div>`).join("")}
        </div>
      </div>
      <div class="modal-foot">${actions.join(" ")}<button class="btn" id="gedCancelDetail" style="margin-left:auto">Fermer</button></div>
    </div></div>`;

    const close = () => { closeModal(); };
    document.getElementById("gedCloseDetail").onclick = close;
    document.getElementById("gedCancelDetail").onclick = close;
    document.getElementById("gedOverlay").onclick = (e) => { if (e.target.id === "gedOverlay") close(); };

    if (G.isPreviewable(doc)) {
      G.getPreviewBlob(doc.id).then((blob) => {
        const box = document.getElementById("gedPreview");
        if (!box) return;
        if (!blob) { box.innerHTML = `<span class="hint">Aperçu indisponible.</span>`; return; }
        const url = URL.createObjectURL(blob);
        if ((doc.mimeType || "").startsWith("image/")) box.innerHTML = `<img src="${url}" alt="${esc(doc.nom)}">`;
        else if (doc.mimeType === "application/pdf") box.innerHTML = `<iframe src="${url}" title="${esc(doc.nom)}"></iframe>`;
        else blob.text().then((t) => { box.innerHTML = `<pre>${esc(t.slice(0, 4000))}</pre>`; });
      });
    }

    const dl = document.getElementById("gedDlBtn");
    if (dl) dl.onclick = async () => {
      try {
        const blob = await G.downloadDocument(doc.id);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = doc.nom; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      } catch (e) { toast(e.message); }
    };
    const renameBtn = document.getElementById("gedRenameBtn");
    if (renameBtn) renameBtn.onclick = () => {
      const nom = prompt("Nouveau nom du document :", doc.nom);
      if (!nom || nom === doc.nom) return;
      try { G.updateDocument(doc.id, { nom }); toast("Document renommé"); openDocumentDetail(doc.id, { onChange }); if (onChange) onChange(); }
      catch (e) { toast(e.message); }
    };
    const verBtn = document.getElementById("gedVersionBtn");
    if (verBtn) verBtn.onclick = () => {
      const input = document.createElement("input");
      input.type = "file"; input.onchange = async () => {
        if (!input.files[0]) return;
        const commentaire = prompt("Commentaire sur cette nouvelle version (optionnel) :", "") || "";
        try { await G.addVersion(doc.id, input.files[0], commentaire); toast("Nouvelle version ajoutée"); openDocumentDetail(doc.id, { onChange }); if (onChange) onChange(); }
        catch (e) { toast(e.message); }
      };
      input.click();
    };
    const delBtn = document.getElementById("gedDelBtn");
    if (delBtn) delBtn.onclick = () => { try { G.deleteDocument(doc.id); toast("Document envoyé à la corbeille"); close(); if (onChange) onChange(); } catch (e) { toast(e.message); } };
    const restoreBtn = document.getElementById("gedRestoreBtn");
    if (restoreBtn) restoreBtn.onclick = () => { try { G.restoreDocument(doc.id); toast("Document restauré"); close(); if (onChange) onChange(); } catch (e) { toast(e.message); } };
    const purgeBtn = document.getElementById("gedPurgeBtn");
    if (purgeBtn) purgeBtn.onclick = async () => {
      if (!confirm("Supprimer définitivement ce document ? Cette action est irréversible.")) return;
      try { await G.purgeDocument(doc.id); toast("Document supprimé définitivement"); close(); if (onChange) onChange(); } catch (e) { toast(e.message); }
    };
    mr.querySelectorAll("[data-restore-version]").forEach((btn) => {
      btn.onclick = () => { try { G.restoreVersion(doc.id, Number(btn.dataset.restoreVersion)); toast("Version restaurée"); openDocumentDetail(doc.id, { onChange }); if (onChange) onChange(); } catch (e) { toast(e.message); } };
    });
  }

  global.GEDUI = { svg, esc, iconForDoc, fmtDate, agentLabel, badge, classifTone, statutTone, toast, closeModal, openUploadModal, openDocumentDetail };
})(typeof window !== "undefined" ? window : globalThis);
