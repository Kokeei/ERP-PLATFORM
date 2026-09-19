# Recette fonctionnelle — Module GED (fondations)

Checklist de recette du module GED tel que livré dans cette première étape
("Fondations d'abord"). Chaque ligne indique le scénario, le résultat attendu,
le résultat obtenu et le statut. Les lignes marquées **[E2E]** sont couvertes
par un test automatisé Playwright (`tests/ged.spec.js`, `npm test`) ; les
autres ont été vérifiées manuellement pendant le développement.

| # | Fonctionnalité | Scénario | Résultat attendu | Résultat obtenu | Statut |
|---|---|---|---|---|---|
| 1 | Accès | Ouvrir le portail (`index.html`) et cliquer sur la carte « GED » | La GED s'ouvre sur `/ged/`, module marqué « Disponible » | Conforme — **[E2E]** `ged.spec.js` › *accès et navigation* | OK |
| 2 | Navigation | Ouvrir `/ged/` directement | Page « Parcourir » par défaut, arborescence des espaces visible (RH, Marchés, Finance, Juridique, Administration) | Conforme — **[E2E]** | OK |
| 3 | Création de dossier | En profil RH, cliquer sur « + » à côté d'un espace, saisir un nom | Le dossier apparaît dans l'arborescence de cet espace | Conforme — **[E2E]** `création de dossier` | OK |
| 3bis | Droits sur la création de dossier | En profil Agent, ouvrir `/ged/` | Aucun bouton de création de dossier visible | Conforme — **[E2E]** | OK |
| 4 | Dépôt (cas nominal) | Sélectionner un dossier, « Déposer un document », choisir un fichier valide | Le document apparaît dans la liste avec catégorie/taille/date | Conforme — **[E2E]** `dépôt, consultation et téléchargement` | OK |
| 5 | Dépôt — contrôle de type | Déposer un fichier `.exe` | Rejet avec message d'erreur explicite, aucun document créé | Conforme — **[E2E]** `refuse un fichier avec une extension dangereuse` | OK |
| 6 | Dépôt — contrôle de taille | Déposer un fichier de plus de 25 Mo (config par défaut) | Rejet avec message indiquant la taille maximale | Vérifié par lecture de code (`GED.validateFile`) ; pas de fixture >25 Mo dans le dépôt de test pour rester léger | OK (revue de code) |
| 7 | Dépôt — doublon | Déposer deux fois le même fichier (nom + taille identiques) dans le même dossier | Le second dépôt est refusé avec un message explicite | Vérifié manuellement (`GED.findDuplicate`) | OK |
| 8 | Dépôt multiple | Sélectionner plusieurs fichiers en une fois | Chaque fichier obtient sa propre ligne de progression et son propre résultat (déposé/échec) | Conforme (zone de dépôt accepte `multiple`) — vérifié manuellement | OK |
| 9 | Consultation | Cliquer sur un document dans la liste | Panneau de détail : métadonnées, classification, statut, version, historique | Conforme — **[E2E]** | OK |
| 10 | Prévisualisation | Ouvrir un document image ou PDF | Aperçu affiché dans la modale de détail | Vérifié manuellement pour PDF/texte ; pas de fixture image dans les tests automatisés | OK (manuel) |
| 11 | Téléchargement | Cliquer sur « Télécharger » | Le fichier est téléchargé avec son nom d'origine | Conforme — **[E2E]** | OK |
| 12 | Renommage | Cliquer sur « Renommer », saisir un nouveau nom | Le document est renommé, tracé dans l'historique | Vérifié manuellement | OK |
| 13 | Versionning | Ajouter une nouvelle version à un document existant | Le numéro de version augmente, l'ancienne version reste consultable et restaurable | Conforme — **[E2E]** `versioning` | OK |
| 14 | Restauration de version | Restaurer une version antérieure | Une nouvelle version est créée à partir de l'ancienne (rien n'est écrasé) | Vérifié manuellement (`GED.restoreVersion`) | OK |
| 15 | Corbeille | Supprimer un document | Il disparaît de la liste et apparaît dans « Corbeille » avec date de suppression et échéance | Conforme — **[E2E]** `corbeille et restauration` | OK |
| 16 | Restauration depuis la corbeille | Restaurer un document depuis la corbeille | Il réapparaît dans son dossier d'origine | Conforme — **[E2E]** | OK |
| 17 | Suppression définitive | Purger un document de la corbeille | Suppression irréversible du fichier et des métadonnées, action journalisée | Vérifié manuellement (`GED.purgeDocument`) ; confirmation requise avant l'action | OK |
| 18 | Rétention configurable | Vérifier `GED.getConfig().retentionCorbeilleJours` | Valeur par défaut 30 jours, purge automatique des éléments expirés au chargement | Vérifié par lecture de code (`purgeExpiredTrash`) — pas de test datant artificiellement le système pour ce cas | OK (revue de code) |
| 19 | Recherche | Saisir un terme dans la barre de recherche | La liste se filtre sur le nom du document | Vérifié manuellement ; recherche par contenu non implémentée (aucune indexation disponible côté client — annoncé comme tel, jamais simulé) | OK (périmètre réduit assumé) |
| 20 | Filtres combinables | Combiner un filtre catégorie + un filtre classification | Seuls les documents correspondant aux deux critères s'affichent | Vérifié manuellement (`GED.getDocuments` applique tous les filtres fournis) | OK |
| 21 | Tags et métadonnées | Créer un document, consulter ses tags dans le détail | Les tags s'affichent ; les catégories portent des champs de métadonnées configurables (ex. Formation → organisme/durée/certificat) | Modèle de données en place (`GED.getCategories()[].champs`) ; pas encore d'écran de saisie dédié dans la modale de dépôt | Partiel — voir « points restants » |
| 22 | Classification | Déposer un document avec classification « Confidentiel » | Un agent hors périmètre ne le voit pas ; son responsable ne le voit pas non plus (niveau > interne) | Conforme (`GED.can` applique le niveau de classification pour le scope « équipe ») — vérifié manuellement | OK |
| 23 | Droits — RH | Profil RH | Accès complet à tous les documents, dossiers, corbeille, audit | Conforme — **[E2E]** | OK |
| 24 | Droits — Agent | Profil Agent | Peut déposer/consulter/télécharger ses propres documents ; pas de création de dossier, pas d'audit | Conforme — **[E2E]** | OK |
| 25 | Droits — Responsable | Profil Responsable sur un document de son équipe directe | Lecture/dépôt/suppression possibles si classification ≤ interne ; pas de restauration ni de suppression définitive | Vérifié manuellement (`GED.can`, scope `team`) | OK |
| 26 | Sécurité — accès direct par identifiant | Appeler `GED.getDocument(id)` puis tenter une action sans détenir les droits | L'action est refusée par `GED.can()` et journalisée comme refus | Conforme (chaque fonction de mutation vérifie les droits, indépendamment de l'UI) — **rappel : simulation côté navigateur, pas un contrôle serveur (cf. § Sécurité du rapport)** | OK (dans les limites de l'architecture statique) |
| 27 | Audit | Effectuer un dépôt, une suppression, un refus de droit | Chaque opération apparaît dans le Journal d'audit (RH uniquement) avec utilisateur/action/date/résultat | Conforme — **[E2E]** `la RH voit le journal d'audit alimenté après un dépôt` | OK |
| 28 | Intégration RH | Ouvrir l'onglet « Documents » d'un dossier agent | Les documents historiques (migrés) et les nouveaux dépôts s'affichent, classés par catégorie comme avant | Conforme — **[E2E]** `intégration avec le dossier agent RH` | OK |
| 29 | Non-régression RH | Relancer toute la suite Playwright existante (agents, congés, paie, formations, maternité) | Aucun test cassé par l'introduction de la GED | 45/45 tests passés (32 existants + 13 GED) | OK |
| 30 | Responsive | Réduire la largeur de la fenêtre sous 820px | La barre latérale se replie en menu masqué, la mise en page reste utilisable | Classes CSS reprises à l'identique de `rh/index.html` (mêmes points de rupture) ; vérifié visuellement, non couvert par un test automatisé | OK (manuel) |
| 31 | Erreurs | Provoquer un dépôt en doublon, un fichier interdit, une action sans droit | Messages d'erreur clairs affichés à l'écran, aucune exception JavaScript non gérée | Conforme — **[E2E]** (extension interdite) + revue manuelle des autres cas | OK |

## Points restants (hors périmètre de cette étape « fondations »)

- Écran de saisie des métadonnées spécifiques à chaque catégorie dans la modale de dépôt (le modèle de données les supporte déjà).
- Déplacement d'un document vers un autre dossier depuis l'interface (l'API `GED.updateDocument({dossierId})` existe déjà, seul le déclencheur UI manque).
- Recherche par contenu indexé (annoncée non disponible plutôt que simulée).
- Écran d'administration des catégories/classifications/droits (actuellement modifiables uniquement via le code, pas via une UI).
- Signature électronique et workflow de validation documentaire : uniquement préparés au niveau des données (`statut`, champ `workflow` réservé), aucune implémentation — conformément à la consigne de ne pas simuler une fausse signature.
- Extraction d'une feuille de styles réellement partagée entre `rh/index.html` et `ged/index.html` (actuellement dupliquée à l'identique dans `ged/ged.css` pour ne prendre aucun risque de régression sur le CSS de production du module RH).
