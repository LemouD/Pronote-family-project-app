import { cachedDaily, readSecret } from "./actu";
import type { Env } from "./env";
import { translateSpacePicture } from "./gemini";

/**
 * Image du jour de la NASA (APOD). Une entree par jour, partagee par tous les
 * enfants qui ont la categorie active : la NASA publie la meme image pour
 * tout le monde, un appel par enfant n'aurait aucun sens.
 */

const ENDPOINT = "https://api.nasa.gov/planetary/apod";
const TTL_SECONDS = 60 * 60 * 30;

export interface SpacePicture {
  date: string;
  title: string;
  summary: string;
  /** Absent les jours ou la NASA publie une video. */
  imageUrl: string | null;
  /** true quand le texte a ete traduit ; false = il est reste en anglais. */
  translated: boolean;
}

function key(date: string): string {
  return `actu-espace:${date}`;
}

/** La reponse de la NASA est une donnee externe : validee avant usage. */
function readApod(body: unknown): { title: string; explanation: string; imageUrl: string | null } | null {
  const raw = body as { title?: unknown; explanation?: unknown; url?: unknown; media_type?: unknown };
  if (typeof raw?.title !== "string" || typeof raw.explanation !== "string") return null;

  // Les jours de video, l'url pointe vers un lecteur tiers. On ne l'affiche
  // pas : integrer YouTube dans la page d'un enfant ferait entrer des
  // recommandations et des commentaires que personne n'a filtres. Le texte,
  // lui, reste interessant.
  const imageUrl = raw.media_type === "image" && typeof raw.url === "string" ? raw.url : null;

  return { title: raw.title, explanation: raw.explanation, imageUrl };
}

export async function getSpacePicture(env: Env, date: string): Promise<SpacePicture | null> {
  return cachedDaily(env, key(date), TTL_SECONDS, async () => {
    const apiKey = readSecret(env, "NASA_API_KEY");
    if (!apiKey) return null;

    let apod;
    try {
      const url = new URL(ENDPOINT);
      url.searchParams.set("api_key", apiKey);
      url.searchParams.set("date", date);

      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) {
        console.error(`getSpacePicture(${date}) : NASA a repondu ${response.status}`);
        return null;
      }
      apod = readApod(await response.json());
    } catch (error) {
      console.error(`getSpacePicture(${date}) failed:`, error);
      return null;
    }

    if (!apod) return null;

    // La NASA ecrit en anglais, avec un millier de caracteres de texte
    // technique. On demande une version francaise courte - et si la
    // traduction echoue, on garde l'anglais plutot que de perdre la carte.
    const translated = await translateSpacePicture(env, apod).catch((error) => {
      console.error(`translateSpacePicture(${date}) failed:`, error);
      return null;
    });

    return {
      date,
      title: translated?.titre ?? apod.title,
      summary: translated?.resume ?? apod.explanation,
      imageUrl: apod.imageUrl,
      translated: translated !== null
    };
  });
}
