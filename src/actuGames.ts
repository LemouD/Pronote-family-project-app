import { cachedDaily, readSecret } from "./actu";
import type { Env } from "./env";

/**
 * Jeu mis en avant, depuis RAWG. Une entree par jour partagee par tous les
 * enfants : le quota gratuit est large mais pas infini, et le contenu n'a
 * aucune raison de differer d'un enfant a l'autre.
 */

const ENDPOINT = "https://api.rawg.io/api/games";
const TTL_SECONDS = 60 * 60 * 30;

/**
 * Classements d'age acceptes. RAWG expose l'ESRB : on ne garde que ce qui
 * convient a un ado, et on ecarte aussi les jeux non classes plutot que de
 * parier dessus - la section entiere repose sur l'idee que rien de non filtre
 * n'arrive chez un enfant.
 */
const ALLOWED_RATINGS = new Set(["everyone", "everyone-10-plus", "teen"]);

export interface GameHighlight {
  name: string;
  released: string | null;
  rating: number | null;
  ratingLabel: string | null;
  platforms: string[];
  genres: string[];
  imageUrl: string | null;
}

function key(date: string): string {
  return `actu-jeux:${date}`;
}

interface RawgGame {
  name?: unknown;
  released?: unknown;
  rating?: unknown;
  background_image?: unknown;
  esrb_rating?: { slug?: unknown; name?: unknown } | null;
  platforms?: { platform?: { name?: unknown } }[];
  genres?: { name?: unknown }[];
}

function readGame(raw: RawgGame): GameHighlight | null {
  if (typeof raw.name !== "string" || raw.name.length === 0) return null;

  const slug = raw.esrb_rating?.slug;
  if (typeof slug !== "string" || !ALLOWED_RATINGS.has(slug)) return null;

  return {
    name: raw.name,
    released: typeof raw.released === "string" ? raw.released : null,
    rating: typeof raw.rating === "number" && raw.rating > 0 ? raw.rating : null,
    ratingLabel: typeof raw.esrb_rating?.name === "string" ? raw.esrb_rating.name : null,
    platforms: (raw.platforms ?? [])
      .map((entry) => entry.platform?.name)
      .filter((name): name is string => typeof name === "string")
      .slice(0, 4),
    genres: (raw.genres ?? [])
      .map((entry) => entry.name)
      .filter((name): name is string => typeof name === "string")
      .slice(0, 3),
    imageUrl: typeof raw.background_image === "string" ? raw.background_image : null
  };
}

/** Fenetre de sortie : les trois derniers mois, pour rester sur de l'actualite. */
function releaseWindow(date: string): string {
  const end = new Date(`${date}T00:00:00Z`);
  const start = new Date(end);
  start.setUTCMonth(start.getUTCMonth() - 3);
  return `${start.toISOString().slice(0, 10)},${date}`;
}

export async function getGameHighlight(env: Env, date: string): Promise<GameHighlight | null> {
  return cachedDaily(env, key(date), TTL_SECONDS, async () => {
    const apiKey = readSecret(env, "RAWG_API_KEY");
    if (!apiKey) return null;

    try {
      const url = new URL(ENDPOINT);
      url.searchParams.set("key", apiKey);
      url.searchParams.set("dates", releaseWindow(date));
      url.searchParams.set("ordering", "-added");
      // On en demande plusieurs pour pouvoir en ecarter : le premier jeu du
      // classement est souvent classe Mature.
      url.searchParams.set("page_size", "40");

      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) {
        console.error(`getGameHighlight(${date}) : RAWG a repondu ${response.status}`);
        return null;
      }

      const body = (await response.json()) as { results?: RawgGame[] };
      const results = Array.isArray(body.results) ? body.results : [];

      // Un jour donne choisit toujours le meme jeu de la liste retenue, mais
      // le choix tourne d'un jour a l'autre.
      const eligible = results.map(readGame).filter((game): game is GameHighlight => game !== null);
      if (eligible.length === 0) return null;

      const day = Number(date.slice(8, 10)) || 1;
      return eligible[day % eligible.length];
    } catch (error) {
      console.error(`getGameHighlight(${date}) failed:`, error);
      return null;
    }
  });
}
