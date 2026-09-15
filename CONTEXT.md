# Devoirs Pronote — contexte de démarrage pour Claude Code

Ce fichier résume tout ce qui a été décidé et trouvé dans la conversation Cowork
précédente, pour reprendre le projet directement dans Claude Code (en local,
avec accès complet à npm/git/wrangler) sans rien reperdre. À coller en tout
début de session Claude Code (ou à garder comme `CLAUDE.md`/`CONTEXT.md` à la
racine du nouveau repo).

## Besoin exprimé par Lémou

Que les enfants sachent, dès qu'ils se connectent sur leur PC/tablette en
rentrant de l'école, ce qu'ils ont à faire (devoirs du jour/lendemain d'après
Pronote), et qu'ils puissent cocher au fur et à mesure ce qui est fait — pour
que la maman n'ait plus à leur écrire ça sur une feuille chaque jour avant
qu'ils rentrent, et puisse voir l'avancement sans redemander.

## Décisions déjà prises (confirmées par Lémou)

- **Architecture retenue : une petite appli web maison** (pas Home Assistant —
  HA n'est pas encore en place chez lui). Réutilise le même pattern que le
  projet "Mon Menu IA" (Cloudflare Worker), déjà maîtrisé.
- **Connexion Pronote : identifiant/mot de passe direct** (pas d'ENT/
  EduConnect) — confirmé par Lémou, donc pas de blocage d'authentification
  fédérée à gérer.
- **Hébergement : même compte Cloudflare que Mon Menu IA** (un seul endroit à
  gérer). Ce compte a déjà un Worker `mon-menu-ia` en prod (id
  `d433e73cb8954ca797689c34e69812c4`), déployé via un repo GitHub connecté à
  Cloudflare (déploiement auto au push), avec des secrets Cloudflare pour les
  clés API sensibles — même logique à reproduire ici pour les identifiants
  Pronote.
- **Appareils des enfants : mix PC + tablette** (pas un seul type) — prévoir
  que la page fonctionne bien en navigateur sur les deux (responsive simple).
- **Nom du repo/Worker : `devoirs-pronote`** (confirmé).
- **Enfants gérés de façon générique** : on démarre avec deux enfants, mais la
  config (`src/children.ts`) est conçue pour que d'autres personnes puissent
  reprendre le projet et l'utiliser avec leurs propres enfants, sans toucher
  au code — juste ajouter une entrée + les secrets correspondants.

## Pourquoi passer à Claude Code

Dans la session Cowork précédente, l'accès au compte Cloudflare permettait de
lister/inspecter les Workers existants (lecture) et de créer des ressources
D1/KV, mais pas de déployer un nouveau Worker en prod (ça passe par le repo
GitHub connecté, comme pour Mon Menu IA). Claude Code en local donne le cycle
complet : `npm install`, test local (`wrangler dev`), `git commit`/`push`,
déploiement — dans le même outil.

## Librairie technique retenue : Pawnote

- Package npm `pawnote` (JS/TS), wrapper non-officiel pour l'API interne de
  Pronote. Dépôt confirmé : `LiterateInk/Pawnote.js` (v1.6.2 installée).
- **Authentification directe identifiant + mot de passe supportée** via
  `loginCredentials(session, { url, kind: AccountKind.STUDENT, username,
  password, deviceUUID })`. Retourne un `RefreshInformation.token` réutilisable
  ensuite avec `loginToken(...)` pour éviter de renvoyer le mot de passe à
  chaque requête (mis en œuvre dans `src/pronote.ts`, token + deviceUUID
  cachés en KV).
- **Lecture du cahier de texte** : `assignmentsFromIntervals(session,
  startDate, endDate)` — utilisé ici sur la fenêtre aujourd'hui→demain.
- **Écriture du statut fait/non fait** : `assignmentStatus(session,
  assignmentID, done)` — écrit directement dans Pronote, qui reste la seule
  source de vérité (pas de base de données perso pour l'état des cases). Un
  cache KV léger (3 min) évite de re-solliciter Pronote à chaque chargement de
  page ; il est invalidé dès qu'une case est cochée.
- Licence GPL-3.0. Projet tiers non officiel (comme Gemini pour Mon Menu IA) —
  toléré en pratique par une communauté française active, mais pas garanti à
  vie : si Pronote change son fonctionnement interne, une interruption
  ponctuelle est possible et pourra nécessiter un correctif.
- Signatures exactes relevées directement dans
  `node_modules/pawnote/dist/index.d.ts` après `npm install pawnote` (la doc
  en ligne était limitée au moment de la recherche web).

## État du code (scaffoldé dans cette session)

Le squelette complet est en place dans ce repo :

- `src/children.ts` — liste des enfants (slug + prénom + préfixe de secrets),
  à personnaliser.
- `src/env.ts` — lecture typée des secrets Cloudflare par enfant.
- `src/pronote.ts` — session Pawnote (login token-first avec repli sur
  mot de passe), lecture des devoirs, écriture du statut, cache KV.
- `src/render.ts` — pages HTML (enfant + parent), sans framework, CSS inline
  responsive, clair/sombre.
- `src/index.ts` — routing du Worker :
  - `GET /enfant/<slug>` — page de l'enfant.
  - `POST /enfant/<slug>/toggle` — coche/décoche un devoir (`{id, done}`).
  - `GET /parent` — vue agrégée de tous les enfants (protégeable par
    `PARENT_ACCESS_TOKEN`, via `?token=` ou header `x-parent-token`).
- `wrangler.toml` — binding KV `PRONOTE_CACHE` (id à créer), commentaires sur
  les secrets attendus.
- `.dev.vars.example` — modèle pour tester en local (`npm run dev`), à copier
  en `.dev.vars` (jamais commité).

## Enfants (confirmé)

- Enfant 1 : **Malick** — `src/children.ts`, slug `malick-K5p0nA65n8L1`,
  secrets `PRONOTE_MALICK_*`.
- Enfant 2 : **Codou** — slug `codou-tBCiBx5FYmTB`, secrets `PRONOTE_CODOU_*`.

## Portée du projet : phase 1

Cette version cible uniquement les deux enfants de Lémou (config codée en dur
dans `src/children.ts`, pas d'interface d'admin). L'architecture reste conçue
pour qu'une **phase ultérieure** permette à d'autres familles de choisir
elles-mêmes le prénom de leur enfant et l'URL Pronote de leur collège (déjà
possible techniquement en éditant `src/children.ts` + secrets, mais sans
self-service ni UI pour l'instant — hors scope phase 1).

## Blocage decouvert : ce college exige l'ENT (Keycloak/CAS)

URL Pronote fournie par Lémou : `https://0921233r.index-education.net/pronote`
(collège Maréchal Leclerc, Hauts-de-Seine). Vérifié techniquement (appel
public en lecture seule à `instance()` de pawnote, aucun identifiant utilisé) :
cette instance impose l'authentification via l'ENT (`casURL` renseigné =
`https://enc.hauts-de-seine.fr/auth/realms/oze_hds/protocol/cas`, un serveur
Keycloak). La connexion directe identifiant/mot de passe prévue au départ
**ne fonctionne pas** ici — `pawnote` ne gère pas l'authentification ENT/CAS
("ENT native support is not and will never be supported", confirmé dans
leur doc).

**Recherche faite** (pour ne pas la refaire si on reprend ce sujet) : le
connecteur Cozy officiel pour Pronote (`konnectors/pronote` sur GitHub,
actif) gère ce cas via `src/fetch/ENT.js` : connexion CAS avec la lib
dépréciée `pronote-api`/`pronote-api-maintained` (scraping de formulaire via
`jsdom`), puis génère un token QR-code Pronote (`JetonAppliMobile`) rebranché
sur `pawnote` (`loginQrCode`) pour la suite. Le scraping CAS Keycloak
lui-même est simple et vérifié (formulaire standard, champs `username`/
`password`, action dynamique avec `session_code`/`execution`/`tab_id`,
cookies `AUTH_SESSION_ID`/`KC_RESTART`).

**Tentative 1 (abandonnée) : navigateur + QR code → pawnote.** Idée de
Lémou, meilleure que la piste `jsdom`/`pronote-api` initiale : un vrai
navigateur (Playwright, local) fait la connexion ENT (Lémou tape ses
identifiants dans la vraie page, jamais dans notre code), on récupère les
données du QR code d'appairage "application mobile" que Pronote génère
lui-même, et on les passe à `pawnote` (`loginQrCode`). **Échec confirmé et
bien compris**, pas juste "ça ne marche pas" : la requête HTTP que `pawnote`
fait ensuite vers `mobile.eleve.html` réussit (200 OK) mais renvoie un
contenu minimal (`Start({"h":...,"a":6})`), sans les données de chiffrement
attendues. En capturant tout le trafic réseau du vrai navigateur pendant la
session, on a vu que Pronote moderne (2026.2.6) enchaîne **7 appels
`appelfonction` + 1 `appelpolling`** après la connexion ENT, tous liés au
même numéro de session navigateur (`session=NNNNNNN` croissant) — l'appairage
mobile semble lié à cette session précise, pas réutilisable comme jeton
autonome. `pawnote` (bibliothèque figée depuis ~1 an) ne reproduit pas cet
enchaînement.

**Tentative 2 (réussie pour la lecture) : navigateur + QR code → pronotepy.**
Idée de Lémou : remplacer `pawnote` par [pronotepy](https://github.com/bain3/pronotepy)
(bibliothèque Python, commit il y a 12 jours contre ~1 an pour `pawnote`)
pour la partie post-QR. **Ça fonctionne** : `pronotepy.Client.qrcode_login(...)`
réussit là où `pawnote.loginQrCode` échouait, confirmé sur le vrai compte de
Codou. Connaissance utile trouvée en marge : `pronotepy` a une doc interne
(`ObjetCommMessage.js` décompilé de l'appli mobile officielle) sur un
paramètre "magique" `bydlg=...` que certains ENT exigent — pas notre
blocage ici, mais utile à savoir.

**Piège découvert et documenté** : les identifiants renvoyés par
`pronotepy` après une connexion QR (`username`/`password` via
`export_credentials()`) sont au format "token" propre à pronotepy
(`login_mode = "token"`, prévu pour son propre `token_login`), **pas
compatibles avec `pawnote.loginCredentials`** — testé et confirmé en échec
avec [bootstrap/test_pawnote_bridge.mjs](./bootstrap/test_pawnote_bridge.mjs)
(gardé dans le repo comme outil de diagnostic si `pawnote` evolue un jour).
Les deux bibliothèques parlent un dialecte différent du protocole de
re-connexion.

**Architecture finale retenue** : puisque `pronotepy` (Python) ne peut pas
tourner sur Cloudflare Workers, on ne cherche plus à unifier les deux
bibliothèques. À la place, un enfant `externallySynced: true` (voir
`src/children.ts`) n'est plus jamais contacté en direct par le Worker :

- [bootstrap/login.mjs](./bootstrap/login.mjs) — bootstrap initial (une fois
  par enfant, ou si le token pronotepy expire) : Playwright fait la
  connexion ENT, [bootstrap/qr_login.py](./bootstrap/qr_login.py)
  (pronotepy) termine l'appairage et affiche les identifiants à mettre en
  secrets GitHub.
- [bootstrap/sync_homework.py](./bootstrap/sync_homework.py) — tourne côté
  GitHub Actions ([.github/workflows/sync-homework.yml](./.github/workflows/sync-homework.yml)),
  plusieurs fois par jour. Lecture seule (jamais d'écriture de statut vers
  Pronote) : recupère les devoirs via pronotepy et les écrit dans le KV
  Cloudflare (`homework-external:<slug>`) que le Worker lit ensuite. Comme
  les identifiants pronotepy tournent à chaque connexion, le script met
  lui-même à jour les secrets GitHub après chaque synchro (`gh secret set`).
- `src/pronote.ts` — `getHomework`/`setHomeworkStatus` branchent sur
  `child.externallySynced` : lecture depuis `homework-external:<slug>` (KV)
  au lieu de `pawnote`, statut "fait" géré dans `homework-done-overrides:<slug>`
  (KV) — jamais réécrit vers Pronote, comme confirmé impossible pour ces
  comptes. Testé en local (`wrangler dev` + KV local) : affichage, coche,
  persistance après reload — tout fonctionne.
- Pas besoin d'un "agent IA" de surveillance séparé pour détecter les
  changements d'ENT (idée initiale de Lémou) : le bandeau d'erreur déjà
  affiché sur `/enfant` et `/parent` signale déjà clairement les échecs.

**Décision produit de Lémou** (a simplifié le projet) : la coche n'a pas
besoin de repartir vers Pronote pour ces deux enfants — seule l'appli compte
pour vérifier ce qui est fait, maman regarde `/parent`, pas Pronote
directement. D'où le choix "coche locale uniquement" plutôt qu'une file
d'attente de resynchronisation vers Pronote (plus complexe, pas demandé).

## Infos encore manquantes avant utilisation reelle

0. ~~Demander à l'administration du collège~~ — **refusé** (le collège ne
   veut pas activer la connexion directe). Confirme qu'on reste sur
   l'architecture "synchronisation externe" ci-dessus pour Malick et Codou
   (même collège pour les deux, confirmé par Lémou).
1. **Bootstrap Codou** : fait, identifiants obtenus (jamais partagés en
   clair, gardés par Lémou).
2. **Bootstrap Malick** : pas encore fait — même procédure que Codou
   (`bootstrap/login.mjs --url ... --child Malick`), même collège donc même
   URL Pronote de base.
3. **Secrets GitHub Actions** (voir README section "Établissement avec ENT
   obligatoire") : à créer — identifiants des 2 enfants, `CLOUDFLARE_ACCOUNT_ID`
   (`520846e8d495bcd67d54a010b1722618`, déjà connu, pas un secret),
   `CLOUDFLARE_KV_NAMESPACE_ID` (`7d399b42418b49bc8163fbca3e9d5496`, déjà
   dans `wrangler.toml`), `CLOUDFLARE_API_TOKEN` (à créer, permission Workers
   KV Storage:Edit) et `SECRETS_WRITE_TOKEN` (PAT GitHub, permission Secrets:
   Read and write, pour que le script puisse se mettre à jour lui-même).
4. **`PARENT_ACCESS_TOKEN`** en prod — pas encore défini, donc `/parent`
   répond 403 pour l'instant sur le Worker déployé (comportement voulu par
   défaut, fail-closed).
5. **Configurer les pages en page de démarrage** sur les appareils des
   enfants une fois les URLs `/enfant/<slug>` stables.
6. **Personnaliser les slugs** dans `src/children.ts` si besoin (actuellement
   `malick-K5p0nA65n8L1` / `codou-tBCiBx5FYmTB`, générés aléatoirement,
   fonctionnels tels quels).

## Deploiement (fait)

- ~~Créer le KV namespace~~ — `PRONOTE_CACHE`, id dans `wrangler.toml`.
- ~~Connecter le repo GitHub à Cloudflare~~ — Workers Builds configuré
  (repo `LemouD/Pronote-family-project-app`, branche `master`, build
  `npm install`, deploy `npx wrangler deploy`). Worker renommé
  `devoirs-pronote` sur le dashboard pour matcher `wrangler.toml` (l'import
  l'avait nommé `pronote-family-project-app` d'après le nom du repo).
  Déploiement initial vérifié : le bundle en prod contient bien le vrai code
  (slugs, routes, KV) — confirmé via l'API Cloudflare.
- **Cloudflare Access non activé** volontairement sur ce Worker : ça aurait
  imposé une connexion avant d'atteindre `/enfant/<slug>`, cassant l'usage
  sans-friction prévu pour les enfants. La protection reste : slugs
  non-devinables + `PARENT_ACCESS_TOKEN` fail-closed sur `/parent`.

## Contexte connexe utile (projet "Mon Menu IA", même compte Cloudflare)

Pattern déjà en place et à réutiliser : Excel/VBA n'est pas concerné ici, mais
le **Worker Cloudflare comme relais sécurisé** l'est — clés/secrets API
jamais exposées côté client, un `worker.js` qui distingue les usages,
déploiement via repo GitHub connecté à Cloudflare. Contact technique de
Lémou : `lemoundiop@gmail.com`.
