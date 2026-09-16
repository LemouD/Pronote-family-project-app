import type { ChildConfig } from "./children";
import type { Env } from "./env";

/**
 * "Mon temps" : l'enfant compose lui-meme son creneau, puis le deroule au
 * chronometre. Le parent regarde, il ne modifie rien.
 *
 * Le nom affiche tient dans une seule constante : il n'est pas arrete, et en
 * changer ne doit pas obliger a relire tout le fichier.
 */
export const ROUTINE_LABEL = "Mon temps";

export type BlockKind = "revisions" | "pause" | "loisir";

export interface KindConfig {
  id: BlockKind;
  label: string;
}

export const KINDS: KindConfig[] = [
  { id: "revisions", label: "Revisions" },
  { id: "pause", label: "Pause" },
  { id: "loisir", label: "Loisir" }
];

export function findKind(id: unknown): KindConfig | undefined {
  return KINDS.find((kind) => kind.id === id);
}

/** Les durees se reglent par pas de 5 minutes, de 5 minutes a 2 heures. */
export const STEP_MINUTES = 5;
export const MAX_MINUTES = 120;

/**
 * Plafond de loisir sur l'ensemble de la routine. Verifie ici et pas
 * seulement dans le formulaire : c'est la regle de la maison, pas un confort
 * d'affichage, donc elle ne doit pas dependre du navigateur.
 */
export const MAX_LEISURE_MINUTES = 30;

const MAX_BLOCKS = 12;
const MAX_LABEL_LENGTH = 40;
const ROUTINE_TTL_SECONDS = 60 * 60 * 48;

export interface RoutineBlock {
  id: string;
  kind: BlockKind;
  label: string;
  minutes: number;
}

export interface Routine {
  /** Jour de Paris auquel appartient cette routine. */
  date: string;
  blocks: RoutineBlock[];
  /** Index du bloc en cours. null tant que l'enfant n'a pas demarre. */
  currentIndex: number | null;
  /**
   * Debut du bloc en cours, en ISO. Le decompte tourne dans le navigateur,
   * mais c'est cet horodatage qui fait foi : sans lui, un rechargement de
   * page relancerait le bloc a zero.
   */
  startedAt: string | null;
  finished: boolean;
}

function storageKey(child: ChildConfig, date: string): string {
  return `routine:${child.slug}:${date}`;
}

function emptyRoutine(date: string): Routine {
  return { date, blocks: [], currentIndex: null, startedAt: null, finished: false };
}

/**
 * Relit ce qui vient du KV comme une donnee suspecte : une entree ecrite par
 * une version precedente ne doit pas casser la page.
 */
function readRoutine(stored: unknown, date: string): Routine {
  if (typeof stored !== "object" || stored === null) return emptyRoutine(date);
  const raw = stored as Partial<Routine>;

  const blocks = Array.isArray(raw.blocks)
    ? raw.blocks
        .filter((block): block is RoutineBlock => {
          if (typeof block !== "object" || block === null) return false;
          const candidate = block as Partial<RoutineBlock>;
          return (
            typeof candidate.id === "string" &&
            typeof candidate.label === "string" &&
            typeof candidate.minutes === "number" &&
            findKind(candidate.kind) !== undefined
          );
        })
        .slice(0, MAX_BLOCKS)
    : [];

  const currentIndex =
    typeof raw.currentIndex === "number" && raw.currentIndex >= 0 && raw.currentIndex < blocks.length
      ? raw.currentIndex
      : null;

  return {
    date,
    blocks,
    currentIndex,
    startedAt: currentIndex === null ? null : typeof raw.startedAt === "string" ? raw.startedAt : null,
    finished: raw.finished === true
  };
}

/**
 * Routine du jour. La cle porte la date, donc celle de la veille disparait
 * d'elle-meme sans purge a ecrire - meme logique que les prieres.
 */
export async function getRoutine(env: Env, child: ChildConfig, date: string): Promise<Routine> {
  return readRoutine(await env.PRONOTE_CACHE.get(storageKey(child, date), "json"), date);
}

async function writeRoutine(env: Env, child: ChildConfig, routine: Routine): Promise<void> {
  await env.PRONOTE_CACHE.put(storageKey(child, routine.date), JSON.stringify(routine), {
    expirationTtl: ROUTINE_TTL_SECONDS
  });
}

export function totalMinutes(blocks: RoutineBlock[]): number {
  return blocks.reduce((total, block) => total + block.minutes, 0);
}

export function leisureMinutes(blocks: RoutineBlock[]): number {
  return totalMinutes(blocks.filter((block) => block.kind === "loisir"));
}

/** Minutes de loisir encore disponibles. Sert aussi a brider le formulaire. */
export function leisureLeft(blocks: RoutineBlock[]): number {
  return Math.max(0, MAX_LEISURE_MINUTES - leisureMinutes(blocks));
}

/** Une routine demarree ne se modifie plus : on la deroule, ou on l'arrete. */
export function isEditable(routine: Routine): boolean {
  return routine.currentIndex === null && !routine.finished;
}

export type RoutineError = "demarree" | "invalide" | "trop-de-blocs" | "loisir-depasse" | "introuvable";

