import type { ChildConfig } from "./children";
import type { Env } from "./env";
export { todayInParis } from "./html";

/**
 * Suivi des prieres du jour, cote enfant. Aucune synchro Pronote ici : une
 * simple checklist remise a zero chaque jour, plus les horaires du jour
 * recuperes aupres d'Aladhan.
 */

/**
 * Lieu de reference pour le calcul des horaires, modifiable par le parent
 * dans ses Reglages. A l'echelle d'une agglomeration l'ecart est de l'ordre
 * de deux minutes : une seule ville suffit pour toute la famille.
 */
export interface PrayerLocation {
  city: string;
  country: string;
  /** Convention de calcul des angles (voir CALCULATION_METHODS). */
  method: number;
}

export const DEFAULT_PRAYER_LOCATION: PrayerLocation = { city: "Paris", country: "France", method: 12 };

/** Conventions proposees au parent. Liste fermee : Aladhan les numerote. */
export const CALCULATION_METHODS: { id: number; label: string }[] = [
  { id: 12, label: "UOIF (France)" },
  { id: 3, label: "Ligue islamique mondiale" },
  { id: 2, label: "ISNA (Amerique du Nord)" },
  { id: 5, label: "Autorite generale egyptienne" },
  { id: 4, label: "Umm al-Qura (Arabie saoudite)" }
];

export function findMethod(id: unknown): { id: number; label: string } | undefined {
  const value = Number(id);
  return CALCULATION_METHODS.find((method) => method.id === value);
}

const LOCATION_KEY = "prayer-location";
const MAX_PLACE_LENGTH = 60;

function cleanPlace(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, MAX_PLACE_LENGTH);
}

export function validateLocation(input: { city?: unknown; country?: unknown; method?: unknown }): PrayerLocation | null {
  const city = cleanPlace(input.city);
  const country = cleanPlace(input.country);
  const method = findMethod(input.method);
  if (!city || !country || !method) return null;
  return { city, country, method: method.id };
}

export async function getPrayerLocation(env: Env): Promise<PrayerLocation> {
  const stored = await env.PRONOTE_CACHE.get(LOCATION_KEY, "json");
  return validateLocation((stored ?? {}) as Record<string, unknown>) ?? DEFAULT_PRAYER_LOCATION;
}

export async function savePrayerLocation(env: Env, location: PrayerLocation): Promise<void> {
  await env.PRONOTE_CACHE.put(LOCATION_KEY, JSON.stringify(location));
}

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

/**
 * La cle porte le lieu et la convention : changer de ville ne doit pas servir
 * les horaires de l'ancienne jusqu'a expiration du cache.
 */
function timesKey(location: PrayerLocation, date: string): string {
  return `prayer-times:${location.city}:${location.method}:${date}`;
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
  const location = await getPrayerLocation(env);

  const cached = (await env.PRONOTE_CACHE.get(timesKey(location, date), "json")) as Record<string, string> | null;
  if (cached) return cached;

  const times = await fetchTimes(location, date);
  if (!times) return null;

  await env.PRONOTE_CACHE.put(timesKey(location, date), JSON.stringify(times), { expirationTtl: TIMES_CACHE_TTL_SECONDS });
  return times;
}

/**
 * Interroge Aladhan. Expose separement pour que l'enregistrement d'un nouveau
 * lieu puisse le verifier avant de l'accepter : une ville mal orthographiee
 * ferait disparaitre les horaires sans rien dire.
 */
export async function fetchTimes(location: PrayerLocation, date: string): Promise<Record<string, string> | null> {
  const [year, month, day] = date.split("-");
  const url = new URL(`https://api.aladhan.com/v1/timingsByCity/${day}-${month}-${year}`);
  url.searchParams.set("city", location.city);
  url.searchParams.set("country", location.country);
  url.searchParams.set("method", String(location.method));

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) {
      console.error(`fetchTimes(${location.city}, ${date}) : Aladhan a repondu ${response.status}`);
      return null;
    }
    return readTimings(await response.json());
  } catch (error) {
    console.error(`fetchTimes(${location.city}, ${date}) failed:`, error);
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
