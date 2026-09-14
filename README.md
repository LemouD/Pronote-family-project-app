# devoirs-pronote

Petite appli (Cloudflare Worker) qui affiche les devoirs du jour/lendemain de
chaque enfant, lus directement depuis Pronote via [pawnote](https://github.com/LiterateInk/Pawnote.js),
avec des cases à cocher qui écrivent le statut fait/non-fait dans Pronote
lui-même (pas de base de données séparée : Pronote reste la seule source de
vérité).

Contexte complet des décisions et de l'historique du projet : voir [CONTEXT.md](./CONTEXT.md).

## Fonctionnalités

- `GET /enfant/<slug>` — page dédiée à un enfant (à mettre en page de
  démarrage sur son PC/tablette).
- `POST /enfant/<slug>/toggle` — coche/décoche un devoir, écrit dans Pronote.
- `GET /parent` — vue agrégée de tous les enfants, protégée par un token
  (obligatoire : sans `PARENT_ACCESS_TOKEN` configuré, `/parent` refuse
  l'accès — contrairement à `/enfant/<slug>`, c'est un chemin fixe et
  devinable, donc pas de mode "ouvert" par défaut).

## Installation

```bash
npm install
```

## Configuration locale

Copier `.dev.vars.example` en `.dev.vars` (jamais commité) et renseigner, pour
chaque enfant défini dans [src/children.ts](./src/children.ts), son URL
Pronote, identifiant et mot de passe :

```
PRONOTE_<PREFIX>_URL=...
PRONOTE_<PREFIX>_USERNAME=...
PRONOTE_<PREFIX>_PASSWORD=...
```

`<PREFIX>` correspond au champ `secretPrefix` de l'enfant dans `src/children.ts`.

## Lancer en local

```bash
npm run dev
```

## Vérifier les types

```bash
npm run typecheck
```

## Déploiement (Cloudflare)

1. Créer le KV namespace et reporter l'id dans `wrangler.toml` :
   ```bash
   npx wrangler kv namespace create PRONOTE_CACHE
   ```
2. Ajouter les secrets de production (jamais dans le code ni dans une
   conversation) :
   ```bash
   npx wrangler secret put PRONOTE_<PREFIX>_URL
   npx wrangler secret put PRONOTE_<PREFIX>_USERNAME
   npx wrangler secret put PRONOTE_<PREFIX>_PASSWORD
   ```
   Obligatoire pour que `/parent` fonctionne (sinon toujours 403) :
   ```bash
   npx wrangler secret put PARENT_ACCESS_TOKEN
   ```
   Le token peut être passé en header (`x-parent-token`, recommandé) ou en
   query string (`?token=...`, pratique pour un lien/raccourci sur téléphone
   mais visible dans l'historique du navigateur et les logs serveur — à
   n'utiliser que sur un appareil personnel).
3. Déployer :
   ```bash
   npm run deploy
   ```

## Ajouter un enfant

Ajouter une entrée dans [src/children.ts](./src/children.ts) avec un `slug`
long et non-devinable, puis définir les 3 secrets Pronote correspondants
(voir ci-dessus). Aucune autre modification de code n'est nécessaire.
