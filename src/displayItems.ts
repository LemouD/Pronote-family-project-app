import type { CustomTask } from "./customTasks";
import type { HomeworkItem } from "./pronote";

/** Couleur fixe des taches perso (distincte des couleurs de matiere Pronote). */
const CUSTOM_TASK_COLOR = "#a855f7";

/**
 * Element affichable, qu'il vienne de Pronote (devoir) ou d'un parent (tache
 * perso). "source" pilote le badge affiche ("Pronote" vs le nom du parent)
 * pour que ce soit toujours visible d'ou vient chaque element.
 */
export interface DisplayItem extends HomeworkItem {
  source: "pronote" | "custom";
  /** Uniquement pour source === "custom" : qui a ajoute la tache. */
  author?: string;
}

export function mergeForDisplay(homework: HomeworkItem[], customTasks: CustomTask[]): DisplayItem[] {
  const fromPronote: DisplayItem[] = homework.map((item) => ({ ...item, source: "pronote" }));
  const fromCustom: DisplayItem[] = customTasks.map((task) => ({
    id: task.id,
    subject: "Tâche",
    description: task.description,
    done: task.done,
    deadline: task.deadline,
    color: CUSTOM_TASK_COLOR,
    source: "custom",
    author: task.createdBy
  }));

  return [...fromPronote, ...fromCustom].sort((a, b) => a.deadline.localeCompare(b.deadline));
}
