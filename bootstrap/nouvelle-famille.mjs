#!/usr/bin/env node
/**
 * Prepare l'installation de Familyo pour une nouvelle famille.
 *
 * Ce script ne demande, ne lit et n'ecrit AUCUN identifiant. Il ne se
 * connecte a rien. Il produit deux choses :
 *   - l'entree children.ts a coller, avec des liens secrets tires au sort ;
 *   - la liste exacte des commandes a lancer, dans l'ordre.
 *
 * C'est volontaire : les identifiants Pronote d'une famille ne doivent jamais
 * transiter par la machine de quelqu'un d'autre. Le parent les saisit lui-meme,
 * chez lui, dans son propre tableau de bord - voir INSTALLATION.md.
 *
 * Usage :
 *   node nouvelle-famille.mjs --enfant "Codou:5e" --enfant "Malick:3e:brevet"
 *
 * Chaque --enfant est "Prenom:Classe" avec un troisieme champ optionnel
 * "brevet" si l'enfant prepare le brevet cette annee.
 */

import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CONFIG_PATH = join(dirname(dirname(fileURLToPath(import.meta.url))), "familyo.config.json");

/** Meme longueur que les slugs existants : 9 octets, soit 12 caracteres. */
function secretSuffix() {
  return randomBytes(9).toString("base64url");
}

/** Retire les accents et tout ce qui n'est pas une lettre : le slug part dans une URL. */
function asciify(name) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .toLowerCase();
}

function parseChild(raw) {
  const [firstName, schoolYear, extra] = raw.split(":");
  if (!firstName || !schoolYear) {
    throw new Error(`--enfant attend "Prenom:Classe" (recu : "${raw}")`);
  }
  if (extra && extra !== "brevet") {
    throw new Error(`troisieme champ inconnu : "${extra}" (seul "brevet" est reconnu)`);
  }

  const base = asciify(firstName);
  if (!base) throw new Error(`prenom inutilisable pour un slug : "${firstName}"`);

  return {
    firstName,
    schoolYear,
    examPrep: extra === "brevet",
    slug: `${base}-${secretSuffix()}`,
    tutorSlug: `${base}-${secretSuffix()}`,
    secretPrefix: base.toUpperCase()
  };
}

function childEntry(child) {
  const entry = {
    slug: child.slug,
    displayName: child.firstName,
    secretPrefix: child.secretPrefix,
    externallySynced: true,
    schoolYear: child.schoolYear,
    // A choisir dans ACCENTS (src/preferences.ts). "turquoise" tient lieu de
    // valeur de depart : l'enfant la changera lui-meme depuis ses reglages.
    defaultAccentId: "turquoise",
    defaultAvatar: "🙂",
    avatars: ["🙂", "⭐", "🎧", "⚽", "🎮", "📚", "🎨", "🐱"],
    tutorSlug: child.tutorSlug,
    homeworkSubjects: []
  };
  if (child.examPrep) entry.examPrep = "brevet";
  return entry;
}

function buildConfig(children) {
  return {
    _lisezMoi: [
      "Configuration de cette installation de Familyo. Une famille, un deploiement.",
      "Ce fichier est le seul a modifier pour installer l'application chez une autre famille.",
      'Il est genere par : cd bootstrap && node nouvelle-famille.mjs --enfant "Prenom:Classe"',
      "Les slugs sont des URL secretes : les regenerer si l'un d'eux venait a fuiter.",
      "Aucun identifiant ne doit figurer ici - ils vivent dans les secrets Cloudflare et GitHub."
    ],
    enfants: children.map(childEntry)
  };
}

