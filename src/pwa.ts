import appleTouchIcon from "./assets/apple-touch-icon.png";
import icon192 from "./assets/icon-192.png";
import icon512 from "./assets/icon-512.png";
import iconMaskable512 from "./assets/icon-maskable-512.png";
import type { ChildConfig } from "./children";
import { FONTS } from "./fonts";
import { LOGO_GREEN } from "./logo";
import type { AccentPreset } from "./preferences";

/**
 * Ressources rendant les espaces installables (PWA). Elles ne contiennent
 * aucune donnee personnelle et sont servies SANS controle d'acces, volontairement :
 * le navigateur telecharge le manifeste sans cookies (requete "no-credentials"),
 * donc un manifeste protege par le token renverrait 403 et l'application ne
 * serait jamais proposee a l'installation.
 *
 * Chaque espace a son propre manifeste et son propre service worker, parce que
 * chacun a sa portee : le parent sur /parent/, chaque enfant sur son
 * /enfant/<slug>/. Un manifeste unique ferait de tout le site une seule
 * application, et ouvrir l'icone de Codou tomberait sur l'espace parent.
 */

export const PWA_ASSET_PATHS = {
  manifest: "/parent/manifest.webmanifest",
  serviceWorker: "/parent/sw.js"
} as const;

/**
 * Les icones sont les memes pour tout le monde : une famille, une identite.
 * Ce qui distingue les applications installees sur un appareil, c'est leur
 * nom ("Familyo - Codou") et leur couleur de barre de statut.
 *
 * Leur chemin est neutre, en dehors de /parent/, parce que les manifestes des
 * enfants s'en servent aussi.
 */
export const ICON_PATHS = {
  icon192: "/icons/familyo-192.png",
  icon512: "/icons/familyo-512.png",
  maskable: "/icons/familyo-maskable-512.png",
  appleTouch: "/icons/familyo-apple-touch.png"
} as const;

/** Sous-chemins, sous /enfant/<slug>, ou le routeur reconnait ces ressources. */
export const CHILD_PWA_SUFFIX = {
  manifest: "/manifest.webmanifest",
  serviceWorker: "/sw.js"
} as const;

export function childManifestPath(child: ChildConfig): string {
  return `/enfant/${child.slug}${CHILD_PWA_SUFFIX.manifest}`;
}

export function childServiceWorkerPath(child: ChildConfig): string {
  return `/enfant/${child.slug}${CHILD_PWA_SUFFIX.serviceWorker}`;
}

// La barre de titre du systeme reprend le vert du logo : sur un telephone,
// l'application installee et son icone doivent se repondre. Cote enfant, c'est
// la couleur que l'enfant a choisie qui prend ce role.
export const PARENT_THEME_COLOR = LOGO_GREEN;

const ICONS_FOR_MANIFEST = [
  { src: ICON_PATHS.icon192, sizes: "192x192", type: "image/png", purpose: "any" },
  { src: ICON_PATHS.icon512, sizes: "512x512", type: "image/png", purpose: "any" },
  { src: ICON_PATHS.maskable, sizes: "512x512", type: "image/png", purpose: "maskable" }
];

const PARENT_MANIFEST = {
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
  icons: ICONS_FOR_MANIFEST
};

function childManifest(child: ChildConfig, accent: AccentPreset): unknown {
  return {
    name: `Familyo - ${child.displayName}`,
    // Le nom court est celui qui s'affiche sous l'icone, ou la place manque :
    // le prenom seul suffit a distinguer les deux tablettes.
    short_name: child.displayName,
    description: `Devoirs, revisions et journee de ${child.displayName}.`,
    scope: `/enfant/${child.slug}/`,
    start_url: `/enfant/${child.slug}/`,
    display: "standalone",
    orientation: "any",
    lang: "fr",
    background_color: "#FFF8EC",
    theme_color: accent.light,
    icons: ICONS_FOR_MANIFEST
  };
}

