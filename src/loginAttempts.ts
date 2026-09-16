import type { Env } from "./env";

/**
 * Plafond d'essais sur les codes enfant et le token parent.
 *
 * Implemente avec un compteur en KV plutot qu'avec le binding Rate Limiting
 * de Cloudflare : ce dernier est encore marque experimental par wrangler et ne
 * s'execute pas en developpement local, ce qui rendrait le verrouillage
 * impossible a tester. Ici, un seul chemin de code, identique en local et en
 * production - et le volume est negligeable pour une famille.
 *
 * Le compteur est indexe sur l'enfant (ou sur le parent), pas sur l'adresse
 * IP : sinon il suffirait d'en changer pour repartir a zero. La contrepartie
 * assumee est qu'une personne mal intentionnee connaissant deja le lien peut
 * bloquer l'acces pendant la fenetre en cours.
 */

const WINDOW_SECONDS = 15 * 60;
const MAX_ATTEMPTS = 10;

interface AttemptRecord {
  count: number;
  /** Epoch ms du premier essai rate de la fenetre en cours. */
  firstAt: number;
}

function attemptsKey(scope: string): string {
  return `login-attempts:${scope}`;
}

export interface AttemptStatus {
  allowed: boolean;
  /** Secondes restantes avant de pouvoir reessayer (0 si autorise). */
  retryInSeconds: number;
}

export async function checkAttempts(env: Env, scope: string): Promise<AttemptStatus> {
  const record = (await env.PRONOTE_CACHE.get(attemptsKey(scope), "json")) as AttemptRecord | null;
  if (!record || record.count < MAX_ATTEMPTS) return { allowed: true, retryInSeconds: 0 };

  const elapsed = (Date.now() - record.firstAt) / 1000;
  if (elapsed >= WINDOW_SECONDS) return { allowed: true, retryInSeconds: 0 };

  return { allowed: false, retryInSeconds: Math.ceil(WINDOW_SECONDS - elapsed) };
}

export async function recordFailure(env: Env, scope: string): Promise<void> {
  const existing = (await env.PRONOTE_CACHE.get(attemptsKey(scope), "json")) as AttemptRecord | null;
  const stillInWindow = existing !== null && (Date.now() - existing.firstAt) / 1000 < WINDOW_SECONDS;

  const record: AttemptRecord = stillInWindow
    ? { count: existing.count + 1, firstAt: existing.firstAt }
    : { count: 1, firstAt: Date.now() };

  // Le TTL fait le menage : passe la fenetre, la cle disparait d'elle-meme.
  await env.PRONOTE_CACHE.put(attemptsKey(scope), JSON.stringify(record), { expirationTtl: WINDOW_SECONDS });
}

export async function clearAttempts(env: Env, scope: string): Promise<void> {
  await env.PRONOTE_CACHE.delete(attemptsKey(scope));
}
