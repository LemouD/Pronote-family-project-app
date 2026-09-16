/** Helpers partages par l'espace enfant (render.ts) et l'espace parent (parentShell.ts). */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * item.color vient de Pronote (couleur de matiere), donc d'une source externe.
 * On la valide comme vraie couleur hex plutot que de se fier au seul echappement
 * HTML avant de l'inserer dans un attribut style, pour fermer toute injection CSS.
 */
export function safeColor(color: string): string {
  return HEX_COLOR.test(color) ? color : "#999";
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function dayLabel(deadlineISO: string): string {
  const deadline = new Date(deadlineISO);
  const diffDays = Math.round((startOfDay(deadline) - startOfDay(new Date())) / 86_400_000);

  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Demain";
  if (diffDays === -1) return "Hier";
  return deadline.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

export function groupByDay<T extends { deadline: string }>(items: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const label = dayLabel(item.deadline);
    const list = groups.get(label) ?? [];
    list.push(item);
    groups.set(label, list);
  }
  return groups;
}

/** "il y a 12 min" / "il y a 3 h" - pour dater la derniere synchro Pronote. */
export function relativeTime(iso: string): string {
  const elapsedMinutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (elapsedMinutes < 1) return "a l'instant";
  if (elapsedMinutes < 60) return `il y a ${elapsedMinutes} min`;

  const hours = Math.round(elapsedMinutes / 60);
  if (hours < 24) return `il y a ${hours} h`;

  const days = Math.round(hours / 24);
  return days === 1 ? "hier" : `il y a ${days} jours`;
}

/**
 * Date du jour a Paris, au format AAAA-MM-JJ. Le Worker tourne en UTC : sans
 * ce decalage, le changement de jour se ferait a 1h ou 2h du matin heure
 * francaise au lieu de minuit.
 */
export function todayInParis(): string {
  return new Date().toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" });
}

/**
 * Lundi de la semaine en cours, AAAA-MM-JJ. Sert de frontiere de purge : tout
 * ce qui precede appartient a la semaine ecoulee et disparait des listes.
 *
 * Le calcul se fait en UTC sur une date sans heure, pour que le decalage
 * horaire ne fasse jamais basculer d'un jour.
 */
export function startOfWeekInParis(): string {
  const date = new Date(`${todayInParis()}T00:00:00Z`);
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return date.toISOString().slice(0, 10);
}

/** true si l'element appartient a la semaine en cours (ou au futur). */
export function isThisWeekOrLater(isoDate: string): boolean {
  return isoDate.slice(0, 10) >= startOfWeekInParis();
}

/** "16 septembre a 12:42" - date d'une seance, cote prof comme cote parent. */
export function formatSessionDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris"
  });
}