/**
 * Service worker minimal. Il existe surtout pour rendre l'application
 * installable - Chrome refuse de proposer l'installation sans lui - et il ne
 * met en cache que les ressources statiques qu'on lui donne.
 *
 * Les pages elles-memes contiennent les devoirs et les notes des enfants et
 * sont servies en "no-store" - les mettre en cache sur une tablette partagee
 * contredirait cet en-tete, donc elles passent toujours par le reseau.
 *
 * Le nom du cache est a incrementer des qu'un asset statique change de
 * contenu - le manifeste en fait partie. Sans ca, un appareil deja installe
 * garderait l'ancien indefiniment : la strategie de lecture est "cache
 * d'abord", et l'activation ne supprime que les caches dont le nom differe.
 */
function serviceWorkerScript(cache: string, assets: string[]): string {
  return `
const CACHE = ${JSON.stringify(cache)};
const STATIC_ASSETS = ${JSON.stringify(assets)};

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
}

const ICON_ASSETS = [ICON_PATHS.icon192, ICON_PATHS.icon512, ICON_PATHS.maskable, ICON_PATHS.appleTouch];

const PARENT_SERVICE_WORKER = serviceWorkerScript("parent-shell-v6", [
  PWA_ASSET_PATHS.manifest,
  // Le logo de l'en-tete passe par <img src="/favicon.svg"> (voir
  // parentShell.ts) : sans lui dans le cache, la barre du telephone perdrait
  // sa vignette hors ligne.
  "/favicon.svg",
  ...ICON_ASSETS,
  FONTS.plexSans,
  FONTS.lora
]);

const STATIC_CACHE_HEADERS = {
  // Ressources publiques et stables (pas de donnees personnelles) : on peut
  // les laisser en cache, contrairement aux pages.
  "cache-control": "public, max-age=86400",
  "x-content-type-options": "nosniff"
};

function manifestResponse(manifest: unknown): Response {
  return new Response(JSON.stringify(manifest), {
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

function serviceWorkerResponse(script: string): Response {
  return new Response(script, {
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      // Le script d'un service worker est revalide par le navigateur ; on
      // evite un cache long pour qu'une correction se propage vite.
      "cache-control": "no-cache",
      "x-content-type-options": "nosniff"
    }
  });
}

export function serveManifest(): Response {
  return manifestResponse(PARENT_MANIFEST);
}

export function serveServiceWorker(): Response {
  return serviceWorkerResponse(PARENT_SERVICE_WORKER);
}

export function serveChildManifest(child: ChildConfig, accent: AccentPreset): Response {
  return manifestResponse(childManifest(child, accent));
}

export function serveChildServiceWorker(child: ChildConfig): Response {
  // Le cache porte le slug : deux enfants peuvent partager un meme appareil
  // sans que l'un vide le cache de l'autre a l'activation.
  return serviceWorkerResponse(
    serviceWorkerScript(`enfant-${child.slug}-v1`, [
      childManifestPath(child),
      ...ICON_ASSETS,
      FONTS.nunito,
      FONTS.baloo2
    ])
  );
}

// Une Map plutot qu'un objet : la cle vient de l'URL, et un objet litteral
// resoudrait aussi les cles heritees de Object.prototype.
const ICONS = new Map<string, ArrayBuffer>([
  [ICON_PATHS.icon192, icon192],
  [ICON_PATHS.icon512, icon512],
  [ICON_PATHS.maskable, iconMaskable512],
  [ICON_PATHS.appleTouch, appleTouchIcon],
  // Anciens chemins, gardes en service : un appareil qui a installe l'espace
  // parent avant que les icones deviennent communes garde l'ancien manifeste
  // en memoire et redemande ces URL-la. Memes octets.
  ["/parent/icon-192.png", icon192],
  ["/parent/icon-512.png", icon512],
  ["/parent/icon-maskable-512.png", iconMaskable512],
  ["/parent/apple-touch-icon.png", appleTouchIcon]
]);

export function serveIcon(path: string): Response | null {
  const icon = ICONS.get(path);
  if (!icon) return null;

  return new Response(icon, {
    headers: { "content-type": "image/png", ...STATIC_CACHE_HEADERS }
  });
}