function main() {
  const args = process.argv.slice(2);
  const raws = args.flatMap((arg, index) => (arg === "--enfant" ? [args[index + 1]] : []));

  if (raws.length === 0 || raws.some((value) => value === undefined)) {
    console.error('Usage : node nouvelle-famille.mjs --enfant "Prenom:Classe" [--enfant "Prenom:Classe:brevet"]');
    process.exit(1);
  }

  const children = raws.map(parseChild);
  const parentToken = randomBytes(24).toString("base64url");
  const contents = `${JSON.stringify(buildConfig(children), null, 2)}\n`;
  const write = args.includes("--ecrire");

  console.log("=".repeat(72));
  console.log("1. CONFIGURATION - familyo.config.json");
  console.log("=".repeat(72) + "\n");

  if (write) {
    // On n'ecrase jamais une configuration existante sans le dire : ce fichier
    // porte les liens secrets d'une famille deja installee.
    if (existsSync(CONFIG_PATH) && !args.includes("--forcer")) {
      console.error(`familyo.config.json existe deja. Relancer avec --forcer pour l'ecraser.\n`);
      process.exit(1);
    }
    writeFileSync(CONFIG_PATH, contents);
    console.log(`Ecrit dans ${CONFIG_PATH}\n`);
  } else {
    console.log(contents);
    console.log("Relancer avec --ecrire pour enregistrer ce fichier directement.\n");
  }

  console.log("Deux champs restent a completer :");
  console.log("  - defaultAccentId : un identifiant de ACCENTS (src/preferences.ts)");
  console.log("  - homeworkSubjects : les matieres travaillees avec un prof particulier");
  console.log("    (le parent pourra les changer ensuite depuis ses Reglages)\n");

  console.log("=".repeat(72));
  console.log("2. SECRETS CLOUDFLARE - a saisir par le PARENT, sur SON compte");
  console.log("=".repeat(72));
  console.log("\n  npx wrangler secret put PARENT_ACCESS_TOKEN");
  console.log(`      valeur proposee : ${parentToken}`);
  console.log("\n  npx wrangler secret put GEMINI_API_KEY        (devoir maison, brevet)");
  console.log("  npx wrangler secret put NASA_API_KEY          (facultatif)");
  console.log("  npx wrangler secret put FOOTBALL_API_KEY      (facultatif)\n");

  console.log("=".repeat(72));
  console.log("3. SECRETS GITHUB - pour la synchro Pronote, si l'ecole utilise un ENT");
  console.log("=".repeat(72));
  console.log("\nD'abord, dans bootstrap/, une fois par enfant :");
  for (const child of children) {
    console.log(`  node login.mjs --url <url-pronote> --child ${child.firstName}`);
  }
  console.log("\nPuis les secrets du depot :");
  console.log("  CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, CLOUDFLARE_KV_NAMESPACE_ID");
  console.log("  SECRETS_WRITE_TOKEN   (PAT fine-grained, ce depot, permission Secrets: write)");
  for (const child of children) {
    const p = child.secretPrefix;
    console.log(`  PRONOTE_${p}_URL, PRONOTE_${p}_USERNAME, PRONOTE_${p}_PASSWORD, PRONOTE_${p}_UUID, PRONOTE_${p}_CLIENT_ID`);
  }

  console.log("\n" + "=".repeat(72));
  console.log("4. LIENS A DISTRIBUER, une fois deploye");
  console.log("=".repeat(72) + "\n");
  console.log("  Parent : /parent/?token=<PARENT_ACCESS_TOKEN>   (a ouvrir une fois, puis installer)");
  for (const child of children) {
    console.log(`  ${child.firstName.padEnd(10)} : /enfant/${child.slug}`);
    console.log(`  ${" ".repeat(10)}   prof : /prof/${child.tutorSlug}`);
  }

  console.log("\nChaque enfant et chaque prof recoit en plus un code a 5 chiffres,");
  console.log("defini par le parent depuis ses Reglages. Sans code, la page reste bloquee.\n");
  console.log("Les liens ci-dessus SONT des secrets : ils se partagent comme un mot de");
  console.log("passe, pas dans un groupe WhatsApp de classe.\n");
}

main();
