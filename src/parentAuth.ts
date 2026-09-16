import type { Env } from "./env";

const SESSION_COOKIE = "parent_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/** Comparaison a temps constant pour eviter une fuite d'info par timing sur le token. */
function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  // Longueur differente : on compare quand meme un buffer de meme taille que bufA
  // pour ne pas court-circuiter immediatement (fuite de longueur), puis on echoue.
  const length = Math.max(bufA.length, bufB.length, 1);
  let diff = bufA.length === bufB.length ? 0 : 1;
  for (let i = 0; i < length; i++) {
    diff |= (bufA[i] ?? 0) ^ (bufB[i] ?? 0);
  }
  return diff === 0;
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

/**
 * Trois facons de presenter le token : le cookie de session (cas normal une
 * fois l'appli installee), ?token=... (premiere visite, depuis le lien garde
 * par le parent) et l'en-tete x-parent-token. On les teste toutes plutot que
 * de prendre la premiere presente : sinon un vieux cookie perime ferait
 * echouer une visite avec un ?token= pourtant valide.
 */
export function isParentAuthorized(request: Request, env: Env): boolean {
  // Fail-closed : sans token configure, /parent est un chemin fixe et
  // devinable (contrairement a /enfant/<slug>), donc pas de mode "ouvert".
  const expected = env.PARENT_ACCESS_TOKEN;
  if (!expected) return false;

  const url = new URL(request.url);
  const candidates = [readSessionCookie(request), url.searchParams.get("token"), request.headers.get("x-parent-token")];

  let authorized = false;
  for (const candidate of candidates) {
    if (candidate === null) continue;
    if (timingSafeEqual(candidate, expected)) authorized = true;
  }
  return authorized;
}

/**
 * Echange un ?token=... valide contre un cookie de session, puis redirige vers
 * la meme URL sans le token. Deux raisons : l'appli installee demarre sur
 * /parent/ sans token dans l'URL et doit rester authentifiee, et le secret ne
 * reste pas dans la barre d'adresse, l'historique ou un lien partage par
 * inadvertance. Retourne null si l'URL ne porte pas de token valide.
 */
export function exchangeTokenForSession(request: Request, env: Env): Response | null {
  const expected = env.PARENT_ACCESS_TOKEN;
  if (!expected) return null;

  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token === null || !timingSafeEqual(token, expected)) return null;

  url.searchParams.delete("token");
  // encodeURIComponent neutralise ';' et les retours a la ligne : le token est
  // choisi par le parent, il ne doit pas pouvoir casser l'en-tete Set-Cookie.
  const cookie =
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}; ` +
    `HttpOnly; Secure; SameSite=Strict`;

  return new Response(null, {
    status: 303,
    headers: {
      location: `${url.pathname}${url.search}`,
      "set-cookie": cookie,
      "cache-control": "private, no-store"
    }
  });
}
