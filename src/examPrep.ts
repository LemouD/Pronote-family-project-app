import type { ChildConfig } from "./children";
import type { Env } from "./env";

/**
 * Preparation d'examen, cote enfant. A la difference du devoir maison, c'est
 * l'enfant qui declenche la generation et il recoit le resultat sans qu'un
 * adulte l'ait relu. Deux consequences sur la conception :
 *
 * - tout ce qui part vers le modele vient de listes fermees definies ici :
 *   matiere, notion et format. Aucun texte libre de l'enfant n'atteint le
 *   prompt, donc aucune injection possible ;
 * - le nombre de generations par jour est plafonne, sinon un appui repete sur
 *   le bouton part directement sur la facture.
 *
 * La correction est produite en meme temps que l'enonce (un seul appel, et
 * elle correspond forcement a l'exercice) mais gardee cote serveur : elle
 * n'est envoyee au navigateur que lorsque l'enfant la demande, pour qu'elle
 * ne soit pas lisible dans le code source de la page avant d'avoir cherche.
 */

export type ExamId = "brevet";

export const MAX_GENERATIONS_PER_DAY = 10;
/** Au-dela, les sessions les plus anciennes sont oubliees. */
const MAX_SESSIONS = 30;

export interface ExamSubject {
  id: string;
  label: string;
  topics: string[];
}

export interface ExamFormat {
  id: string;
  label: string;
  /** Consigne donnee au modele pour ce format. */
  instruction: string;
}

export interface ExamCatalogue {
  label: string;
  subjects: ExamSubject[];
  formats: ExamFormat[];
}

/** Contenu, pas logique : ajouter une notion ici suffit a la proposer. */
const BREVET: ExamCatalogue = {
  label: "Brevet",
  subjects: [
    {
      id: "maths",
      label: "Mathematiques",
      topics: [
        "Theoreme de Pythagore",
        "Theoreme de Thales",
        "Trigonometrie",
        "Calcul litteral et equations",
        "Fractions et puissances",
        "Proportionnalite et pourcentages",
        "Fonctions lineaires et affines",
        "Statistiques et probabilites",
        "Geometrie dans l'espace",
        "Arithmetique (PGCD, nombres premiers)",
        "Transformations du plan",
        "Algorithmique et Scratch"
      ]
    },
    {
      id: "francais",
      label: "Francais",
      topics: [
        "Grammaire et classes de mots",
        "Conjugaison",
        "Orthographe et accords",
        "Figures de style",
        "Comprehension de texte",
        "Redaction et expression ecrite",
        "Vocabulaire"
      ]
    },
    {
      id: "histoire-geo",
      label: "Histoire-Geographie-EMC",
      topics: [
        "Premiere Guerre mondiale",
        "Seconde Guerre mondiale",
        "La France depuis 1945",
        "Guerre froide et decolonisation",
        "Amenagement du territoire francais",
        "Mondialisation et echanges",
        "EMC : Republique et citoyennete"
      ]
    },
    {
      id: "sciences",
      label: "Sciences",
      topics: [
        "Electricite et circuits",
        "Atomes, molecules et reactions chimiques",
        "Forces, mouvement et energie",
        "Lumiere et son",
        "Genetique et heredite",
        "Corps humain et sante",
        "Ecosystemes et environnement",
        "Geologie et risques naturels"
      ]
    }
  ],
  formats: [
    {
      id: "entrainement",
      label: "Exercices d'entrainement",
      instruction: "Propose deux ou trois exercices progressifs, du plus simple au plus exigeant."
    },
    {
      id: "qcm",
      label: "QCM rapide",
      instruction: "Propose six questions a choix multiples, avec quatre propositions chacune et une seule bonne reponse."
    },
    {
      id: "sujet-type",
      label: "Sujet type brevet",
      instruction: "Propose un exercice au format et au bareme d'une epreuve du brevet, avec des questions numerotees et leurs points."
    },
    {
      id: "revision",
      label: "Revision express",
      instruction: "Propose cinq questions courtes de restitution pour verifier que les notions essentielles sont su es."
    }
  ]
};

const CATALOGUES: Record<ExamId, ExamCatalogue> = { brevet: BREVET };

export function catalogueFor(child: ChildConfig): ExamCatalogue | null {
  return child.examPrep ? CATALOGUES[child.examPrep] : null;
}

export interface ExamChoice {
  subject: ExamSubject;
  topic: string;
  format: ExamFormat;
}

/** Tout doit correspondre au catalogue : rien d'arbitraire ne remonte du formulaire. */
export function validateChoice(catalogue: ExamCatalogue, input: { subjectId: unknown; topic: unknown; formatId: unknown }): ExamChoice | null {
  const subject = catalogue.subjects.find((entry) => entry.id === input.subjectId);
  if (!subject) return null;

  const topic = subject.topics.find((entry) => entry === input.topic);
  if (!topic) return null;

  const format = catalogue.formats.find((entry) => entry.id === input.formatId);
  if (!format) return null;

  return { subject, topic, format };
}

export interface ExamSession {
  id: string;
  subjectLabel: string;
  topic: string;
  formatLabel: string;
  exercise: string;
  /** Jamais envoyee au navigateur tant que l'enfant ne l'a pas demandee. */
  correction: string;
  correctionSeen: boolean;
  done: boolean;
  createdAt: string;
  completedAt?: string;
}

