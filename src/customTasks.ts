import type { ChildConfig } from "./children";
import type { Env } from "./env";

/**
 * Taches ajoutees a la main par un parent (pas de contrepartie Pronote), en
 * plus des devoirs lus depuis Pronote. Stockees en KV, une entree par enfant.
 * Pronote reste la seule source de verite pour les devoirs eux-memes ; ceci
 * est une liste separee, purement a nous.
 */
export interface CustomTask {
  id: string;
  description: string;
  /** Qui a ajoute la tache, ex. "Maman" / "Papa". Affiche comme badge. */
  createdBy: string;
  done: boolean;
  /** ISO ; jour d'affichage (aujourd'hui/demain), reutilise le meme regroupement que les devoirs. */
  deadline: string;
  createdAt: string;
}

export const CUSTOM_TASK_ID_PREFIX = "custom-";
export function isCustomTaskId(id: string): boolean {
  return id.startsWith(CUSTOM_TASK_ID_PREFIX);
}

const MAX_DESCRIPTION_LENGTH = 300;
const MAX_CREATED_BY_LENGTH = 30;
/** Purge les taches trop vieilles pour eviter que la liste ne grossisse indefiniment. */
const MAX_AGE_DAYS = 7;

function storageKey(child: ChildConfig): string {
  return `custom-tasks:${child.slug}`;
}

async function readAll(env: Env, child: ChildConfig): Promise<CustomTask[]> {
  const stored = (await env.PRONOTE_CACHE.get(storageKey(child), "json")) as CustomTask[] | null;
  return stored ?? [];
}

async function writeAll(env: Env, child: ChildConfig, tasks: CustomTask[]): Promise<void> {
  await env.PRONOTE_CACHE.put(storageKey(child), JSON.stringify(tasks));
}

function pruneOld(tasks: CustomTask[]): CustomTask[] {
  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  return tasks.filter((task) => new Date(task.createdAt).getTime() >= cutoff);
}

export async function listCustomTasks(env: Env, child: ChildConfig): Promise<CustomTask[]> {
  const tasks = await readAll(env, child);
  const pruned = pruneOld(tasks);
  if (pruned.length !== tasks.length) await writeAll(env, child, pruned);
  return pruned;
}

export interface NewCustomTask {
  description: string;
  createdBy: string;
  day: "today" | "tomorrow";
}

function dayToDeadline(day: "today" | "tomorrow"): string {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (day === "tomorrow") date.setDate(date.getDate() + 1);
  return date.toISOString();
}

export function validateNewCustomTask(input: { description?: unknown; createdBy?: unknown; day?: unknown }): NewCustomTask | null {
  const { description, createdBy, day } = input;
  if (typeof description !== "string" || typeof createdBy !== "string") return null;
  const trimmedDescription = description.trim();
  const trimmedCreatedBy = createdBy.trim();
  if (trimmedDescription.length === 0 || trimmedDescription.length > MAX_DESCRIPTION_LENGTH) return null;
  if (trimmedCreatedBy.length === 0 || trimmedCreatedBy.length > MAX_CREATED_BY_LENGTH) return null;
  if (day !== "today" && day !== "tomorrow") return null;
  return { description: trimmedDescription, createdBy: trimmedCreatedBy, day };
}

/** Ajoute une tache pour cet enfant. Reserve au parent (verifie par l'appelant). */
export async function addCustomTask(env: Env, child: ChildConfig, input: NewCustomTask): Promise<CustomTask> {
  const tasks = await listCustomTasks(env, child);
  const task: CustomTask = {
    id: `${CUSTOM_TASK_ID_PREFIX}${crypto.randomUUID()}`,
    description: input.description,
    createdBy: input.createdBy,
    done: false,
    deadline: dayToDeadline(input.day),
    createdAt: new Date().toISOString()
  };
  await writeAll(env, child, [...tasks, task]);
  return task;
}

/**
 * Change le statut fait/non-fait d'une tache perso (l'enfant coche/decoche
 * depuis sa page, comme pour les devoirs Pronote). Retourne false si la
 * tache n'existe pas (deja supprimee/purgee).
 */
export async function setCustomTaskStatus(env: Env, child: ChildConfig, taskId: string, done: boolean): Promise<boolean> {
  const tasks = await readAll(env, child);
  const index = tasks.findIndex((task) => task.id === taskId);
  if (index === -1) return false;

  tasks[index] = { ...tasks[index], done };
  await writeAll(env, child, tasks);
  return true;
}
