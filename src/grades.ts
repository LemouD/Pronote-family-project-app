import type { ChildConfig } from "./children";
import type { Env } from "./env";

/**
 * Notes importees par bootstrap/sync_homework.py. Tout est recalcule ici a
 * partir des notes brutes : Pronote expose bien des moyennes, mais elles ne
 * couvrent pas la meme periode selon l'etablissement, et on a de toute facon
 * besoin du detail note par note pour tracer une evolution.
 */

export interface RawGrade {
  id: string;
  subject: string;
  /** AAAA-MM-JJ */
  date: string;
  value: number;
  outOf: number;
  coefficient: number;
  classAverage: number | null;
  period: string;
}

function gradesKey(child: ChildConfig): string {
  return `grades-external:${child.slug}`;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Une entree incoherente (bareme a zero, date absente) produirait des NaN qui
 * remonteraient jusque dans les coordonnees SVG et casseraient le graphique en
 * silence. On filtre a l'entree plutot que de s'en proteger partout ensuite.
 */
function isValidGrade(value: unknown): value is RawGrade {
  const grade = value as RawGrade;
  return (
    typeof grade?.id === "string" &&
    typeof grade.subject === "string" &&
    typeof grade.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(grade.date) &&
    isFiniteNumber(grade.value) &&
    isFiniteNumber(grade.outOf) &&
    grade.outOf > 0 &&
    isFiniteNumber(grade.coefficient) &&
    grade.coefficient > 0
  );
}

export async function getGrades(env: Env, child: ChildConfig): Promise<RawGrade[]> {
  const stored = await env.PRONOTE_CACHE.get(gradesKey(child), "json");
  if (!Array.isArray(stored)) return [];

  return stored.filter(isValidGrade).sort((a, b) => a.date.localeCompare(b.date));
}

/** Note ramenee sur 20, seule echelle comparable entre matieres. */
function outOf20(grade: RawGrade): number {
  return (grade.value / grade.outOf) * 20;
}

function weightedAverage(grades: RawGrade[]): number | null {
  if (grades.length === 0) return null;

  let weighted = 0;
  let weight = 0;
  for (const grade of grades) {
    weighted += outOf20(grade) * grade.coefficient;
    weight += grade.coefficient;
  }
  return weight === 0 ? null : weighted / weight;
}

export interface SeriesPoint {
  date: string;
  value: number;
}

export interface Series {
  label: string;
  points: SeriesPoint[];
}

/**
 * Moyenne cumulee apres chaque nouvelle note : c'est ce que "l'evolution de la
 * moyenne" veut dire concretement, et ca se calcule a partir d'un seul import
 * puisque chaque note porte sa date - pas besoin d'archiver des instantanes.
 */
function cumulativeAverage(grades: RawGrade[]): SeriesPoint[] {
  const points: SeriesPoint[] = [];
  let weighted = 0;
  let weight = 0;

  for (const grade of grades) {
    weighted += outOf20(grade) * grade.coefficient;
    weight += grade.coefficient;
    if (weight === 0) continue;

    const value = weighted / weight;
    const last = points[points.length - 1];
    // Plusieurs notes le meme jour : un seul point, celui d'apres la derniere.
    if (last && last.date === grade.date) last.value = value;
    else points.push({ date: grade.date, value });
  }

  return points;
}

export function overallEvolution(grades: RawGrade[]): Series {
  return { label: "Moyenne generale", points: cumulativeAverage(grades) };
}

export function subjectEvolution(grades: RawGrade[]): Series[] {
  const bySubject = new Map<string, RawGrade[]>();
  for (const grade of grades) {
    const list = bySubject.get(grade.subject) ?? [];
    list.push(grade);
    bySubject.set(grade.subject, list);
  }

  return [...bySubject.entries()]
    .map(([subject, list]) => ({ label: subject, points: cumulativeAverage(list) }))
    .sort((a, b) => a.label.localeCompare(b.label, "fr"));
}

export interface SubjectSummary {
  subject: string;
  /** Moyenne de l'enfant dans la matiere, sur 20. */
  average: number;
  /** Moyenne de la classe si Pronote la fournit, sur 20. */
  classAverage: number | null;
  latest: RawGrade;
  count: number;
}

export function summarizeBySubject(grades: RawGrade[]): SubjectSummary[] {
  const bySubject = new Map<string, RawGrade[]>();
  for (const grade of grades) {
    const list = bySubject.get(grade.subject) ?? [];
    list.push(grade);
    bySubject.set(grade.subject, list);
  }

  return [...bySubject.entries()]
    .map(([subject, list]) => {
      const withClassAverage = list.filter((grade) => isFiniteNumber(grade.classAverage));
      const classAverage =
        withClassAverage.length === 0
          ? null
          : withClassAverage.reduce((sum, grade) => sum + ((grade.classAverage as number) / grade.outOf) * 20, 0) /
            withClassAverage.length;

      return {
        subject,
        average: weightedAverage(list) ?? 0,
        classAverage,
        latest: list[list.length - 1],
        count: list.length
      };
    })
    .sort((a, b) => a.subject.localeCompare(b.subject, "fr"));
}

export function overallAverage(grades: RawGrade[]): number | null {
  return weightedAverage(grades);
}

/** "13,5" - separateur decimal francais, une decimale. */
export function formatGrade(value: number): string {
  return value.toFixed(1).replace(".", ",");
}

export interface RecentGrade {
  subject: string;
  date: string;
  /** Note ramenee sur 20, seule echelle comparable entre matieres. */
  outOf20: number;
}

/** Les dernieres notes, pour l'apercu de la vue d'ensemble. */
export function recentGrades(grades: RawGrade[], limit = 3): RecentGrade[] {
  return grades
    .slice(-limit)
    .reverse()
    .map((grade) => ({ subject: grade.subject, date: grade.date, outOf20: outOf20(grade) }));
}
