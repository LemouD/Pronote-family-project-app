// Bootstrap local PRONOTE + ENT/CAS/Keycloak
//
// Ce script est LOCAL uniquement.
// Il ouvre un vrai navigateur Playwright.
// L'utilisateur saisit lui-même ses identifiants ENT.
// Le script ne demande ni ne stocke le mot de passe.
//
// Il récupère ensuite les données d'appairage PRONOTE
// (jeton + login + PIN), puis passe la main a un script
// Python (qr_login.py, bibliotheque pronotepy) pour terminer
// la connexion - pawnote (JS) echoue sur cet etablissement,
// pronotepy est plus activement maintenu.
//
// Usage :
//
//   cd bootstrap
//   npm install
//   npx playwright install chromium
//   python -m venv .venv                              (une seule fois)
//   .venv/Scripts/python.exe -m pip install -r requirements.txt
//
//   node login.mjs \
//     --url https://0921233r.index-education.net/pronote \
//     --child Malick

import { chromium } from "playwright";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";


// ============================================================
// ARGUMENTS
// ============================================================

function parseArgs() {
  const args = process.argv.slice(2);

  const options = {
    account: "eleve",
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--url") {
      options.url = args[++i];
    } else if (args[i] === "--child") {
      options.child = args[++i];
    } else if (args[i] === "--account") {
      options.account = args[++i];
    }
  }

  if (!options.url || !options.child) {
    console.error(
      "Usage: node login.mjs --url <url pronote> --child <prenom>"
    );

    process.exit(1);
  }

  options.url = options.url.replace(/\/$/, "");

  return options;
}


// ============================================================
// DETECTION DES DONNEES D'APPAIRAGE
// ============================================================

function looksLikeQrPayload(body) {
  if (!body || typeof body !== "object") {
    return null;
  }

  /*
   * Forme observée sur PRONOTE moderne :
   *
   * {
   *   dataSec: {
   *     data: {
   *       jeton,
   *       login
   *     },
   *     RapportSaisie: {
   *       code
   *     }
   *   }
   * }
   */

  const data = body.dataSec?.data;
  const pin = body.dataSec?.RapportSaisie?.code;

  if (data?.jeton && pin) {
    return {
      jeton: data.jeton,
      login: data.login,
      pin,
    };
  }


  // ----------------------------------------------------------
  // Formes alternatives
  // ----------------------------------------------------------

  const direct =
    body.jeton ??
    body.token ??
    body.Jeton;

  if (direct) {
    return {
      jeton: direct,
      login:
        body.login ??
        body.Login ??
        body.username,
      pin:
        body.pin ??
        body.code ??
        body.Code ??
        body.Pin,
    };
  }


  if (body.donnees?.jeton) {
    return {
      jeton: body.donnees.jeton,
      login: body.donnees.login,
      pin: body.RapportSaisie?.code,
    };
  }


  return null;
}


// ============================================================
// MAIN
// ============================================================

