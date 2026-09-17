import appleTouchIcon from "./assets/apple-touch-icon.png";
import icon192 from "./assets/icon-192.png";
import icon512 from "./assets/icon-512.png";
import iconMaskable512 from "./assets/icon-maskable-512.png";
import { FONTS } from "./fonts";
import { LOGO_GREEN } from "./logo";

/**
 * Ressources rendant l'espace parent installable (PWA). Elles ne contiennent
 * aucune donnee personnelle et sont servies SANS controle d'acces, volontairement :
 * le navigateur telecharge le manifeste sans cookies (requete "no-credentials"),
 * donc un manifeste protege par le token renverrait 403 et l'application ne
 * serait jamais proposee a l'installation.
 */

export const PWA_ASSET_PATHS = {
  manifest: "/parent/manifest.webmanifest",
  serviceWorker: "/parent/sw.js",
  icon192: "/parent/icon-192.png",
  icon512: "/parent/icon-512.png",
  iconMaskable: "/parent/icon-maskable-512.png",
  appleTouchIcon: "/parent/apple-touch-icon.png"
} as const;

// La barre de titre du systeme reprend le vert du logo : sur un telephone,
// l'application installee et son icone doivent se repondre.
export const PARENT_THEME_COLOR = LOGO_GREEN;

const MANIFEST = {
  name: "Familyo - Espace Parent",
  short_name: "Familyo",
  description: "Devoirs, notes et suivi quotidien des enfants.",
  // scope et start_url portent tous les deux le slash final : un start_url
  // hors du scope rend le manifeste invalide et bloque l'installation.
  scope: "/parent/",
  start_url: "/parent/",
  display: "standalone",
  orientation: "any",
  lang: "fr",
  background_color: "#F7F8FA",
  theme_color: PARENT_THEME_COLOR,
  icons: [
    { src: PWA_ASSET_PATHS.icon192, sizes: "192x192", type: "image/png", purpose: "any" },
    { src: PWA_ASSET_PATHS.icon512, sizes: "512x512", type: "image/png", purpose: "any" },
    { src: PWA_ASSET_PATHS.iconMaskable, sizes: "512x512", type: "image/png", purpose: "maskable" }
  ]
};

/**
 * Service worker minimal. Il existe surtout pour rendre l'application
 * installable : il ne met en cache que les ressources statiques ci-dessus.
 * Les pages elles-memes contiennent les devoirs et les notes des enfants et
 * sont servies en "no-store" - les mettre en cache sur une tablette partagee
 * contredirait cet en-tete, donc elles passent toujours par le reseau.
 */
const SERVICE_WORKER = `
// Numero a incrementer des qu'un asset statique change de contenu - le
// manifeste en fait partie. Sans ca, un appareil deja installe garderait
// l'ancien indefiniment : la strategie de lecture est "cache d'abord", et
// l'activation ne supprime que les caches dont le nom differe.
const CACHE = "parent-shell-v4";
const STATIC_ASSETS = ${JSON.stringify([
  PWA_ASSET_PATHS.manifest,
  PWA_ASSET_PATHS.icon192,
  PWA_ASSET_PATHS.icon512,
  PWA_ASSET_PATHS.iconMaskable,
  PWA_ASSET_PATHS.appleTouchIcon,
  FONTS.plexSans
])};

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!STATIC_ASSETS.includes(url.pathname)) return;

  event.respondWith(caches.match(request).then((hit) => hit || fetch(request)));
});
`;

const STATIC_CACHE_HEADERS = {
  // Ressources publiques et stables (pas de donnees personnelles) : on peut
  // les laisser en cache, contrairement aux pages.
  "cache-control": "public, max-age=86400",
  "x-content-type-options": "nosniff"
};

export function serveManifest(): Response {
  return new Response(JSON.stringify(MANIFEST), {
    headers: {
      "content-type": "application/manifest+json; charset=utf-8",
      // Fichier minuscule mais structurant (nom, couleurs, icones) : on le
      // revalide a chaque fois plutot que de figer une version obsolete
      // pendant des heures sur les appareils deja installes.
      "cache-control": "no-cache",
      "x-content-type-options": "nosniff"
    }
  });
}

export function serveServiceWorker(): Response {
  return new Response(SERVICE_WORKER, {
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      // Le script d'un service worker est revalide par le navigateur ; on
      // evite un cache long pour qu'une correction se propage vite.
      "cache-control": "no-cache",
      "x-content-type-options": "nosniff"
    }
  });
}

// Une Map plutot qu'un objet : la cle vient de l'URL, et un objet litteral
// resoudrait aussi les cles heritees de Object.prototype.
const ICONS = new Map<string, ArrayBuffer>([
  [PWA_ASSET_PATHS.icon192, icon192],
  [PWA_ASSET_PATHS.icon512, icon512],
  [PWA_ASSET_PATHS.iconMaskable, iconMaskable512],
  [PWA_ASSET_PATHS.appleTouchIcon, appleTouchIcon]
]);

export function serveIcon(path: string): Response | null {
  const icon = ICONS.get(path);
  if (!icon) return null;

  return new Response(icon, {
    headers: { "content-type": "image/png", ...STATIC_CACHE_HEADERS }
  });
}

