# Règles de développement — ERP-PLATFORM

Ce projet doit être traité comme une application en production. Ces règles s'appliquent à toute intervention de Claude Code sur ce dépôt, sauf instruction explicite contraire de l'utilisateur pour une tâche ponctuelle.

## 1. Avant toute modification

- Analyser l'architecture existante avant de coder : identifier les fichiers, sections et fonctionnalités concernés et ceux qui pourraient être impactés.
- Ne jamais modifier un fichier sans comprendre son rôle. Ne pas réécrire inutilement du code existant. Préférer les modifications minimales et ciblées.
- Avant une fonctionnalité importante, présenter brièvement : (1) l'existant, (2) ce qui est proposé, (3) les fichiers concernés, (4) les risques de régression — puis attendre confirmation si le choix engage une décision d'architecture.

## 2. Travail par fonctionnalité

- Une branche dédiée par fonctionnalité : `feature/nom-fonctionnalite`, ou `fix/nom-du-bug` pour un correctif.
- Ne jamais commiter directement sur `main`.
- Commits petits, cohérents, explicites (`feat: …`, `fix: …`, `test: …`, `refactor: …`), une fonctionnalité par commit.

## 3. Tests obligatoires

- Toute fonctionnalité nouvelle est accompagnée de tests (cas nominaux, cas limites, erreurs/données invalides, droits/permissions si pertinent).
- Toute correction de bug a un test qui reproduit le bug avant la correction.
- **État actuel du projet** : dépôt 100% statique (`index.html`, `rh/index.html`), sans `package.json`, sans framework de test, sans linter, sans étape de build. Avant la première fonctionnalité soumise à ces règles, une infrastructure de test doit être proposée et validée avec l'utilisateur (ex. Playwright pour des tests de bout en bout sur l'app statique) plutôt que d'être ajoutée unilatéralement.

## 4. Non-régression

Après chaque modification : exécuter les tests de la fonctionnalité puis la suite complète, vérifier lint/formatage et le build si applicable. Ne jamais déclarer une fonctionnalité terminée sur la seule base que le code s'exécute sans erreur visible.

## 5. Ne jamais contourner un test

Interdit : supprimer/désactiver un test qui échoue, modifier une assertion pour le faire passer, masquer une erreur avec un try/catch inutile. Si un test casse, déterminer s'il s'agit d'une régression (à corriger) ou d'un changement de comportement voulu (à justifier avant d'adapter le test).

## 6. Qualité du code

Respecter les conventions déjà en usage dans le fichier concerné, séparer les responsabilités, réutiliser l'existant, nommer explicitement, éviter code mort/dupliqué/dépendances inutiles et solutions temporaires laissées en place.

## 7. Sécurité

Jamais de secrets/tokens/clés en dur ou dans Git. Ne pas contourner un contrôle d'accès. Vérifier les droits pour toute fonctionnalité touchant des données sensibles (ex. dossiers agents, paie).

## 8. Git

Avant chaque commit : vérifier les fichiers modifiés, le diff, l'absence de fichier sensible/inutile, et que les tests passent. Messages de commit explicites.

## 9. Documentation

Toute fonctionnalité importante met à jour la documentation utile (fonctionnement, paramètres, nouvelles dépendances, procédures particulières).

## 10. Rapport de fin de tâche

Avant de déclarer un travail terminé, présenter : fonctionnalité réalisée, fichiers modifiés, tests ajoutés, tests exécutés (commande, réussis/échoués), vérifications (lint/build/tests : OK/KO), risques éventuels. Ne jamais déclarer « terminé » si tests ou build échouent, sauf échec explicitement identifié et signalé.

## Contexte technique du dépôt

- `index.html` : portail d'accueil de la plateforme ERP (liens vers les modules).
- `rh/index.html` : module RH complet (single-file, HTML/CSS/JS vanilla, aucune dépendance externe hors Google Fonts). Contient : dossier agent, congés (workflow N+1/N+2/RH), paie (génération + contrôle Direction Financière), allaitement, formations, notations, maternité, moteur de workflow générique réutilisable, profils différenciés (RH/Agent/Responsable/Direction Financière) simulés côté client (pas d'authentification réelle).
- `ged/` : module GED (Gestion Électronique des Documents), brique transverse réutilisable par les autres modules de l'ERP.
  - `ged/ged-core.js` : couche données/logique, sans dépendance DOM (`StorageProvider` abstrait avec implémentation IndexedDB par défaut, modèle espaces/dossiers/documents/versions/corbeille/audit, droits, recherche). Réutilise l'identité et l'annuaire agents déjà en place côté RH (mêmes clés `localStorage` : `oph_rh_v1` et `oph_rh_v1_session`) plutôt que de dupliquer une session.
  - `ged/ged-ui.js` : widgets d'interface réutilisables (modale de dépôt drag & drop, panneau détail document) — utilisés à la fois par `ged/index.html` et par l'onglet « Documents » du dossier agent RH.
  - `ged/index.html` + `ged/ged.css` : module GED autonome (arborescence espaces/dossiers, recherche, corbeille, journal d'audit).
  - `ged/RECETTE.md` : checklist de recette fonctionnelle.
  - Le module RH n'a plus de gestion de documents qui lui soit propre : `rh/index.html` délègue entièrement à la GED (voir `renderDocumentsPane()`), y compris l'import unique des documents historiques pré-existants (métadonnées uniquement, sans fichier réel, marqués comme tels).
  - **Important** : comme le reste du dépôt, la GED tourne entièrement côté navigateur (pas de backend). Les contrôles de droits (`GED.can()`) et l'audit sont une simulation pédagogique, pas une sécurité serveur — un déploiement réel nécessiterait un backend appliquant les mêmes règles côté serveur.
- Persistance : `localStorage` du navigateur (métadonnées) + `IndexedDB` (contenu des fichiers de la GED) — pas de backend. Les données de démonstration sont régénérées via le bouton « Reset » (module RH ; la GED garde ses propres données tant qu'elle n'a pas de bouton de réinitialisation dédié).
- Déploiement : GitHub Pages, servi automatiquement depuis `main` (aucune étape de build).
- Tests E2E : Playwright (`tests/`, `npm test`) — voir `tests/README.md`. `tests/ged.spec.js` couvre le module GED et son intégration RH.
