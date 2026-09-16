import type { ChildConfig } from "./children";
import type { Env } from "./env";

/**
 * Code d'acces par enfant. Jusqu'ici la page d'un enfant n'etait protegee que
 * par son lien non-devinable : quiconque avait le lien (capture d'ecran,
 * historique d'un ordinateur partage, copain a qui l'ecran est montre) voyait
 * tout. Il faut desormais connaitre le lien ET le code.
 *
 * Le code n'est jamais stocke en clair : seul un derive PBKDF2 l'est. Changer
 * le code change ce derive, ce qui deconnecte du meme coup tous les appareils.
 */

const PIN_LENGTH = 5;
const PIN_PATTERN = /^\d{5}$/;
const PBKDF2_ITERATIONS = 100_000;
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;
const SESSION_COOKIE = "child_session";

export const CHILD_PIN_LENGTH = PIN_LENGTH;

interface StoredPin {
  saltHex: string;
  hashHex: string;
  iterations: number;
}

function pinKey(child: ChildConfig): string {
  return `child-pin:${child.slug}`;
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

export async function setChildPin(env: Env, child: ChildConfig, pin: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const stored: StoredPin = {
    saltHex: toHex(salt.buffer as ArrayBuffer),
    hashHex: await derive(pin, salt, PBKDF2_ITERATIONS),
    iterations: PBKDF2_ITERATIONS
  };
  await env.PRONOTE_CACHE.put(pinKey(child), JSON.stringify(stored));
}

export async function hasChildPin(env: Env, child: ChildConfig): Promise<boolean> {
  return (await env.PRONOTE_CACHE.get(pinKey(child))) !== null;
}

async function readStoredPin(env: Env, child: ChildConfig): Promise<StoredPin | null> {
  const stored = (await env.PRONOTE_CACHE.get(pinKey(child), "json")) as StoredPin | null;
  if (!stored || typeof stored.saltHex !== "string" || typeof stored.hashHex !== "string") return null;
  return stored;
}

/** Retourne le jeton de session a poser en cookie, ou null si le code est faux. */
export async function verifyChildPin(env: Env, child: ChildConfig, pin: string): Promise<string | null> {
  const stored = await readStoredPin(env, child);
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

export type ChildAccess = "granted" | "pin-required" | "pin-not-configured";

/**
 * Sans code configure, l'acces est refuse plutot que laisse ouvert : c'est
 * precisement la situation que le code doit corriger. Le parent voit
 * l'avertissement dans ses reglages et peut en definir un en une minute.
 */
export async function checkChildAccess(request: Request, env: Env, child: ChildConfig): Promise<ChildAccess> {
  const stored = await readStoredPin(env, child);
  if (!stored) return "pin-not-configured";

  const session = readSessionCookie(request);
  if (session !== null && timingSafeEqual(session, stored.hashHex)) return "granted";
  return "pin-required";
}

export function childSessionCookie(child: ChildConfig, token: string): string {
  // Portee limitee aux pages de cet enfant : le cookie de Malick n'est jamais
  // envoye sur les pages de Codou.
  return (
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/enfant/${child.slug}; ` +
    `Max-Age=${SESSION_MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=Strict`
  );
}
