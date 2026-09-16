import type { ChildConfig } from "./children";
import { GAME_GENRES } from "./actuGames";
import type { Env } from "./env";

/**
 * Section "Actu" : de la curiosite, pas de l'actualite. Le contenu vient
 * toujours de sources structurees - une image de la NASA, une fiche de jeu,
 * une question de quiz, un resultat de match - et jamais d'un flux de presse
 * ou de reseau social. Le schema de la source est le filtre : il n'y a aucun
 * endroit par lequel du texte libre non modere pourrait arriver chez un
 * enfant.
 *
 * Le nom affiche tient dans cette seule constante ; "actu" reste le nom de
 * code des routes, des cles KV et des identifiants, qui n'ont pas a bouger
 * avec lui.
 */
export const ACTU_LABEL = "Mon Radar";

export type ActuCategoryId = "wikipedia" | "espace" | "jeux-video" | "quiz" | "foot";

export interface ActuCategory {
  id: ActuCategoryId;
  label: string;
  /** Explique au parent ce que l'enfant verra s'il coche la case. */
  description: string;
  /** Secret Cloudflare sans lequel la categorie ne peut rien afficher. */
  secret?: string;
}

/**
 * Catalogue ouvert : ajouter une categorie plus tard (une source musique par
 * exemple) se limite a une entree ici plus son module, sans toucher au reste.
 */
export const ACTU_CATEGORIES: ActuCategory[] = [
  {
    id: "wikipedia",
    label: "Image du jour et histoire",
    description:
      "L'image du jour de Wikipedia, et ce qui s'est passe un meme jour dans l'histoire. Seule source nativement francaise ; les ephemerides evoquent parfois des evenements durs (guerres, catastrophes)."
  },
  {
    id: "espace",
    label: "Espace et sciences",
    description: "L'image du jour de la NASA, avec son explication traduite.",
    secret: "NASA_API_KEY"
  },
  {
    id: "jeux-video",
    label: "Jeux video",
    description:
      "Un jeu gratuit mis en avant. Le catalogue ne porte aucune classification d'age : les genres coches ci-dessous sont le seul filtre."
  },
  {
    id: "quiz",
    label: "Quiz et culture generale",
    description: "Une question par jour, dans le theme choisi ci-dessous.",
  },
  {
    id: "foot",
    label: "Foot",
    description: "Les derniers resultats du club choisi ci-dessous.",
    secret: "FOOTBALL_API_KEY"
  }
];

export function findCategory(id: unknown): ActuCategory | undefined {
  return ACTU_CATEGORIES.find((category) => category.id === id);
}

