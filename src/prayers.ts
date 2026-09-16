import type { ChildConfig } from "./children";
import type { Env } from "./env";
export { todayInParis } from "./html";

/**
 * Suivi des prieres du jour, cote enfant. Aucune synchro Pronote ici : une
 * simple checklist remise a zero chaque jour, plus les horaires du jour
 * recuperes aupres d'Aladhan.
 */

/**
 * Lieu de reference pour le calcul des horaires. Sur toute l'Ile-de-France
 * l'ecart est de l'ordre de deux minutes, donc une seule ville suffit - a
 * changer ici si la famille demenage.
 *
 * method : convention de calcul des angles.
 *   12 = UOIF (Union des organisations islamiques de France)
 *    3 = Ligue islamique mondiale
 *    2 = ISNA (Amerique du Nord)
 */
export const PRAYER_LOCATION = { city: "Paris", country: "France", method: 12 };

export interface PrayerConfig {
  /** Identifiant stable, utilise comme cle de stockage - ne pas renommer. */
  id: string;
  /** Libelle affiche a l'enfant. */
  label: string;
  /** Nom du creneau chez Aladhan. */
  timingKey: string;
}

export const PRAYERS: PrayerConfig[] = [
  { id: "fajr", label: "Matin", timingKey: "Fajr" },
  { id: "dhuhr", label: "Midi", timingKey: "Dhuhr" },
  { id: "asr", label: "Apres-midi", timingKey: "Asr" },
  { id: "maghrib", label: "Soir", timingKey: "Maghrib" },
  { id: "isha", label: "Nuit", timingKey: "Isha" }
];

/** Prieres suivies par cet enfant (toutes par defaut, voir ChildConfig.prayerIds). */
export function prayersFor(child: ChildConfig): PrayerConfig[] {
  if (!child.prayerIds) return PRAYERS;
  return PRAYERS.filter((prayer) => child.prayerIds?.includes(prayer.id));
}

const TIMES_CACHE_TTL_SECONDS = 60 * 60 * 36;
const STATUS_TTL_SECONDS = 60 * 60 * 24 * 90;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function timesKey(date: string): string {
  return `prayer-times:${PRAYER_LOCATION.city}:${date}`;
}

function statusKey(child: ChildConfig, date: string): string {
  return `prayers-status:${child.slug}:${date}`;
}

/**
 * Reponse d'Aladhan : donnee externe, donc validee avant usage. On ne garde
 * que les creneaux attendus, au format HH:MM (l'API suffixe parfois le fuseau,
 * ex. "13:45 (CET)").
 */
function readTimings(body: unknown): Record<string, string> | null {
  const timings = (body as { data?: { timings?: unknown } })?.data?.timings;
  if (typeof timings !== "object" || timings === null) return null;

  const times: Record<string, string> = {};
  for (const prayer of PRAYERS) {
    const raw = (timings as Record<string, unknown>)[prayer.timingKey];
    if (typeof raw !== "string") continue;
    const time = raw.trim().split(" ")[0];
    if (TIME_PATTERN.test(time)) times[prayer.id] = time;
  }

  return Object.keys(times).length > 0 ? times : null;
}

/**
 * Horaires du jour, mis en cache en KV. L'appel part du Worker et jamais du
 * navigateur : la CSP reste en 'self' et aucune position ne transite depuis
 * l'appareil d'un enfant. Retourne null si Aladhan est injoignable - la
 * checklist doit rester utilisable sans les horaires.
 */
export async function getPrayerTimes(env: Env, date: string): Promise<Record<string, string> | null> {
  const cached = (await env.PRONOTE_CACHE.get(timesKey(date), "json")) as Record<string, string> | null;
  if (cached) return cached;

  const [year, month, day] = date.split("-");
  const url = new URL(`https://api.aladhan.com/v1/timingsByCity/${day}-${month}-${year}`);
  url.searchParams.set("city", PRAYER_LOCATION.city);
  url.searchParams.set("country", PRAYER_LOCATION.country);
  url.searchParams.set("method", String(PRAYER_LOCATION.method));

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;

    const times = readTimings(await response.json());
    if (!times) return null;

    await env.PRONOTE_CACHE.put(timesKey(date), JSON.stringify(times), { expirationTtl: TIMES_CACHE_TTL_SECONDS });
    return times;
  } catch (error) {
    console.error(`getPrayerTimes(${date}) failed:`, error);
    return null;
  }
}

export async function getPrayerStatus(env: Env, child: ChildConfig, date: string): Promise<Record<string, boolean>> {
  const stored = (await env.PRONOTE_CACHE.get(statusKey(child, date), "json")) as Record<string, boolean> | null;
  return stored ?? {};
}

export async function setPrayerStatus(
  env: Env,
  child: ChildConfig,
  date: string,
  prayerId: string,
  done: boolean
): Promise<void> {
  const status = await getPrayerStatus(env, child, date);
  status[prayerId] = done;
  await env.PRONOTE_CACHE.put(statusKey(child, date), JSON.stringify(status), { expirationTtl: STATUS_TTL_SECONDS });
}

export interface PrayerView {
  id: string;
  label: string;
  /** HH:MM, ou null si Aladhan n'a pas repondu. */
  time: string | null;
  done: boolean;
}

export async function getPrayerDay(env: Env, child: ChildConfig, date: string): Promise<PrayerView[]> {
  const [times, status] = await Promise.all([getPrayerTimes(env, date), getPrayerStatus(env, child, date)]);

  return prayersFor(child).map((prayer) => ({
    id: prayer.id,
    label: prayer.label,
    time: times?.[prayer.id] ?? null,
    done: status[prayer.id] === true
  }));
}

export function isKnownPrayerId(id: string): boolean {
  return PRAYERS.some((prayer) => prayer.id === id);
}

/**
 * Avancement du jour pour la vue parent. Ne touche pas a Aladhan : le parent
 * veut savoir ce qui est coche, pas a quelle heure - inutile de faire
 * dependre sa page d'un appel reseau externe.
 */
export async function getPrayerProgress(env: Env, child: ChildConfig, date: string): Promise<{ done: number; total: number }> {
  const status = await getPrayerStatus(env, child, date);
  const tracked = prayersFor(child);

  return { done: tracked.filter((prayer) => status[prayer.id] === true).length, total: tracked.length };
}
