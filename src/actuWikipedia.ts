import { cachedDaily } from "./actu";
import type { Env } from "./env";

/**
 * Image du jour et ephemerides, depuis le flux quotidien de Wikipedia en
 * francais. La seule source de cette section qui soit nativement francaise :
 * ni cle a fournir, ni traduction a faire.
 *
 * On ne lit que "image" et "onthisday". La section "news" du meme flux est
 * volontairement ignoree : c'est un flux d'actualite courante, exclu par
 * principe de cette section.
 */

const TTL_SECONDS = 60 * 60 * 30;
// La fondation Wikimedia demande un User-Agent identifiable sur son API.
const USER_AGENT = "devoirs-pronote/1.0 (application familiale)";

export interface Ephemeride {
  year: number;
  text: string;
}

export interface WikipediaDay {
  date: string;
  /** Legende francaise de l'image du jour. */
  caption: string;
  imageUrl: string | null;
  ephemerides: Ephemeride[];
}

function key(date: string): string {
  return `actu-wikipedia:${date}`;
}

interface FeedImage {
  thumbnail?: { source?: unknown };
  description?: { text?: unknown; lang?: unknown };
}

interface FeedEvent {
  year?: unknown;
  text?: unknown;
}

export async function getWikipediaDay(env: Env, date: string): Promise<WikipediaDay | null> {
  return cachedDaily(env, key(date), TTL_SECONDS, async () => {
    try {
      const [year, month, day] = date.split("-");
      const response = await fetch(`https://fr.wikipedia.org/api/rest_v1/feed/featured/${year}/${month}/${day}`, {
        headers: { "user-agent": USER_AGENT },
        signal: AbortSignal.timeout(8000)
      });
      if (!response.ok) {
        console.error(`getWikipediaDay(${date}) : Wikipedia a repondu ${response.status}`);
        return null;
      }

      const body = (await response.json()) as { image?: FeedImage; onthisday?: FeedEvent[] };

      const description = body.image?.description;
      // La legende n'est pas toujours traduite : si elle ne l'est pas, mieux
      // vaut ne rien afficher qu'une phrase en allemand ou en anglais.
      const caption =
        description?.lang === "fr" && typeof description.text === "string" ? description.text.trim() : "";

      const imageUrl = typeof body.image?.thumbnail?.source === "string" ? body.image.thumbnail.source : null;

      const ephemerides = (Array.isArray(body.onthisday) ? body.onthisday : [])
        .map((event) => ({
          year: Number(event.year),
          text: typeof event.text === "string" ? event.text.trim() : ""
        }))
        .filter((event) => Number.isFinite(event.year) && event.text.length > 0)
        .slice(0, 3);

      if (!caption && !imageUrl && ephemerides.length === 0) return null;

      return { date, caption, imageUrl, ephemerides };
    } catch (error) {
      console.error(`getWikipediaDay(${date}) failed:`, error);
      return null;
    }
  });
}
