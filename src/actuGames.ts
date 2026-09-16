import { cachedDaily } from "./actu";
import type { Env } from "./env";

/**
 * Jeu mis en avant, depuis FreeToGame. Aucune cle a fournir.
 *
 * Le catalogue ne porte pas de classification d'age - ni PEGI ni ESRB. Le
 * filtre est donc le choix de genres fait par le parent dans ses Reglages :
 * c'est lui qui decide ce que ses enfants voient, pas une regle ecrite ici a
 * sa place. Sans genre choisi, la categorie n'affiche rien.
 *
 * Ce sont des jeux gratuits, c'est-a-dire ceux auxquels un enfant peut
 * reellement jouer sans rien acheter.
 */

const ENDPOINT = "https://www.freetogame.com/api/games";
const TTL_SECONDS = 60 * 60 * 30;

/**
 * Genres proposes au parent, avec nos libelles. L'API en expose une vingtaine,
 * en anglais et avec des variantes proches ("RPG", "ARPG", "Action RPG") :
 * chaque entree absorbe les siennes.
 */
export const GAME_GENRES: { id: string; label: string; match: string[] }[] = [
  { id: "sport", label: "Sport", match: ["Sports"] },
  { id: "course", label: "Course", match: ["Racing"] },
  { id: "rpg", label: "Jeux de role", match: ["RPG", "ARPG", "Action RPG", "Dungeon Crawler", "Fantasy"] },
  { id: "mmorpg", label: "MMORPG", match: ["MMORPG", "MMO", "MMOARPG"] },
  { id: "strategie", label: "Strategie", match: ["Strategy"] },
  { id: "cartes", label: "Jeux de cartes", match: ["Card Game"] },
  { id: "moba", label: "MOBA", match: ["MOBA"] },
  { id: "combat", label: "Combat", match: ["Fighting"] },
  { id: "action", label: "Action", match: ["Action", "Action Game"] },
  { id: "social", label: "Social", match: ["Social"] },
  { id: "tir", label: "Jeux de tir", match: ["Shooter"] },
  { id: "battle-royale", label: "Battle royale", match: ["Battle Royale"] }
];

export function findGameGenre(id: unknown): { id: string; label: string } | undefined {
  return GAME_GENRES.find((genre) => genre.id === id);
}

export interface Game {
  title: string;
  genre: string;
  platform: string;
  description: string;
  releaseDate: string | null;
  publisher: string | null;
  imageUrl: string | null;
}

export interface GameHighlight extends Game {
  /** Libelle francais du genre retenu, pour l'affichage. */
  genreLabel: string;
}

function key(date: string): string {
  return `actu-jeux:${date}`;
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/**
 * Catalogue du jour, mis en cache une fois pour tous les enfants. Le choix des
 * genres etant propre a chaque enfant, c'est le tri qui se fait ensuite, pas
 * l'appel.
 */
export async function getGameCatalogue(env: Env, date: string): Promise<Game[] | null> {
  return cachedDaily(env, key(date), TTL_SECONDS, async () => {
    try {
      const response = await fetch(`${ENDPOINT}?sort-by=popularity`, {
        headers: { "user-agent": "devoirs-pronote/1.0 (application familiale)" },
        signal: AbortSignal.timeout(8000)
      });
      if (!response.ok) {
        console.error(`getGameCatalogue(${date}) : FreeToGame a repondu ${response.status}`);
        return null;
      }

      const body = await response.json();
      if (!Array.isArray(body)) return null;

      const games = body
        .map((raw) => {
          const entry = raw as Record<string, unknown>;
          return {
            title: text(entry.title, 80),
            // Le catalogue contient des genres mal saisis (" MMORPG" avec une
            // espace), d'ou le nettoyage avant toute comparaison.
            genre: text(entry.genre, 40),
            platform: text(entry.platform, 40),
            description: text(entry.short_description, 300),
            releaseDate: text(entry.release_date, 10) || null,
            publisher: text(entry.publisher, 60) || null,
            imageUrl: typeof entry.thumbnail === "string" ? entry.thumbnail : null
          };
        })
        .filter((game) => game.title.length > 0 && game.genre.length > 0);

      return games.length > 0 ? games : null;
    } catch (error) {
      console.error(`getGameCatalogue(${date}) failed:`, error);
      return null;
    }
  });
}

function genreFor(game: Game): { id: string; label: string } | undefined {
  const genre = game.genre.trim().toLowerCase();
  return GAME_GENRES.find((entry) => entry.match.some((name) => name.toLowerCase() === genre));
}

/**
 * Choisit le jeu du jour parmi les genres autorises. Le tirage depend de la
 * date et de l'enfant : deux enfants aux memes genres ne voient pas le meme
 * jeu, et chacun en a un nouveau chaque jour - mais toujours le meme sur la
 * journee, quel que soit le nombre de rechargements.
 */
export function pickGame(catalogue: Game[], genreIds: string[], seed: string): GameHighlight | null {
  if (genreIds.length === 0) return null;

  const allowed = catalogue
    .map((game) => ({ game, genre: genreFor(game) }))
    .filter((entry): entry is { game: Game; genre: { id: string; label: string } } => entry.genre !== undefined)
    .filter((entry) => genreIds.includes(entry.genre.id));

  if (allowed.length === 0) return null;

  let hash = 0;
  for (const character of seed) hash = (hash * 31 + character.charCodeAt(0)) % 2147483647;
  const chosen = allowed[hash % allowed.length];

  return { ...chosen.game, genreLabel: chosen.genre.label };
}

/** Raccourci : catalogue du jour puis tirage, pour un enfant donne. */
export async function getGameHighlight(
  env: Env,
  date: string,
  genreIds: string[],
  childSlug: string
): Promise<GameHighlight | null> {
  const catalogue = await getGameCatalogue(env, date);
  return catalogue ? pickGame(catalogue, genreIds, `${childSlug}:${date}`) : null;
}
