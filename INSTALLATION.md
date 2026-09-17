# Installer Familyo pour une autre famille

Ce guide decrit **une installation par famille** : chaque famille a son propre
Worker, son propre KV, ses propres secrets, sa propre adresse.

C'est le choix le plus sur, et la raison tient en une phrase : **une erreur
dans le code ne peut pas exposer l'enfant d'une autre famille.** Toutes les
donnees sont rangees par identifiant d'enfant, mais un identifiant est une URL
secrete partagee, pas une identite authentifiee. Dans un espace commun, un
prefixe oublie dans une seule cle ferait lire a la famille A les devoirs, les
notes et les identifiants Pronote de la famille B. Dans un espace separe, le
meme oubli n'a aucune consequence : il n'y a personne d'autre.

## La regle qui prime sur le confort

**Le parent saisit ses secrets lui-meme, sur son propre compte.**

Un identifiant ENT n'ouvre pas que les notes : souvent la messagerie avec les
professeurs, les absences, parfois le compte du parent. Un mot de passe qui
passe par vos mains est un mot de passe que vous avez detenu, avec ce que ca
implique le jour ou il fuit.

En pratique : partage d'ecran, vous guidez, **c'est le parent qui tape**.

## Avant de commencer

La famille a besoin de :

- un compte **Cloudflare** (gratuit) ;
- un compte **GitHub** (gratuit), uniquement si l'ecole passe par un ENT ;
- une cle **Gemini** (gratuite) pour le devoir maison et la preparation brevet.

Si l'ecole n'impose pas d'ENT, ou si la famille prefere ne pas confier ses
identifiants scolaires : **Familyo fonctionne sans la synchro Pronote.** Mon
temps, les prieres, Mon Radar, le devoir maison, le brevet et les taches
saisies a la main marchent tous sans aucun identifiant d'ecole. C'est la
version a proposer par defaut a une famille qui hesite.

## 1. Preparer la configuration

```bash
cd bootstrap
node nouvelle-famille.mjs --enfant "Prenom:Classe" --enfant "Autre:3e:brevet"
```

Le script ne demande, ne lit et n'ecrit aucun identifiant, et ne se connecte a
rien. Il tire au sort les liens secrets et imprime tout le reste : l'entree
`children.ts` a coller, la liste des secrets, les commandes, et les liens a
distribuer.

Ajouter `:brevet` en troisieme champ pour un enfant de 3e qui prepare le
brevet : ca lui ouvre l'onglet correspondant.

Deux champs restent a completer a la main dans `children.ts` :
`defaultAccentId` (voir `ACCENTS` dans `src/preferences.ts`) et
`homeworkSubjects`. Ce dernier n'est qu'une valeur de depart : le parent
modifie ensuite ses matieres depuis ses Reglages.

## 2. Deployer

Sur le compte Cloudflare **de la famille** :

```bash
npx wrangler kv namespace create PRONOTE_CACHE
```

Reporter l'identifiant obtenu dans `wrangler.toml`, choisir un `name` propre a
la famille (c'est lui qui donne l'adresse), puis :

```bash
npx wrangler deploy
```

## 3. Les secrets

Le parent les saisit, un par un. `wrangler secret put` demande la valeur
**apres** la commande : elle ne passe ni par un fichier, ni par l'historique du
terminal.

```bash
npx wrangler secret put PARENT_ACCESS_TOKEN
```

Sans ce secret, l'espace parent repond 403 a tout le monde — c'est voulu.

Puis `GEMINI_API_KEY`, et si la famille les veut, `NASA_API_KEY` et
`FOOTBALL_API_KEY`. Les categories dont la cle manque sont simplement absentes,
et les Reglages disent laquelle manque.

> **Piege connu.** `wrangler secret put` echoue tant que la derniere version
> televersee du Worker n'est pas celle qui est deployee — c'est une regle de la
> plateforme, le tableau de bord ne la contourne pas. Poser les secrets
> **apres** un `wrangler deploy` reussi.

## 4. La synchro Pronote (seulement si ENT)

Dans `bootstrap/`, une fois par enfant :

```bash
node login.mjs --url <url-pronote-de-l-etablissement> --child Prenom
```

La commande produit cinq valeurs a mettre en secrets GitHub, plus les trois
secrets Cloudflare et le `SECRETS_WRITE_TOKEN` listes par le generateur.

Pourquoi ce dernier : Pronote fait tourner les identifiants a **chaque**
connexion, donc le script doit les reecrire apres chaque passage. C'est le
jeton le plus puissant de l'installation — il peut reecrire n'importe quel
secret du depot. Le creer en **fine-grained**, limite a ce seul depot, avec la
seule permission `Secrets: write`.

La synchro passe cinq fois par jour, pas la nuit. GitHub ne garantit pas les
horaires : il retarde et abandonne des passages sous charge. C'est une limite
a connaitre, pas une panne.

## 5. Distribuer les liens

Le generateur les imprime. **Ce sont des secrets** : ils se partagent comme un
mot de passe, pas dans un groupe de classe.

Chaque enfant et chaque prof a en plus un **code a 5 chiffres**, que le parent
definit depuis ses Reglages. Tant qu'aucun code n'est defini, la page reste
bloquee — pas ouverte.

## Ce que cette installation ne fait pas

- **Pas d'inscription en ligne.** Chaque famille est installee a la main. C'est
  le prix de la separation des donnees.
- **Pas de mise a jour automatique.** Une correction publiee ici demande un
  `git pull` puis un `wrangler deploy` chez chaque famille.
- **Pas de recuperation de compte.** Un `PARENT_ACCESS_TOKEN` perdu se
  remplace, il ne se retrouve pas.

## Limite connue, a corriger avant d'ouvrir largement

La CSP autorise `script-src 'unsafe-inline'`. Sans cette autorisation, une
faille d'injection resterait inerte ; avec elle, elle s'executerait. La
corriger proprement demande des nonces sur chaque script en ligne, donc une
modification de toutes les pages. A traiter avant de multiplier les
installations.
