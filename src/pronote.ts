import {
  AccountKind,
  assignmentStatus,
  assignmentsFromIntervals,
  BadCredentialsError,
  createSessionHandle,
  loginCredentials,
  loginToken,
  type Assignment,
  type SessionHandle
} from "pawnote";
import type { ChildConfig } from "./children";
import { readChildSecrets, type Env } from "./env";

const HOMEWORK_CACHE_TTL_SECONDS = 180;

function deviceKey(child: ChildConfig): string {
  return `device:${child.slug}`;
}

function tokenKey(child: ChildConfig): string {
  return `token:${child.slug}`;
}

function homeworkCacheKey(child: ChildConfig): string {
  return `homework:${child.slug}`;
}

async function getOrCreateDeviceUUID(env: Env, child: ChildConfig): Promise<string> {
  const existing = await env.PRONOTE_CACHE.get(deviceKey(child));
  if (existing) return existing;

  const generated = crypto.randomUUID();
  await env.PRONOTE_CACHE.put(deviceKey(child), generated);
  return generated;
}

/**
 * Ouvre une session Pronote pour cet enfant : reutilise le token stocke en
 * KV si possible (evite de renvoyer le mot de passe a chaque appel), sinon
 * s'authentifie avec identifiant/mot de passe et stocke le nouveau token.
 */
export async function getSession(env: Env, child: ChildConfig): Promise<SessionHandle> {
  const secrets = readChildSecrets(env, child);
  const deviceUUID = await getOrCreateDeviceUUID(env, child);
  const session = createSessionHandle();

  const cachedToken = await env.PRONOTE_CACHE.get(tokenKey(child));

  if (cachedToken) {
    try {
      const refreshed = await loginToken(session, {
        url: secrets.url,
        kind: AccountKind.STUDENT,
        username: secrets.username,
        deviceUUID,
        token: cachedToken
      });
      await env.PRONOTE_CACHE.put(tokenKey(child), refreshed.token);
      return session;
    } catch {
      // Token perime ou refuse : on retombe sur identifiant/mot de passe.
    }
  }

  try {
    const refreshed = await loginCredentials(session, {
      url: secrets.url,
      kind: AccountKind.STUDENT,
      username: secrets.username,
      password: secrets.password,
      deviceUUID
    });
    await env.PRONOTE_CACHE.put(tokenKey(child), refreshed.token);
    return session;
  } catch (error) {
    if (error instanceof BadCredentialsError) {
      throw new Error(
        `Identifiant/mot de passe Pronote refuses pour ${child.displayName}. ` +
          `Verifie les secrets PRONOTE_${child.secretPrefix}_USERNAME / PRONOTE_${child.secretPrefix}_PASSWORD.`
      );
    }
    throw error;
  }
}

export interface HomeworkItem {
  id: string;
  subject: string;
  description: string;
  done: boolean;
  deadline: string;
  color: string;
}

function toHomeworkItem(assignment: Assignment): HomeworkItem {
  return {
    id: assignment.id,
    subject: assignment.subject.name,
    description: assignment.description,
    done: assignment.done,
    deadline: assignment.deadline.toISOString(),
    color: assignment.backgroundColor
  };
}

/**
 * Devoirs du jour et du lendemain pour un enfant. Resultat mis en cache
 * quelques minutes en KV pour eviter de re-solliciter Pronote a chaque
 * chargement de page.
 */
export async function getHomework(env: Env, child: ChildConfig, options?: { skipCache?: boolean }): Promise<HomeworkItem[]> {
  if (!options?.skipCache) {
    const cached = await env.PRONOTE_CACHE.get(homeworkCacheKey(child), "json");
    if (cached) return cached as HomeworkItem[];
  }

  const session = await getSession(env, child);

  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 2);
  endDate.setMilliseconds(-1);

  const assignments = await assignmentsFromIntervals(session, startDate, endDate);
  const homework = assignments
    .map(toHomeworkItem)
    .sort((a, b) => a.deadline.localeCompare(b.deadline));

  await env.PRONOTE_CACHE.put(homeworkCacheKey(child), JSON.stringify(homework), {
    expirationTtl: HOMEWORK_CACHE_TTL_SECONDS
  });

  return homework;
}

/**
 * Ecrit le statut fait/non fait directement dans Pronote (source de verite
 * unique), puis invalide le cache local pour que la page se remette a jour.
 */
export async function setHomeworkStatus(env: Env, child: ChildConfig, assignmentId: string, done: boolean): Promise<void> {
  const session = await getSession(env, child);
  await assignmentStatus(session, assignmentId, done);
  await env.PRONOTE_CACHE.delete(homeworkCacheKey(child));
}
