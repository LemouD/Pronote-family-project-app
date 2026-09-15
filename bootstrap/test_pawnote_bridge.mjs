// Test rapide : les identifiants produits par pronotepy (username/password
// "token") fonctionnent-ils avec pawnote.loginCredentials, tel quel ?
// N'affiche jamais les identifiants eux-memes, seulement succes/echec -
// vous n'avez donc rien a redacter avant de partager le resultat.
//
// Usage (les valeurs restent dans VOTRE terminal, jamais partagees) :
//   PRONOTE_URL="..." PRONOTE_USERNAME="..." PRONOTE_PASSWORD="..." node test_pawnote_bridge.mjs

import { AccountKind, createSessionHandle, loginCredentials, BadCredentialsError } from "pawnote";

const url = process.env.PRONOTE_URL;
const username = process.env.PRONOTE_USERNAME;
const password = process.env.PRONOTE_PASSWORD;

if (!url || !username || !password) {
  console.error("Definis PRONOTE_URL, PRONOTE_USERNAME, PRONOTE_PASSWORD (variables d'environnement) avant de lancer.");
  process.exit(1);
}

// pronotepy retourne l'URL mobile complete (avec ?fd=1&bydlg=...&login=true) ;
// pawnote attend l'URL de base. On extrait la partie utile.
const baseUrl = url.split("?")[0].replace(/\/mobile\.(eleve|parent)\.html$/, "");

console.log(`URL de base utilisee : ${baseUrl}`);
console.log("Tentative de connexion avec pawnote.loginCredentials...");

const session = createSessionHandle();
const deviceUUID = crypto.randomUUID();

try {
  const refreshed = await loginCredentials(session, {
    url: baseUrl,
    kind: AccountKind.STUDENT,
    username,
    password,
    deviceUUID
  });
  console.log("\n=== SUCCES ===");
  console.log("pawnote accepte ces identifiants ! Token obtenu (longueur:", refreshed.token.length, ")");
  console.log(`deviceUUID a utiliser : ${deviceUUID}`);
} catch (error) {
  if (error instanceof BadCredentialsError) {
    console.log("\n=== ECHEC : identifiants refuses par pawnote ===");
  } else {
    console.log(`\n=== ECHEC : ${error.constructor.name} - ${error.message} ===`);
  }
}