async function main() {

  const options = parseArgs();

  const capturedResponses = [];
  const debugLines = [];

  let autoDetected = null;


  console.log("");
  console.log("==========================================");
  console.log(` Bootstrap ENT pour ${options.child}`);
  console.log("==========================================");
  console.log("");

  console.log("Ouverture du navigateur...");


  // ==========================================================
  // NAVIGATEUR
  // ==========================================================

  const browser = await chromium.launch({
    headless: false,
  });


  const context = await browser.newContext();

  const page = await context.newPage();


  // ==========================================================
  // URLS INTERESSANTES
  // ==========================================================

  const urlLooksRelevant = (url) => {
    return /pronote|mobile|qrcode|qr|appelfonction/i.test(url);
  };


  // ==========================================================
  // REQUEST DEBUG
  // ==========================================================

  page.on("request", (request) => {

    const url = request.url();

    if (!urlLooksRelevant(url)) {
      return;
    }

    const line =
      `REQUEST: ${request.method()} ${url}`;

    console.log(`[debug] ${line}`);

    debugLines.push(line);
  });


  // ==========================================================
  // WEBSOCKET DEBUG
  // ==========================================================

  // On note seulement qu'une connexion websocket s'est ouverte (utile pour
  // savoir si Pronote en utilise une) - jamais le contenu des frames, qui
  // pourrait contenir des donnees Pronote sensibles (notes, messages...).
  page.on("websocket", (ws) => {

    const line =
      `WEBSOCKET: ${ws.url()}`;

    console.log(`[debug] ${line}`);

    debugLines.push(line);
  });


  // ==========================================================
  // RESPONSE LISTENER
  // ==========================================================

  page.on("response", async (response) => {

    const url = response.url();


    if (urlLooksRelevant(url)) {

      const line =
        `RESPONSE: ${response.status()} ${url}`;

      console.log(`[debug] ${line}`);

      debugLines.push(line);
    }


    const contentType =
      response.headers()["content-type"] || "";


    if (!contentType.toLowerCase().includes("json")) {
      return;
    }


    try {

      const body = await response.json();

      const bodyText =
        JSON.stringify(body);


      // ------------------------------------------------------
      // Capture debug
      // ------------------------------------------------------

      if (
        /jeton|mobile|appli|qrcode|\bpin\b/i.test(bodyText) ||
        urlLooksRelevant(url)
      ) {

        capturedResponses.push({
          url,
          status: response.status(),
          body,
        });
      }


      // ------------------------------------------------------
      // Détection du QR
      // ------------------------------------------------------

      const detected =
        looksLikeQrPayload(body);


      if (
        detected?.jeton &&
        detected?.pin &&
        !autoDetected
      ) {

        autoDetected = detected;

        console.log("");
        console.log("==========================================");
        console.log(" DONNEES D'APPAIRAGE DETECTEES");
        console.log("==========================================");
        console.log("");

        console.log(
          `[debug] login : ${detected.login ?? "(inconnu)"}`
        );

        console.log(
          `[debug] PIN : ${detected.pin}`
        );

        console.log(
          `[debug] jeton : détecté`
        );

        console.log("");
      }

    } catch {
      // Réponse non JSON : rien à faire
    }
  });


  // ==========================================================
  // CONNEXION ENT
  // ==========================================================

  const loginUrl =
    `${options.url}/${options.account}.html?login=true`;


  console.log("");
  console.log(`Ouverture : ${loginUrl}`);
  console.log("");


  await page.goto(loginUrl, {
    waitUntil: "domcontentloaded",
  });


  console.log(
    ">>> Connectez-vous avec vos identifiants ENT dans la fenêtre."
  );

  console.log(
    ">>> Le script ne récupère pas votre mot de passe."
  );

  console.log(
    ">>> Attente de l'arrivée sur PRONOTE : 5 minutes maximum."
  );

  console.log("");


  // ==========================================================
  // ATTENTE CONNEXION
  // ==========================================================

  const pronoteOrigin =
    new URL(options.url).origin;


  const deadline =
    Date.now() + 5 * 60 * 1000;


  let loggedIn = false;


  while (Date.now() < deadline) {

    const currentUrl = page.url();


    if (
      currentUrl.startsWith(pronoteOrigin) &&
      currentUrl.includes(options.account)
    ) {

      loggedIn = true;

      break;
    }


    await page.waitForTimeout(1000);
  }


  if (!loggedIn) {

    console.error(
      "Connexion non détectée après 5 minutes, abandon."
    );

    await browser.close();

    process.exit(1);
  }


  // ==========================================================
  // URL PRONOTE REELLE
  // ==========================================================

  const pronotePageUrl = page.url();


  console.log("");
  console.log("==========================================");
  console.log(" CONNEXION PRONOTE DETECTEE");
  console.log("==========================================");
  console.log("");

  console.log(
    `URL PRONOTE : ${pronotePageUrl}`
  );

  debugLines.push(
    `PRONOTE PAGE URL: ${pronotePageUrl}`
  );


  // ==========================================================
  // DEMANDE DU QR CODE
  // ==========================================================

  console.log("");

  console.log(
    ">>> Dans PRONOTE, ouvrez votre profil."
  );

  console.log(
    '>>> Cherchez "Connexion de l’application mobile"'
  );

  console.log(
    '>>> ou "Envoyer vers l’espace mobile".'
  );

  console.log("");

  console.log(
    ">>> Affichez ensuite le QR code / code d'appairage."
  );

  console.log("");


  const rl =
    createInterface({
      input: process.stdin,
      output: process.stdout,
    });


  await rl.question(
    "Une fois l'écran d'appairage affiché, appuyez sur Entrée ici... "
  );


  rl.close();


  // ==========================================================
  // DIAGNOSTICS
  // ==========================================================

  async function saveDiagnostics(reason) {

    const screenshotPath =
      fileURLToPath(
        new URL(
          "./last-run-screenshot.png",
          import.meta.url
        )
      );


    await page
      .screenshot({
        path: screenshotPath,
        fullPage: true,
      })
      .catch(() => {});


    const logPath =
      fileURLToPath(
        new URL(
          "./last-run-log.json",
          import.meta.url
        )
      );


    writeFileSync(
      logPath,
      JSON.stringify(
        {
          reason,
          debugLines,
          capturedResponses,
        },
        null,
        2
      )
    );


    console.error("");
    console.error("==========================================");
    console.error(" ECHEC");
    console.error("==========================================");
    console.error("");

    console.error(reason);

    console.error("");

    console.error(
      `Log : ${logPath}`
    );

    console.error(
      `Screenshot : ${screenshotPath}`
    );

    console.error("");

    console.error(
      "ATTENTION : le fichier de log peut contenir "
      + "des données PRONOTE sensibles."
    );

    console.error(
      "Ne le partage pas publiquement."
    );
  }


  // ==========================================================
  // VERIFICATION QR
  // ==========================================================

  if (
    !autoDetected?.jeton ||
    !autoDetected?.pin
  ) {

    await saveDiagnostics(
      "Impossible de détecter automatiquement le jeton/PIN."
    );

    await browser.close();

    process.exit(1);
  }


  console.log("");
  console.log(
    "Données d'appairage récupérées."
  );

  console.log(
    "Passage la main a pronotepy (Python) pour terminer la connexion..."
  );

  console.log("");


  // ==========================================================
  // DEVICE UUID
  // ==========================================================

  const deviceUUID =
    randomUUID();


  console.log(
    `[debug] deviceUUID : ${deviceUUID}`
  );


  // ==========================================================
  // APPEL DE pronotepy (bibliotheque Python plus activement
  // maintenue que pawnote, testee par la communaute sur ce
  // meme type d'ENT). Playwright a fait la partie ENT/CAS et
  // recupere le jeton/pin ; pronotepy gere seul, a partir de
  // la, tout le protocole PRONOTE (chiffrement, requetes).
  // ==========================================================

  const pythonPath = fileURLToPath(
    new URL("./.venv/Scripts/python.exe", import.meta.url)
  );

  const scriptPath = fileURLToPath(
    new URL("./qr_login.py", import.meta.url)
  );

  const payload = JSON.stringify({
    jeton: autoDetected.jeton,
    login: autoDetected.login,
    pin: String(autoDetected.pin),
    url: `${options.url}/mobile.${options.account}.html`,
    uuid: deviceUUID
  });

  console.log("");
  console.log(
    "Appel de pronotepy..."
  );
  console.log("");

  const { spawnSync } = await import("node:child_process");
  const result = spawnSync(pythonPath, [scriptPath], {
    input: payload,
    encoding: "utf8"
  });

  if (result.error) {
    await saveDiagnostics(
      `Impossible de lancer pronotepy (python introuvable ?) : ${result.error.message}`
    );
    await browser.close();
    process.exit(1);
  }

  let parsed;
  try {
    // pronotepy peut logger des warnings sur stdout ; le JSON est la derniere ligne.
    const lastLine = result.stdout.trim().split("\n").pop();
    parsed = JSON.parse(lastLine);
  } catch {
    await saveDiagnostics(
      `pronotepy n'a pas produit de sortie JSON valide.\nstdout: ${result.stdout}\nstderr: ${result.stderr}`
    );
    await browser.close();
    process.exit(1);
  }

  if (!parsed.ok) {
    await saveDiagnostics(`pronotepy a echoue : ${parsed.error}`);
    await browser.close();
    process.exit(1);
  }


  // ==========================================================
  // FIN
  // ==========================================================

  await browser.close();


  console.log("");
  console.log("==========================================");
  console.log(" SUCCES (via pronotepy)");
  console.log("==========================================");
  console.log("");

  console.log(
    "pronotepy a reussi la connexion la ou pawnote echouait."
  );
  console.log(
    "Etape suivante a discuter : comment faire utiliser ces identifiants"
  );
  console.log(
    "par le Worker (qui tourne en TypeScript/pawnote, pas en Python)."
  );
  console.log("");
  console.log("Identifiants obtenus (ne pas partager, ne pas commiter) :");
  console.log("");
  console.log(JSON.stringify(parsed.credentials, null, 2));
  console.log("");
}


// ============================================================
// ERREUR GLOBALE
// ============================================================

main().catch((error) => {

  console.error("");

  console.error(
    "Erreur inattendue :"
  );

  console.error(
    error?.stack ?? error
  );

  process.exit(1);
});