/** true si le secret de cette categorie est present sur le Worker. */
export function isCategoryConfigured(env: Env, category: ActuCategory): boolean {
  if (!category.secret) return true;
  const value = env[category.secret];
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Themes de quiz proposes au parent. Sous-ensemble choisi des categories
 * d'Open Trivia DB, avec nos propres libelles : l'API les nomme en anglais et
 * en propose une vingtaine, dont plusieurs sans interet pour un ado.
 */
export const QUIZ_THEMES: { id: number; label: string }[] = [
  { id: 9, label: "Culture generale" },
  { id: 12, label: "Musique" },
  { id: 26, label: "Celebrites" },
  { id: 17, label: "Sciences et nature" },
  { id: 27, label: "Animaux" },
  { id: 22, label: "Geographie" },
  { id: 23, label: "Histoire" },
  { id: 21, label: "Sport" },
  { id: 15, label: "Jeux video" },
  { id: 31, label: "Manga et anime" }
];

export const DEFAULT_QUIZ_THEME = 9;

export function findQuizTheme(id: unknown): { id: number; label: string } | undefined {
  const value = Number(id);
  return QUIZ_THEMES.find((theme) => theme.id === value);
}

/** Club suivi par un enfant, choisi par le parent dans une liste fermee. */
export interface FootballChoice {
  competitionCode: string;
  competitionName: string;
  teamId: number;
  teamName: string;
  crest: string | null;
}

export interface ActuConfig {
  /** false = l'onglet n'apparait pas du tout chez l'enfant. */
  active: boolean;
  categories: ActuCategoryId[];
  quizTheme: number;
  /** Genres de jeux autorises par le parent. Vide = la categorie n'affiche rien. */
  gameGenres: string[];
  football: FootballChoice | null;
}

function configKey(child: ChildConfig): string {
  return `actu-config:${child.slug}`;
}

/**
 * Tout est eteint par defaut. C'est le parent qui allume la section, jamais
 * l'inverse : un enfant ne doit pas decouvrir un onglet que personne n'a
 * decide de lui ouvrir.
 */
function emptyConfig(): ActuConfig {
  return { active: false, categories: [], quizTheme: DEFAULT_QUIZ_THEME, gameGenres: [], football: null };
}

function readConfig(stored: unknown): ActuConfig {
  if (typeof stored !== "object" || stored === null) return emptyConfig();
  const raw = stored as Partial<ActuConfig>;

  const football =
    typeof raw.football === "object" && raw.football !== null && typeof raw.football.teamId === "number"
      ? {
          competitionCode: String(raw.football.competitionCode ?? ""),
          competitionName: String(raw.football.competitionName ?? ""),
          teamId: raw.football.teamId,
          teamName: String(raw.football.teamName ?? ""),
          crest: typeof raw.football.crest === "string" ? raw.football.crest : null
        }
      : null;

  return {
    active: raw.active === true,
    // Une categorie retiree du catalogue disparait d'elle-meme des configs
    // existantes, sans migration a ecrire.
    categories: Array.isArray(raw.categories)
      ? ACTU_CATEGORIES.filter((category) => raw.categories?.includes(category.id)).map((category) => category.id)
      : [],
    quizTheme: findQuizTheme(raw.quizTheme)?.id ?? DEFAULT_QUIZ_THEME,
    gameGenres: Array.isArray(raw.gameGenres)
      ? GAME_GENRES.filter((genre) => raw.gameGenres?.includes(genre.id)).map((genre) => genre.id)
      : [],
    football
  };
}

export async function getActuConfig(env: Env, child: ChildConfig): Promise<ActuConfig> {
  return readConfig(await env.PRONOTE_CACHE.get(configKey(child), "json"));
}

export async function saveActuConfig(env: Env, child: ChildConfig, config: ActuConfig): Promise<void> {
  await env.PRONOTE_CACHE.put(configKey(child), JSON.stringify(config));
}

/**
 * Categories reellement affichables : cochee par le parent, et dont le secret
 * est en place. Une categorie cochee mais sans cle ne doit pas produire une
 * carte vide chez l'enfant - c'est au parent qu'on le signale, dans Reglages.
 */
export function usableCategories(env: Env, config: ActuConfig): ActuCategory[] {
  if (!config.active) return [];

  return ACTU_CATEGORIES.filter((category) => {
    if (!config.categories.includes(category.id)) return false;
    if (!isCategoryConfigured(env, category)) return false;
    // Le foot ne sert a rien tant qu'aucun club n'a ete choisi, ni les jeux
    // tant qu'aucun genre n'est autorise : mieux vaut pas de carte qu'une
    // carte vide, ou pire, un jeu que personne n'a valide.
    if (category.id === "foot" && !config.football) return false;
    if (category.id === "jeux-video" && config.gameGenres.length === 0) return false;
    return true;
  });
}

export function isActuVisible(env: Env, config: ActuConfig): boolean {
  return usableCategories(env, config).length > 0;
}

/**
 * Cache KV partage par les modules de source. Chaque categorie garde sa
 * propre cle et sa propre duree ; seule la mecanique est commune.
 *
 * Un seul appel externe par jour sert tous les enfants qui ont la categorie
 * active : le Worker ne fait jamais un appel par enfant, ce qui garderait
 * difficilement les quotas gratuits.
 *
 * Un echec n'est pas mis en cache - la source sera retentee au prochain
 * chargement plutot que de rester en panne jusqu'a demain.
 */
export async function cachedDaily<T>(
  env: Env,
  key: string,
  ttlSeconds: number,
  load: () => Promise<T | null>
): Promise<T | null> {
  const cached = (await env.PRONOTE_CACHE.get(key, "json")) as T | null;
  if (cached) return cached;

  const fresh = await load();
  if (!fresh) return null;

  await env.PRONOTE_CACHE.put(key, JSON.stringify(fresh), { expirationTtl: ttlSeconds });
  return fresh;
}

/**
 * Hotes autorises pour le relais d'images. Les images des sources ne sont
 * jamais chargees par le navigateur : elles passent par le Worker, sinon il
 * faudrait ouvrir la CSP img-src a trois tiers et laisser la tablette d'un
 * enfant les contacter directement. Meme raison que les polices hebergees
 * ici plutot que chez Google.
 *
 * L'URL relayee vient toujours du cache d'une categorie, jamais de la
 * requete ; cette liste est la deuxieme barriere.
 */
const ALLOWED_IMAGE_HOSTS = new Set([
  "apod.nasa.gov",
  "media.rawg.io",
  "crests.football-data.org",
  "www.freetogame.com",
  "thumb.wikimedia.org",
  "upload.wikimedia.org"
]);

export async function proxyImage(source: string): Promise<Response> {
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    return new Response("Image introuvable.", { status: 404 });
  }

  if (url.protocol !== "https:" || !ALLOWED_IMAGE_HOSTS.has(url.hostname)) {
    return new Response("Image introuvable.", { status: 404 });
  }

  try {
    // Wikimedia refuse les requetes sans agent identifiable ; les autres
    // sources s'en moquent, mais un en-tete commun ne coute rien.
    const response = await fetch(url, {
      headers: { "user-agent": "devoirs-pronote/1.0 (application familiale)" },
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) {
      console.error(`proxyImage(${url.hostname}) : ${response.status}`);
      return new Response("Image indisponible.", { status: 502 });
    }

    const type = response.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) {
      console.error(`proxyImage(${url.hostname}) : type inattendu "${type}"`);
      return new Response("Image indisponible.", { status: 502 });
    }

    return new Response(response.body, {
      headers: {
        "content-type": type,
        // L'image du jour ne change pas dans la journee, et elle ne dit rien
        // de personnel : elle peut etre gardee par le navigateur.
        "cache-control": "private, max-age=21600"
      }
    });
  } catch (error) {
    console.error(`proxyImage(${url.hostname}) failed:`, error);
    return new Response("Image indisponible.", { status: 502 });
  }
}

/** Lit un secret de categorie, ou null s'il n'est pas configure. */
export function readSecret(env: Env, name: string): string | null {
  const value = env[name];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