/** Vue expurgee envoyee a la page : la correction n'y figure que si elle a ete demandee. */
export interface ExamSessionView {
  id: string;
  subjectLabel: string;
  topic: string;
  formatLabel: string;
  exercise: string;
  correction: string | null;
  done: boolean;
  createdAt: string;
}

function sessionsKey(child: ChildConfig): string {
  return `exam-sessions:${child.slug}`;
}

function quotaKey(child: ChildConfig, date: string): string {
  return `exam-quota:${child.slug}:${date}`;
}

export async function listSessions(env: Env, child: ChildConfig): Promise<ExamSession[]> {
  const stored = await env.PRONOTE_CACHE.get(sessionsKey(child), "json");
  return Array.isArray(stored) ? (stored as ExamSession[]) : [];
}

export function toView(session: ExamSession): ExamSessionView {
  return {
    id: session.id,
    subjectLabel: session.subjectLabel,
    topic: session.topic,
    formatLabel: session.formatLabel,
    exercise: session.exercise,
    correction: session.correctionSeen ? session.correction : null,
    done: session.done,
    createdAt: session.createdAt
  };
}

async function writeSessions(env: Env, child: ChildConfig, sessions: ExamSession[]): Promise<void> {
  await env.PRONOTE_CACHE.put(sessionsKey(child), JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
}

export async function addSession(
  env: Env,
  child: ChildConfig,
  choice: ExamChoice,
  generated: { exercise: string; correction: string }
): Promise<ExamSession> {
  const session: ExamSession = {
    id: crypto.randomUUID(),
    subjectLabel: choice.subject.label,
    topic: choice.topic,
    formatLabel: choice.format.label,
    exercise: generated.exercise,
    correction: generated.correction,
    correctionSeen: false,
    done: false,
    createdAt: new Date().toISOString()
  };

  await writeSessions(env, child, [session, ...(await listSessions(env, child))]);
  return session;
}

async function updateSession(
  env: Env,
  child: ChildConfig,
  sessionId: string,
  change: (session: ExamSession) => ExamSession
): Promise<ExamSession | null> {
  const sessions = await listSessions(env, child);
  const index = sessions.findIndex((session) => session.id === sessionId);
  if (index === -1) return null;

  sessions[index] = change(sessions[index]);
  await writeSessions(env, child, sessions);
  return sessions[index];
}

export async function revealCorrection(env: Env, child: ChildConfig, sessionId: string): Promise<ExamSession | null> {
  return updateSession(env, child, sessionId, (session) => ({ ...session, correctionSeen: true }));
}

/** Validation par l'enfant : c'est ce qui declenche la notification au parent. */
export async function completeSession(env: Env, child: ChildConfig, sessionId: string): Promise<ExamSession | null> {
  return updateSession(env, child, sessionId, (session) =>
    session.done ? session : { ...session, done: true, completedAt: new Date().toISOString() }
  );
}

export interface QuotaStatus {
  used: number;
  remaining: number;
}

export async function getQuota(env: Env, child: ChildConfig, date: string): Promise<QuotaStatus> {
  const used = Number((await env.PRONOTE_CACHE.get(quotaKey(child, date), "json")) ?? 0);
  const safeUsed = Number.isFinite(used) ? used : 0;
  return { used: safeUsed, remaining: Math.max(0, MAX_GENERATIONS_PER_DAY - safeUsed) };
}

export async function consumeQuota(env: Env, child: ChildConfig, date: string): Promise<void> {
  const { used } = await getQuota(env, child, date);
  // Le TTL fait le menage : le compteur du jour disparait de lui-meme.
  await env.PRONOTE_CACHE.put(quotaKey(child, date), JSON.stringify(used + 1), { expirationTtl: 60 * 60 * 48 });
}

function seenKey(child: ChildConfig): string {
  return `exam-seen-at:${child.slug}`;
}

/**
 * Exercices termines depuis la derniere visite du parent. C'est la
 * "notification" : pas de push, un indicateur dans l'application, comme pour
 * les devoirs coches (voir parentView.ts).
 */
export async function newlyCompleted(env: Env, child: ChildConfig): Promise<ExamSession[]> {
  if (!child.examPrep) return [];

  const [sessions, seenAt] = await Promise.all([
    listSessions(env, child),
    env.PRONOTE_CACHE.get(seenKey(child), "json") as Promise<string | null>
  ]);

  const since = seenAt ? new Date(seenAt).getTime() : 0;
  return sessions.filter((session) => session.done && session.completedAt && new Date(session.completedAt).getTime() > since);
}

/** Consomme les notifications : appele quand le parent ouvre sa vue d'ensemble. */
export async function markExamSeen(env: Env, child: ChildConfig): Promise<void> {
  if (!child.examPrep) return;
  await env.PRONOTE_CACHE.put(seenKey(child), JSON.stringify(new Date().toISOString()));
}

/**
 * Supprime un exercice de la liste de l'enfant.
 *
 * Refuse tant qu'il n'est pas marque termine. Le bouton n'apparait que sur
 * les exercices finis, mais la regle est verifiee ici aussi : un travail en
 * cours ne doit pas pouvoir disparaitre, meme sur une requete forgee.
 */
export async function removeSession(env: Env, child: ChildConfig, sessionId: string): Promise<boolean> {
  const sessions = await listSessions(env, child);
  const target = sessions.find((session) => session.id === sessionId);
  if (!target || !target.done) return false;

  await writeSessions(
    env,
    child,
    sessions.filter((session) => session.id !== sessionId)
  );
  return true;
}
