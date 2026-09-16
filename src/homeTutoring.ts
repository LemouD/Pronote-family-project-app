import type { ChildConfig } from "./children";
import type { Env } from "./env";

/**
 * Devoir maison : le prof de maison note ce qui a ete travaille et ce qui a
 * coince, l'IA propose un exercice cible, le parent valide, l'enfant le voit.
 *
 * Le parent est le seul a declencher la generation et le seul a publier. Deux
 * raisons : la page du prof ne doit jamais pouvoir couter un appel API, et un
 * texte redige a l'exterieur de la famille ne doit pas arriver chez un enfant
 * sans qu'un adulte l'ait lu.
 */

const MAX_NOTE_LENGTH = 1000;
const MAX_EXERCISE_LENGTH = 2000;
/** Purge : au-dela, les seances anciennes n'apportent plus rien. */
const MAX_LOG_ENTRIES = 40;
const MAX_APPLIED_AGE_DAYS = 30;

export interface TutorNote {
  id: string;
  subject: string;
  /** Ce qui a ete travaille pendant la seance. */
  done: string;
  /** Ce qui a pose probleme. C'est ce que l'exercice doit cibler. */
  difficulty: string;
  createdAt: string;
}

export interface Proposal {
  id: string;
  noteId: string;
  subject: string;
  /** Texte genere, relu et eventuellement corrige par le parent avant publication. */
  exercise: string;
  createdAt: string;
}

export interface AppliedExercise {
  id: string;
  subject: string;
  exercise: string;
  done: boolean;
  appliedAt: string;
}

export const APPLIED_ID_PREFIX = "devoir-maison-";

function logKey(child: ChildConfig): string {
  return `devoir-maison-log:${child.slug}`;
}

function proposalsKey(child: ChildConfig): string {
  return `devoir-maison-proposals:${child.slug}`;
}

function appliedKey(child: ChildConfig): string {
  return `devoir-maison-applied:${child.slug}`;
}

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  // Les caracteres de controle sont ecrits en echappement et non en clair :
  // un octet nul litteral suffit a faire classer tout le fichier comme
  // binaire par git, qui cesse alors d en montrer le moindre diff.
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, maxLength);
}

export interface NewTutorNote {
  subject: string;
  done: string;
  difficulty: string;
}

/** La matiere doit venir de la liste de l'enfant : le prof ne choisit pas librement. */
export function validateTutorNote(subjects: string[], input: Record<string, unknown>): NewTutorNote | null {
  const subject = typeof input.subject === "string" ? input.subject : "";
  // La matiere doit venir de la liste du parent : le prof choisit dans un
  // menu, il n'ecrit pas ce qu'il veut.
  if (!subjects.includes(subject)) return null;

  const done = cleanText(input.done, MAX_NOTE_LENGTH);
  const difficulty = cleanText(input.difficulty, MAX_NOTE_LENGTH);
  if (done.length === 0 && difficulty.length === 0) return null;

  return { subject, done, difficulty };
}

export async function listNotes(env: Env, child: ChildConfig): Promise<TutorNote[]> {
  const stored = await env.PRONOTE_CACHE.get(logKey(child), "json");
  return Array.isArray(stored) ? (stored as TutorNote[]) : [];
}

export async function addNote(env: Env, child: ChildConfig, input: NewTutorNote): Promise<TutorNote> {
  const note: TutorNote = {
    id: crypto.randomUUID(),
    subject: input.subject,
    done: input.done,
    difficulty: input.difficulty,
    createdAt: new Date().toISOString()
  };

  const notes = [note, ...(await listNotes(env, child))].slice(0, MAX_LOG_ENTRIES);
  await env.PRONOTE_CACHE.put(logKey(child), JSON.stringify(notes));
  return note;
}

export async function findNote(env: Env, child: ChildConfig, noteId: string): Promise<TutorNote | undefined> {
  return (await listNotes(env, child)).find((note) => note.id === noteId);
}

export async function listProposals(env: Env, child: ChildConfig): Promise<Proposal[]> {
  const stored = await env.PRONOTE_CACHE.get(proposalsKey(child), "json");
  return Array.isArray(stored) ? (stored as Proposal[]) : [];
}

async function writeProposals(env: Env, child: ChildConfig, proposals: Proposal[]): Promise<void> {
  await env.PRONOTE_CACHE.put(proposalsKey(child), JSON.stringify(proposals));
}

/** Une seule proposition en attente par note : regenerer remplace la precedente. */
export async function saveProposal(env: Env, child: ChildConfig, note: TutorNote, exercise: string): Promise<void> {
  const proposal: Proposal = {
    id: crypto.randomUUID(),
    noteId: note.id,
    subject: note.subject,
    exercise: cleanText(exercise, MAX_EXERCISE_LENGTH),
    createdAt: new Date().toISOString()
  };

  const others = (await listProposals(env, child)).filter((existing) => existing.noteId !== note.id);
  await writeProposals(env, child, [proposal, ...others]);
}

export async function removeProposal(env: Env, child: ChildConfig, proposalId: string): Promise<Proposal | undefined> {
  const proposals = await listProposals(env, child);
  const found = proposals.find((proposal) => proposal.id === proposalId);
  if (!found) return undefined;

  await writeProposals(
    env,
    child,
    proposals.filter((proposal) => proposal.id !== proposalId)
  );
  return found;
}

