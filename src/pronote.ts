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

/** Devoirs tels qu'importes par bootstrap/sync_homework.py (voir CONTEXT.md). */
function externalHomeworkKey(child: ChildConfig): string {
  return `homework-external:${child.slug}`;
}

/** Horodatage du dernier import reussi, ecrit par bootstrap/sync_homework.py. */
function externalSyncedAtKey(child: ChildConfig): string {
  return `homework-synced-at:${child.slug}`;
}

/**
 * Statut "fait" gere cote KV pour les enfants en ENT (externallySynced) :
 * Pronote n'est pas joignable en direct pour eux, donc pas de re-ecriture
 * possible - on garde juste la coche dans notre appli.
 */
function doneOverridesKey(child: ChildConfig): string {
  return `homework-done-overrides:${child.slug}`;
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
 * Uniquement pour les enfants en connexion directe (pas externallySynced).
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

async function getHomeworkDirect(env: Env, child: ChildConfig, options?: { skipCache?: boolean }): Promise<HomeworkItem[]> {
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
 * Devoirs importes par bootstrap/sync_homework.py, avec le statut "fait"
 * local applique par-dessus (Pronote lui-meme n'est jamais mis a jour pour
 * ces enfants, donc son propre champ "done" resterait toujours a false).
 */
async function getHomeworkExternallySynced(env: Env, child: ChildConfig): Promise<HomeworkItem[]> {
  const imported = (await env.PRONOTE_CACHE.get(externalHomeworkKey(child), "json")) as HomeworkItem[] | null;
  if (!imported) return [];

  const overrides = (await env.PRONOTE_CACHE.get(doneOverridesKey(child), "json")) as Record<string, boolean> | null;
  if (!overrides) return imported;

  return imported.map((item) => (item.id in overrides ? { ...item, done: overrides[item.id] } : item));
}

/**
 * Devoirs du jour et du lendemain pour un enfant. En connexion directe, lus
 * depuis Pronote (mis en cache quelques minutes) ; pour un enfant en ENT
 * (externallySynced), lus depuis ce qu'un script externe a importe (voir
 * src/children.ts).
 */
export async function getHomework(env: Env, child: ChildConfig, options?: { skipCache?: boolean }): Promise<HomeworkItem[]> {
  if (child.externallySynced) return getHomeworkExternallySynced(env, child);
  return getHomeworkDirect(env, child, options);
}

export interface ExternalSyncStatus {
  externallySynced: boolean;
  hasImportedData: boolean;
  /** ISO du dernier import reussi, null si jamais synchronise. */
  syncedAt: string | null;
}

/**
 * Sante de la synchronisation externe, affichee dans l'espace parent. Sans
 * horodatage, "aucun devoir" serait ambigu : journee sans devoirs, ou script
 * de synchro en panne depuis trois jours ?
 */
export async function getExternalSyncStatus(env: Env, child: ChildConfig): Promise<ExternalSyncStatus> {
  if (!child.externallySynced) {
    return { externallySynced: false, hasImportedData: true, syncedAt: null };
  }

  // sync_homework.py ecrit toutes ses valeurs en JSON, y compris cet
  // horodatage : il faut donc le relire en JSON et pas en texte brut.
  const [imported, syncedAt] = await Promise.all([
    env.PRONOTE_CACHE.get(externalHomeworkKey(child)),
    env.PRONOTE_CACHE.get(externalSyncedAtKey(child), "json") as Promise<string | null>
  ]);

  return { externallySynced: true, hasImportedData: imported !== null, syncedAt };
}

/**
 * Change le statut fait/non-fait. En connexion directe, ecrit dans Pronote
 * (source de verite) puis invalide le cache. Pour un enfant en ENT
 * (externallySynced), Pronote n'est pas joignable en direct : le statut est
 * garde uniquement cote KV, jamais renvoye vers Pronote.
 */
export async function setHomeworkStatus(env: Env, child: ChildConfig, assignmentId: string, done: boolean): Promise<void> {
  if (child.externallySynced) {
    const overrides = ((await env.PRONOTE_CACHE.get(doneOverridesKey(child), "json")) as Record<string, boolean> | null) ?? {};
    overrides[assignmentId] = done;
    await env.PRONOTE_CACHE.put(doneOverridesKey(child), JSON.stringify(overrides));
    return;
  }

  const session = await getSession(env, child);
  await assignmentStatus(session, assignmentId, done);
  await env.PRONOTE_CACHE.delete(homeworkCacheKey(child));
}
