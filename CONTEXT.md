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

## Infos encore manquantes avant de déployer

1. **URL Pronote exacte** de l'établissement — Lémou doit la relever dans la
   barre d'adresse au prochain login d'un des enfants.
2. **Identifiants Pronote de chaque enfant** — à ajouter directement en
   secrets Cloudflare une fois le Worker créé (`wrangler secret put ...`),
   jamais à coller dans une conversation.
3. **Créer le KV namespace** : `npx wrangler kv namespace create
   PRONOTE_CACHE`, puis reporter l'id dans `wrangler.toml`.
4. **Connecter le repo GitHub à Cloudflare** pour le déploiement auto (comme
   Mon Menu IA), une fois testé en local.
5. **Configurer les pages en page de démarrage** sur les appareils des
   enfants une fois les URLs `/enfant/<slug>` stables.

## Contexte connexe utile (projet "Mon Menu IA", même compte Cloudflare)

Pattern déjà en place et à réutiliser : Excel/VBA n'est pas concerné ici, mais
le **Worker Cloudflare comme relais sécurisé** l'est — clés/secrets API
jamais exposées côté client, un `worker.js` qui distingue les usages,
déploiement via repo GitHub connecté à Cloudflare. Contact technique de
Lémou : `lemoundiop@gmail.com`.