export async function listApplied(env: Env, child: ChildConfig): Promise<AppliedExercise[]> {
  const stored = await env.PRONOTE_CACHE.get(appliedKey(child), "json");
  if (!Array.isArray(stored)) return [];

  const cutoff = Date.now() - MAX_APPLIED_AGE_DAYS * 24 * 60 * 60 * 1000;
  return (stored as AppliedExercise[]).filter((item) => new Date(item.appliedAt).getTime() >= cutoff);
}

async function writeApplied(env: Env, child: ChildConfig, items: AppliedExercise[]): Promise<void> {
  await env.PRONOTE_CACHE.put(appliedKey(child), JSON.stringify(items));
}

/**
 * Publie l'exercice chez l'enfant. Le texte passe en parametre est celui
 * affiche au parent au moment du clic, donc eventuellement corrige par lui -
 * c'est lui qui fait foi, pas la version d'origine du modele.
 */
export async function applyProposal(env: Env, child: ChildConfig, proposal: Proposal, exercise: string): Promise<void> {
  const applied: AppliedExercise = {
    id: `${APPLIED_ID_PREFIX}${proposal.id}`,
    subject: proposal.subject,
    exercise: cleanText(exercise, MAX_EXERCISE_LENGTH),
    done: false,
    appliedAt: new Date().toISOString()
  };

  await writeApplied(env, child, [applied, ...(await listApplied(env, child))]);
}

export function isAppliedExerciseId(id: string): boolean {
  return id.startsWith(APPLIED_ID_PREFIX);
}

/** Retourne false si l'exercice n'existe plus (purge par anciennete). */
export async function setAppliedStatus(env: Env, child: ChildConfig, id: string, done: boolean): Promise<boolean> {
  const items = await listApplied(env, child);
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return false;

  items[index] = { ...items[index], done };
  await writeApplied(env, child, items);
  return true;
}

/**
 * Retire un exercice de chez l'enfant. Suppression seche, sans corbeille :
 * c'est un exercice qu'on ne veut plus voir, pas une donnee a archiver.
 * Retourne false s'il n'existait deja plus.
 */
export async function removeApplied(env: Env, child: ChildConfig, id: string): Promise<boolean> {
  const items = await listApplied(env, child);
  const remaining = items.filter((item) => item.id !== id);
  if (remaining.length === items.length) return false;

  await writeApplied(env, child, remaining);
  return true;
}


/* -------------------------------------------------------------------------
   Matieres suivies avec le prof de maison
   ---------------------------------------------------------------------- */

/**
 * La liste des matieres appartient au parent, pas au code. Tant qu'il n'y a
 * pas touche, on sert celle de children.ts : rien ne change pour les familles
 * deja configurees, et il n'y a aucune migration a ecrire.
 *
 * Une liste vide enregistree est un choix valable (plus de cours particuliers)
 * et se distingue de l'absence d'enregistrement.
 */
export const MAX_SUBJECTS = 8;
const MAX_SUBJECT_LENGTH = 40;

function subjectsKey(child: ChildConfig): string {
  return `tutor-subjects:${child.slug}`;
}

export async function getSubjects(env: Env, child: ChildConfig): Promise<string[]> {
  const stored = await env.PRONOTE_CACHE.get(subjectsKey(child), "json");
  if (!Array.isArray(stored)) return child.homeworkSubjects;

  return stored.filter((entry): entry is string => typeof entry === "string" && entry.length > 0).slice(0, MAX_SUBJECTS);
}

/** Nettoie une matiere saisie par le parent. Retourne null si elle ne tient pas. */
export function validateSubject(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const subject = input.replace(/\s+/g, " ").trim().slice(0, MAX_SUBJECT_LENGTH);
  return subject.length > 0 ? subject : null;
}

export type SubjectError = "invalide" | "doublon" | "trop-de-matieres";

export async function addSubject(env: Env, child: ChildConfig, input: unknown): Promise<SubjectError | null> {
  const subject = validateSubject(input);
  if (!subject) return "invalide";

  const subjects = await getSubjects(env, child);
  if (subjects.length >= MAX_SUBJECTS) return "trop-de-matieres";
  // Comparaison insensible a la casse : "Maths" et "maths" seraient deux
  // entrees pour la meme matiere dans le menu du prof.
  if (subjects.some((entry) => entry.toLowerCase() === subject.toLowerCase())) return "doublon";

  await env.PRONOTE_CACHE.put(subjectsKey(child), JSON.stringify([...subjects, subject]));
  return null;
}

/**
 * Retire une matiere de la liste. Les seances deja enregistrees dans cette
 * matiere ne bougent pas : elles portent leur propre libelle, et un historique
 * ne doit pas se reecrire parce qu'on arrete des cours.
 */
export async function removeSubject(env: Env, child: ChildConfig, subject: string): Promise<void> {
  const subjects = await getSubjects(env, child);
  await env.PRONOTE_CACHE.put(
    subjectsKey(child),
    JSON.stringify(subjects.filter((entry) => entry !== subject))
  );
}
