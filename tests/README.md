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
- D'autres fichiers seront ajoutés au fur et à mesure pour chaque parcours métier (agents, congés, workflow de validation, paie, formations, évaluations, maternité…).

## Notes

- Chaque test Playwright démarre avec un contexte navigateur isolé et un `localStorage` vide : l'application régénère alors son jeu de données de démonstration (`seed()`) à chaque exécution, sans fixture externe à préparer.
- Il n'y a pas d'authentification réelle dans l'application : le contrôle d'accès est simulé via le sélecteur de profil (`#sessRole` : RH / Agent / Responsable / Direction Financière). Les tests qui vérifient les permissions passent par ce sélecteur.
- Éviter les attentes arbitraires (`waitForTimeout`) : utiliser les assertions Playwright (`expect(locator).toBeVisible()`, etc.), qui attendent l'état réel de l'application.
