# Tests end-to-end (Playwright)

Ces tests pilotent l'application réelle (fichiers statiques servis localement), pas de mocks. Ce sont des **tests E2E**, pas des tests unitaires.

## Installation (une fois)

```bash
npm install
npx playwright install chromium
```

## Lancer les tests

```bash
npm test
```

Playwright démarre automatiquement un petit serveur statique local (`scripts/static-server.js`, sans dépendance) sur `http://127.0.0.1:4173`, exécute les tests dans `tests/`, puis l'arrête.

Autres commandes utiles :

- `npm run test:headed` — lance les tests avec le navigateur visible.
- `npm run test:report` — rouvre le dernier rapport HTML généré.

## Organisation

- `smoke.spec.js` — vérification de base (le portail se charge, le module RH est accessible).
- `agents.spec.js`, `conges.spec.js`, `paie.spec.js`, `formations.spec.js`, `maternite.spec.js` — parcours métier du module RH.
- `ged.spec.js` — module GED (accès, création de dossier, dépôt, consultation/téléchargement, versioning, corbeille/restauration, droits, audit, intégration avec le dossier agent RH). Utilise les fixtures de `tests/fixtures/`.

## Notes

- Chaque test Playwright démarre avec un contexte navigateur isolé et un `localStorage`/`IndexedDB` vides : l'application régénère alors son jeu de données de démonstration (`seed()`) à chaque exécution, sans fixture externe à préparer (à l'exception des petits fichiers de `tests/fixtures/` utilisés pour les dépôts de documents dans `ged.spec.js`).
- Il n'y a pas d'authentification réelle dans l'application : le contrôle d'accès est simulé via le sélecteur de profil (`#sessRole` : RH / Agent / Responsable / Direction Financière). Les tests qui vérifient les permissions passent par ce sélecteur.
- Éviter les attentes arbitraires (`waitForTimeout`) : utiliser les assertions Playwright (`expect(locator).toBeVisible()`, etc.), qui attendent l'état réel de l'application.
- Pour un dépôt de fichier déclenché par un `<input type="file">` créé dynamiquement en JavaScript (ex. « Nouvelle version » dans la GED), utiliser `page.waitForEvent("filechooser")` plutôt que de chercher l'élément dans le DOM : Playwright intercepte la boîte de dialogue au niveau du navigateur, indépendamment de la présence de l'input dans l'arbre du document.