export interface NewBlock {
  kind: BlockKind;
  label: string;
  minutes: number;
}

export function validateBlock(input: { kind?: unknown; label?: unknown; minutes?: unknown }): NewBlock | null {
  const kind = findKind(input.kind);
  if (!kind) return null;

  if (typeof input.label !== "string") return null;
  const label = input.label.trim().slice(0, MAX_LABEL_LENGTH);
  if (label.length === 0) return null;

  const minutes = Number(input.minutes);
  if (!Number.isInteger(minutes) || minutes < STEP_MINUTES || minutes > MAX_MINUTES) return null;
  if (minutes % STEP_MINUTES !== 0) return null;

  return { kind: kind.id, label, minutes };
}

export async function addBlock(env: Env, child: ChildConfig, date: string, input: NewBlock): Promise<RoutineError | null> {
  const routine = await getRoutine(env, child, date);
  if (!isEditable(routine)) return "demarree";
  if (routine.blocks.length >= MAX_BLOCKS) return "trop-de-blocs";

  // Le formulaire n'offre deja que les durees qui tiennent, mais la regle est
  // revalidee ici : une requete forgee ne doit pas pouvoir gonfler le loisir.
  if (input.kind === "loisir" && input.minutes > leisureLeft(routine.blocks)) return "loisir-depasse";

  routine.blocks.push({ id: crypto.randomUUID(), ...input });
  await writeRoutine(env, child, routine);
  return null;
}

export async function removeBlock(env: Env, child: ChildConfig, date: string, blockId: string): Promise<RoutineError | null> {
  const routine = await getRoutine(env, child, date);
  if (!isEditable(routine)) return "demarree";

  const remaining = routine.blocks.filter((block) => block.id !== blockId);
  if (remaining.length === routine.blocks.length) return "introuvable";

  routine.blocks = remaining;
  await writeRoutine(env, child, routine);
  return null;
}

/** Deplace un bloc d'un cran. Sans effet aux extremites, ce n'est pas une erreur. */
export async function moveBlock(
  env: Env,
  child: ChildConfig,
  date: string,
  blockId: string,
  direction: "up" | "down"
): Promise<RoutineError | null> {
  const routine = await getRoutine(env, child, date);
  if (!isEditable(routine)) return "demarree";

  const index = routine.blocks.findIndex((block) => block.id === blockId);
  if (index === -1) return "introuvable";

  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= routine.blocks.length) return null;

  [routine.blocks[index], routine.blocks[target]] = [routine.blocks[target], routine.blocks[index]];
  await writeRoutine(env, child, routine);
  return null;
}

export async function startRoutine(env: Env, child: ChildConfig, date: string): Promise<RoutineError | null> {
  const routine = await getRoutine(env, child, date);
  if (!isEditable(routine)) return "demarree";
  if (routine.blocks.length === 0) return "invalide";

  routine.currentIndex = 0;
  routine.startedAt = new Date().toISOString();
  await writeRoutine(env, child, routine);
  return null;
}

/**
 * Passe au bloc suivant. Declenche par le bouton "Continuer", jamais par une
 * minuterie : rien n'avance sans que l'enfant l'ait decide.
 */
export async function nextBlock(env: Env, child: ChildConfig, date: string): Promise<RoutineError | null> {
  const routine = await getRoutine(env, child, date);
  if (routine.currentIndex === null || routine.finished) return "invalide";

  const next = routine.currentIndex + 1;
  if (next >= routine.blocks.length) {
    routine.currentIndex = null;
    routine.startedAt = null;
    routine.finished = true;
  } else {
    routine.currentIndex = next;
    routine.startedAt = new Date().toISOString();
  }

  await writeRoutine(env, child, routine);
  return null;
}

/** Remet la journee a blanc : l'enfant recompose sa liste depuis le debut. */
export async function resetRoutine(env: Env, child: ChildConfig, date: string): Promise<void> {
  await writeRoutine(env, child, emptyRoutine(date));
}

export interface RoutineBlockView extends RoutineBlock {
  kindLabel: string;
  status: "done" | "current" | "todo";
}

export interface RoutineView {
  blocks: RoutineBlockView[];
  totalMinutes: number;
  leisureMinutes: number;
  leisureLeft: number;
  editable: boolean;
  started: boolean;
  finished: boolean;
  currentIndex: number | null;
  startedAt: string | null;
}

export function toView(routine: Routine): RoutineView {
  return {
    blocks: routine.blocks.map((block, index) => ({
      ...block,
      kindLabel: findKind(block.kind)?.label ?? block.kind,
      status:
        routine.finished || (routine.currentIndex !== null && index < routine.currentIndex)
          ? "done"
          : index === routine.currentIndex
            ? "current"
            : "todo"
    })),
    totalMinutes: totalMinutes(routine.blocks),
    leisureMinutes: leisureMinutes(routine.blocks),
    leisureLeft: leisureLeft(routine.blocks),
    editable: isEditable(routine),
    started: routine.currentIndex !== null,
    finished: routine.finished,
    currentIndex: routine.currentIndex,
    startedAt: routine.startedAt
  };
}
