# devoirs-pronote

Petite appli (Cloudflare Worker) qui affiche les devoirs du jour/lendemain de
chaque enfant, avec des cases à cocher. Deux modes selon l'établissement
(voir `src/children.ts`) :

- **Connexion directe** (`pawnote`) — devoirs lus en direct depuis Pronote,
  la case à cocher écrit le statut fait/non-fait directement dans Pronote
  (source de vérité unique, pas de base de données séparée).
- **Établissement avec ENT obligatoire** (`externallySynced: true`) — voir
  la section dédiée plus bas. Les devoirs sont importés périodiquement par
  un script externe ; la case à cocher est gérée uniquement côté app (KV),
  jamais réécrite vers Pronote.

Contexte complet des décisions et de l'historique du projet : voir [CONTEXT.md](./CONTEXT.md).

## Fonctionnalités

- `GET /enfant/<slug>` — page dédiée à un enfant (à mettre en page de
  démarrage sur son PC/tablette). Mélange les devoirs Pronote et les tâches
  perso ajoutées par un parent (voir plus bas), chacune étiquetée "Pronote"
  ou avec le prénom du parent qui l'a ajoutée.
- `POST /enfant/<slug>/toggle` — coche/décoche un élément (devoir Pronote ou
  tâche perso, détecté via le préfixe de l'id) ; pour un devoir Pronote, écrit
  directement dans Pronote.
- `POST /enfant/<slug>/tasks` — un parent ajoute une tâche perso pour cet
  enfant (texte libre + qui l'ajoute + aujourd'hui/demain). Stockée à part
  (KV), sans lien avec Pronote. Même protection que `/parent` (token requis).
- `GET /parent` — vue agrégée de tous les enfants. **Lecture seule côté
  Pronote** (aucune case à cocher, aucun accès à Pronote en écriture : seuls
  les enfants via `/enfant/<slug>` modifient le statut) ; un parent peut en
  revanche y ajouter des tâches perso via le formulaire en haut de chaque
  bloc enfant. Protégée par un token (obligatoire : sans
  `PARENT_ACCESS_TOKEN` configuré, `/parent` refuse l'accès — contrairement à
  `/enfant/<slug>`, c'est un chemin fixe et devinable, donc pas de mode
  "ouvert" par défaut). Ce qu'un enfant vient de cocher "fait" (devoir ou
  tâche perso) depuis la dernière visite du parent est surligné avec un badge
  "nouveau" (indicateur visuel simple, pas de notification push/email — voir
  `src/parentView.ts`).

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

## Établissement avec ENT obligatoire

Certains établissements bloquent la connexion directe identifiant/mot de
passe et imposent l'authentification via leur ENT (CAS/Keycloak) —
`pawnote` ne gère pas ce protocole, et on a confirmé (voir
[CONTEXT.md](./CONTEXT.md)) que le pont "navigateur + QR code" ne suffit pas
non plus : le protocole moderne de Pronote semble lier l'appairage mobile à
la session du navigateur, pas a un jeton reutilisable de facon autonome.

**Solution retenue : synchronisation externe.** Un enfant avec
`externallySynced: true` dans [src/children.ts](./src/children.ts) n'est
**jamais** contacté en direct par le Worker. Ses devoirs sont importés
périodiquement par un script Python ([bootstrap/sync_homework.py](./bootstrap/sync_homework.py))
qui utilise [pronotepy](https://github.com/bain3/pronotepy) (bibliothèque
plus activement maintenue que `pawnote`, qui gère ce cas) et écrit
directement dans le KV Cloudflare que le Worker lit. Conséquence : la case à
cocher ne réécrit **jamais** dans Pronote pour ces enfants (Pronote n'est de
toute façon pas joignable en direct) — le statut "fait" est géré uniquement
côté KV, comme pour les tâches perso.

### 1. Bootstrap initial (une fois par enfant, ou si le token expire)

```bash
cd bootstrap
npm install
npx playwright install chromium        # une seule fois
python -m venv .venv                   # une seule fois
.venv/Scripts/python.exe -m pip install -r requirements.txt

node login.mjs --url https://xxxxx.index-education.net/pronote --child Malick
```

Ouvre un vrai navigateur, vous vous connectez vous-même sur la vraie page de
l'ENT (le script ne voit jamais votre mot de passe), puis passe la main à
`qr_login.py` (pronotepy) une fois le QR d'appairage généré dans Pronote.
En cas de succès, affiche un JSON avec `pronote_url`, `username`, `password`,
`client_identifier`, `uuid` — **à garder secret comme un mot de passe**.

### 2. Secrets GitHub Actions à créer

Dans les Settings → Secrets and variables → Actions du repo :

- Par enfant (`<PREFIX>` = `MALICK` ou `CODOU`), les 5 valeurs obtenues à
  l'étape 1 : `PRONOTE_<PREFIX>_URL`, `_USERNAME`, `_PASSWORD`, `_UUID`,
  `_CLIENT_ID`.
- `CLOUDFLARE_ACCOUNT_ID` — visible dans le dashboard Cloudflare.
- `CLOUDFLARE_KV_NAMESPACE_ID` — l'id du binding `PRONOTE_CACHE` dans
  `wrangler.toml`.
- `CLOUDFLARE_API_TOKEN` — à créer sur le dashboard Cloudflare (My Profile →
  API Tokens), avec la permission **Workers KV Storage: Edit**.
- `SECRETS_WRITE_TOKEN` — un Personal Access Token GitHub (Settings →
  Developer settings → Fine-grained tokens), limité à ce repo, avec la
  permission **Secrets: Read and write**. Nécessaire car les identifiants
  Pronote *tournent à chaque connexion* : le script met lui-même à jour
  `PRONOTE_<PREFIX>_USERNAME`/`_PASSWORD` après chaque synchro réussie.

### 3. Synchronisation automatique

[.github/workflows/sync-homework.yml](./.github/workflows/sync-homework.yml)
tourne plusieurs fois par jour (voir le fichier pour l'horaire exact) et peut
aussi être déclenché à la main depuis l'onglet Actions de GitHub ("Run
workflow"). Lecture seule côté Pronote : n'écrit jamais de statut "fait".

### 4. Si le bootstrap échoue

`login.mjs` sauvegarde le trafic réseau capturé dans
`bootstrap/last-run-log.json` et une capture d'écran dans
`bootstrap/last-run-screenshot.png` (jamais commités, jamais de mot de passe
dedans) pour qu'on ajuste le script ensemble.
