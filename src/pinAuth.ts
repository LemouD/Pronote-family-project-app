import type { ChildConfig } from "./children";
import type { Env } from "./env";

/**
 * Code d'acces a 5 chiffres, partage par les pages enfant et par la page du
 * prof de maison. Les deux ont le meme besoin : un lien non-devinable ne
 * suffit pas, parce qu'un lien se partage, se capture et traine dans un
 * historique.
 *
 * Le code n'est jamais stocke en clair, seul un derive PBKDF2 l'est. Le
 * changer change ce derive, ce qui deconnecte du meme coup tous les appareils.
 */

const PIN_PATTERN = /^\d{5}$/;
const PBKDF2_ITERATIONS = 100_000;
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;
const SESSION_COOKIE = "access_session";

export const PIN_LENGTH = 5;

export interface PinScope {
  /** Cle KV du code, ex. "child-pin:<slug>". */
  storageKey: string;
  /** Chemin auquel le cookie est limite : le cookie de l'un n'ouvre pas la page de l'autre. */
  cookiePath: string;
  /** Cle utilisee par le compteur d'essais (voir loginAttempts.ts). */
  attemptsScope: string;
}

export function childPinScope(child: ChildConfig): PinScope {
  return {
    storageKey: `child-pin:${child.slug}`,
    cookiePath: `/enfant/${child.slug}`,
    attemptsScope: `child:${child.slug}`
  };
}

export function tutorPinScope(child: ChildConfig): PinScope {
  return {
    storageKey: `tutor-pin:${child.tutorSlug}`,
    cookiePath: `/prof/${child.tutorSlug}`,
    attemptsScope: `tutor:${child.tutorSlug}`
  };
}

interface StoredPin {
  saltHex: string;
  hashHex: string;
  iterations: number;
}

export function isValidPinFormat(value: unknown): value is string {
  return typeof value === "string" && PIN_PATTERN.test(value);
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

async function derive(pin: string, salt: Uint8Array, iterations: number): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, keyMaterial, 256);
  return toHex(bits);
}

/** Comparaison a temps constant, pour ne pas fuir la reponse par la duree. */
function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  const length = Math.max(bufA.length, bufB.length, 1);
  let diff = bufA.length === bufB.length ? 0 : 1;
  for (let i = 0; i < length; i++) diff |= (bufA[i] ?? 0) ^ (bufB[i] ?? 0);
  return diff === 0;
}

export async function setPin(env: Env, scope: PinScope, pin: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const stored: StoredPin = {
    saltHex: toHex(salt.buffer as ArrayBuffer),
    hashHex: await derive(pin, salt, PBKDF2_ITERATIONS),
    iterations: PBKDF2_ITERATIONS
  };
  await env.PRONOTE_CACHE.put(scope.storageKey, JSON.stringify(stored));
}

export async function hasPin(env: Env, scope: PinScope): Promise<boolean> {
  return (await env.PRONOTE_CACHE.get(scope.storageKey)) !== null;
}

async function readStoredPin(env: Env, scope: PinScope): Promise<StoredPin | null> {
  const stored = (await env.PRONOTE_CACHE.get(scope.storageKey, "json")) as StoredPin | null;
  if (!stored || typeof stored.saltHex !== "string" || typeof stored.hashHex !== "string") return null;
  return stored;
}

/** Retourne le jeton de session a poser en cookie, ou null si le code est faux. */
export async function verifyPin(env: Env, scope: PinScope, pin: string): Promise<string | null> {
  const stored = await readStoredPin(env, scope);
  if (!stored) return null;

  const candidate = await derive(pin, fromHex(stored.saltHex), stored.iterations);
  return timingSafeEqual(candidate, stored.hashHex) ? stored.hashHex : null;
}

function readSessionCookie(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;

  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== SESSION_COOKIE) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

export type AccessState = "granted" | "pin-required" | "pin-not-configured";

/**
 * Sans code configure, l'acces est refuse plutot que laisse ouvert : c'est
 * precisement la situation que le code doit corriger. Le parent voit
 * l'avertissement dans ses reglages et peut en definir un en une minute.
 */
export async function checkAccess(request: Request, env: Env, scope: PinScope): Promise<AccessState> {
  const stored = await readStoredPin(env, scope);
  if (!stored) return "pin-not-configured";

  const session = readSessionCookie(request);
  if (session !== null && timingSafeEqual(session, stored.hashHex)) return "granted";
  return "pin-required";
}

export function sessionCookie(scope: PinScope, token: string): string {
  return (
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=${scope.cookiePath}; ` +
    `Max-Age=${SESSION_MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=Strict`
  );
}
