import { renderLineChart } from "./charts";
import type { ChildConfig } from "./children";
import { formatGrade, type Series, type SubjectSummary } from "./grades";
import type { ExamSession } from "./examPrep";
import type { RecentGrade } from "./grades";
import type { AppliedExercise, Proposal, TutorNote } from "./homeTutoring";
import { dayLabel, escapeHtml, formatSessionDate, relativeTime } from "./html";
import type { ParentDisplayItem } from "./parentView";
import {
  ACTU_CATEGORIES,
  ACTU_LABEL,
  type ActuCategoryId,
  type ActuConfig,
  QUIZ_THEMES
} from "./actu";
import { COMPETITIONS, type Team } from "./actuFootball";
import { MAX_SUBJECTS } from "./homeTutoring";
import { GAME_GENRES } from "./actuGames";
import { ROUTINE_LABEL, type RoutineView } from "./routine";
import { prayersFor } from "./prayers";
import { type AccentPreset, DEFAULT_PARENT_PREFERENCES, type ParentPreferences, THEME_LABELS, THEMES } from "./preferences";
import type { ExternalSyncStatus } from "./pronote";

export interface ParentChildData {
  child: ChildConfig;
  items: ParentDisplayItem[];
  error?: string;
  sync: ExternalSyncStatus;
  prayers: { done: number; total: number };
  /** Couleur choisie par l'enfant dans ses propres reglages. */
  accent: AccentPreset;
  /** false = la page de cet enfant est inaccessible tant qu'aucun code n'est defini. */
  hasPin: boolean;
  /** Idem pour la page du prof de maison. */
  hasTutorPin: boolean;
  /** Exercices de preparation d'examen termines depuis la derniere visite. */
  examCompleted: ExamSession[];
  /** Seances et propositions en attente d'une action du parent. */
  tutoringPending: number;
  /** Dernieres notes importees, les plus recentes d'abord. */
  recentGrades: RecentGrade[];
  /** Routine du jour composee par l'enfant. Lecture seule ici. */
  routine: RoutineView;
  /** Matieres travaillees avec le prof de maison, modifiables par le parent. */
  subjects: string[];
}

/** Au-dela de ce delai sans import reussi, la synchro externe est signalee comme en retard. */
const SYNC_STALE_AFTER_HOURS = 8;

/**
 * Chaque enfant a une couleur d'identification, declinee clair/sombre. Elle
 * est publiee en variables CSS sur l'element : la feuille de styles choisit
 * ensuite la variante selon le theme (un style inline gagnerait sur la media
 * query, donc on expose les deux et c'est le CSS qui tranche).
 */
function childColorVars(accent: AccentPreset): string {
  return (
    `--c-light:${accent.light};--c-dark:${accent.dark};` +
    `--s-light:${accent.softLight};--s-dark:${accent.softDark}`
  );
}

function todayLabel(): string {
  const formatted = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

interface SyncAlert {
  level: "ok" | "warn" | "danger";
  title: string;
  detail: string;
}

function syncAlert(entry: ParentChildData): SyncAlert {
  const name = entry.child.displayName;
  if (!entry.sync.externallySynced) {
    return { level: "ok", title: `${name} en connexion directe`, detail: "Les devoirs sont lus depuis Pronote a la demande." };
  }
  if (!entry.sync.syncedAt) {
    // Pas une panne mais une mise en service qui reste a faire : en rouge, cet
    // avertissement resterait allume des jours et apprendrait a ignorer les
    // alertes, y compris les vraies.
    return {
      level: "warn",
      title: `${name} pas encore connecte a Pronote`,
      detail: "Ses devoirs n'apparaitront qu'une fois le bootstrap lance avec ses identifiants."
    };
  }

  const elapsedHours = (Date.now() - new Date(entry.sync.syncedAt).getTime()) / 3_600_000;
  if (elapsedHours > SYNC_STALE_AFTER_HOURS) {
    return {
      level: "danger",
      title: `Synchro ${name} en retard`,
      detail: `Derniere reussite ${relativeTime(entry.sync.syncedAt)} - verifier GitHub Actions.`
    };
  }
  return { level: "ok", title: `Synchro ${name}`, detail: `Mise a jour ${relativeTime(entry.sync.syncedAt)}` };
}

export function renderOverview(data: ParentChildData[]): string {
  const cards = data
    .map((entry) => {
      const total = entry.items.length;
      const done = entry.items.filter((item) => item.done).length;
      const percent = total === 0 ? 0 : Math.round((done / total) * 100);

      return `
        <section class="card" style="${childColorVars(entry.accent)}">
          <div class="child-head">
            <div class="child-avatar">${escapeHtml(entry.child.displayName.slice(0, 1))}</div>
            <div>
              <div class="child-name">${escapeHtml(entry.child.displayName)}</div>
              <div class="child-year">${escapeHtml(entry.child.schoolYear)}</div>
            </div>
          </div>
          ${entry.error ? `<div class="alert alert-danger"><div class="alert-bar"></div><div><div class="alert-title">${escapeHtml(entry.error)}</div></div></div>` : ""}
          <div style="display:flex;flex-direction:column;gap:12px">
            <div>
              <div class="meter-label">
                <span>Devoirs (aujourd'hui/demain)</span>
                <span>${done}/${total}</span>
              </div>
              <div class="meter"><div style="width:${percent}%"></div></div>
            </div>
            <div>
              <div class="meter-label">
                <span>Prieres aujourd'hui</span>
                <span>${entry.prayers.done}/${entry.prayers.total}</span>
              </div>
              <div class="meter"><div style="width:${
                entry.prayers.total === 0 ? 0 : Math.round((entry.prayers.done / entry.prayers.total) * 100)
              }%"></div></div>
            </div>
          </div>
        </section>
      `;
    })
    .join("");

  // Notification : ce que l'enfant a termine depuis la derniere fois que le
  // parent a ouvert cette page. Consommee par markExamSeen (voir index.ts).
  const examDone = data
    .filter((entry) => entry.examCompleted.length > 0)
    .map((entry) => ({
      level: "ok" as const,
      title: `${entry.child.displayName} a termine ${entry.examCompleted.length} exercice(s) de revision`,
      detail: entry.examCompleted.map((session) => `${session.subjectLabel} - ${session.topic}`).join(" | ")
    }));

  const missingPin = data
    .filter((entry) => !entry.hasPin)
    .map((entry) => ({
      level: "danger" as const,
      title: `Aucun code pour ${entry.child.displayName}`,
      detail: "Sa page est bloquee tant que tu ne lui en donnes pas un, dans Reglages."
    }));

  const alerts = [...examDone, ...missingPin, ...data.map((entry) => syncAlert(entry))]
    .map(
      (alert) => `
        <div class="alert alert-${alert.level}">
          <div class="alert-bar"></div>
          <div>
            <div class="alert-title">${escapeHtml(alert.title)}</div>
            <div class="alert-detail">${escapeHtml(alert.detail)}</div>
          </div>
        </div>
      `
    )
    .join("");

  const totalPending = data.reduce((total, entry) => total + entry.tutoringPending, 0);

  const pendingRows = data
    .filter((entry) => entry.tutoringPending > 0)
    .map(
      (entry) => `
        <div style="display:flex;justify-content:space-between;gap:10px;font-size:12.5px">
          <span style="font-weight:600">${escapeHtml(entry.child.displayName)}</span>
          <span class="muted">${entry.tutoringPending} en attente</span>
        </div>
      `
    )
    .join("");

  // Lecture seule, volontairement : l'enfant reste seul organisateur de son
  // temps, le parent regarde sans pouvoir corriger.
  const routineRows = data
    .filter((entry) => entry.routine.blocks.length > 0)
    .map((entry) => {
      const state = entry.routine.finished
        ? "Termine"
        : entry.routine.started
          ? "En cours"
          : "Pas encore demarre";

      const blocks = entry.routine.blocks
        .map(
          (block) => `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:12.5px">
              <span style="min-width:0;overflow-wrap:anywhere">
                <b style="font-weight:${block.status === "current" ? 700 : 600}">${escapeHtml(block.label)}</b>
                <span class="muted"> · ${escapeHtml(block.kindLabel)}</span>
              </span>
              <span class="muted" style="white-space:nowrap">${block.minutes} min${
                block.status === "current" ? " ◂" : block.status === "done" ? " ✓" : ""
              }</span>
            </div>
          `
        )
        .join("");

      return `
        <div>
          <div style="display:flex;justify-content:space-between;gap:10px;margin-bottom:8px">
            <span style="font-weight:700;font-size:13px">${escapeHtml(entry.child.displayName)}</span>
            <span class="muted" style="font-size:12px">${escapeHtml(state)}</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px">${blocks}</div>
        </div>
      `;
    })
    .join("");

  const recentRows = data
    .flatMap((entry) => entry.recentGrades.map((grade) => ({ entry, grade })))
    .sort((a, b) => b.grade.date.localeCompare(a.grade.date))
    .slice(0, 4)
    .map(
      ({ entry, grade }) => `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
          <div style="min-width:0">
            <div style="font-size:12.5px;font-weight:600;overflow-wrap:anywhere">${escapeHtml(grade.subject)}</div>
            <div class="grade-class">${escapeHtml(entry.child.displayName)}</div>
          </div>
          <div class="grade-value">${escapeHtml(formatGrade(grade.outOf20))}/20</div>
        </div>
      `
    )
    .join("");

  return `
    <div class="grid-children">${cards || `<div class="card"><p class="empty">Aucun enfant configure.</p></div>`}</div>
    <div class="grid-lower">
      <section class="card">
        <div class="card-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
          Alertes
        </div>
        <div style="display:flex;flex-direction:column;gap:10px">${alerts}</div>
      </section>
      <section class="card">
        <div class="card-title">
          Devoir maison a valider
          ${totalPending > 0 ? `<span class="count">${totalPending}</span>` : ""}
        </div>
        ${
          totalPending > 0
            ? `<div style="display:flex;flex-direction:column;gap:10px">${pendingRows}</div>
               <a class="muted" href="/parent/devoir-maison">Ouvrir</a>`
            : `<p class="empty">Rien a valider pour le moment.</p>`
        }
      </section>
      <section class="card">
        <div class="card-title">${escapeHtml(ROUTINE_LABEL)}</div>
        ${
          routineRows
            ? `<div style="display:flex;flex-direction:column;gap:14px">${routineRows}</div>`
            : `<p class="empty">Aucun des enfants n'a organise sa soiree aujourd'hui.</p>`
        }
      </section>
      <section class="card">
        <div class="card-title">Notes recentes</div>
        ${
          recentRows
            ? `<div style="display:flex;flex-direction:column;gap:10px">${recentRows}</div>`
            : `<p class="empty">Aucune note importee pour le moment.</p>`
        }
      </section>
    </div>
  `;
}

export const OVERVIEW_SUBTITLE = todayLabel;

export interface DevoirsFilters {
  childSlug: string | null;
  status: "all" | "done" | "todo";
}

/**
 * Filtres en controle segmente : de simples liens, donc pas de JavaScript et
 * l'etat courant reste dans l'URL (partageable, rechargeable).
 */
function renderFilters(data: ParentChildData[], filters: DevoirsFilters): string {
  const link = (params: { enfant?: string; statut?: string }, label: string, active: boolean) => {
    const query = new URLSearchParams();
    if (params.enfant) query.set("enfant", params.enfant);
    if (params.statut) query.set("statut", params.statut);
    const suffix = query.toString();
    return `<a href="/parent/devoirs${suffix ? `?${suffix}` : ""}"${active ? ' class="active"' : ""}>${escapeHtml(label)}</a>`;
  };

  const status = filters.status === "all" ? undefined : filters.status;
  const child = filters.childSlug ?? undefined;

  return `
    <div class="filters">
      <div class="segmented">
        ${link({ statut: status }, "Tous", filters.childSlug === null)}
        ${data.map((entry) => link({ enfant: entry.child.slug, statut: status }, entry.child.displayName, filters.childSlug === entry.child.slug)).join("")}
      </div>
      <div class="segmented">
        ${link({ enfant: child }, "Tous", filters.status === "all")}
        ${link({ enfant: child, statut: "done" }, "Fait", filters.status === "done")}
        ${link({ enfant: child, statut: "todo" }, "A faire", filters.status === "todo")}
      </div>
    </div>
  `;
}

export function renderDevoirsToolbar(data: ParentChildData[], filters: DevoirsFilters): string {
  return renderFilters(data, filters);
}

function renderAddTaskForm(data: ParentChildData[]): string {
  const options = data
    .map((entry) => `<option value="${escapeHtml(entry.child.slug)}">${escapeHtml(entry.child.displayName)}</option>`)
    .join("");

  return `
    <form class="add-task-form">
      <select name="childSlug" aria-label="Enfant">${options}</select>
      <input type="text" name="description" placeholder="Ajouter une tache..." maxlength="300" required />
      <input type="text" name="createdBy" placeholder="Maman / Papa" maxlength="30" required list="task-authors" />
      <datalist id="task-authors"><option value="Maman"></option><option value="Papa"></option></datalist>
      <select name="day" aria-label="Jour">
        <option value="today">Aujourd'hui</option>
        <option value="tomorrow">Demain</option>
      </select>
      <button type="submit">Ajouter</button>
    </form>
  `;
}

export function renderDevoirs(data: ParentChildData[], filters: DevoirsFilters): string {
  const rows = data
    .filter((entry) => filters.childSlug === null || entry.child.slug === filters.childSlug)
    .flatMap((entry) =>
      entry.items
        .filter((item) => {
          if (filters.status === "done") return item.done;
          if (filters.status === "todo") return !item.done;
          return true;
        })
        .map((item) => ({ entry, item }))
    )
    .sort((a, b) => a.item.deadline.localeCompare(b.item.deadline));

  const body = rows
    .map(
      ({ entry, item }) => `
        <div class="row ${item.done ? "row-done" : ""}" style="${childColorVars(entry.accent)}">
          <div class="row-child"><span class="dot"></span>${escapeHtml(entry.child.displayName)}</div>
          <div class="row-muted row-subject">${escapeHtml(item.source === "pronote" ? item.subject : (item.author ?? "Tache"))}</div>
          <div class="row-text">${escapeHtml(item.description || "(pas de description)")}</div>
          <div class="row-muted row-due">${escapeHtml(dayLabel(item.deadline))}</div>
          <div>
            <span class="badge ${item.done ? "badge-done" : "badge-todo"}">${item.done ? "Fait" : "A faire"}</span>
            ${item.isNew ? ' <span class="badge badge-new">Nouveau</span>' : ""}
          </div>
        </div>
      `
    )
    .join("");

  const errors = data
    .filter((entry) => entry.error)
    .map(
      (entry) => `
        <div class="alert alert-danger">
          <div class="alert-bar"></div>
          <div><div class="alert-title">${escapeHtml(entry.child.displayName)}</div><div class="alert-detail">${escapeHtml(entry.error ?? "")}</div></div>
        </div>
      `
    )
    .join("");

  return `
    ${errors}
    <div class="table-card">
      <div class="row row-head">
        <div>Enfant</div><div>Matiere</div><div>Devoir</div><div>Echeance</div><div>Statut</div>
      </div>
      ${body || `<div class="row"><p class="empty">Aucun devoir ne correspond a ce filtre.</p></div>`}
    </div>
    ${renderAddTaskForm(data)}
  `;
}

/**
 * Le token n'est plus lu depuis l'URL : apres l'echange initial il vit dans un
 * cookie HttpOnly SameSite=Strict, envoye automatiquement sur cet appel
 * same-origin. C'est aussi ce qui protege l'endpoint contre un POST declenche
 * depuis un autre site.
 */
export const ADD_TASK_SCRIPT = `
  document.addEventListener("submit", async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.classList.contains("add-task-form")) return;
    event.preventDefault();

    const childSlug = form.elements.namedItem("childSlug");
    const description = form.elements.namedItem("description");
    const createdBy = form.elements.namedItem("createdBy");
    const day = form.elements.namedItem("day");
    if (!(childSlug instanceof HTMLSelectElement) || !(description instanceof HTMLInputElement) || !(createdBy instanceof HTMLInputElement) || !(day instanceof HTMLSelectElement)) return;

    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton instanceof HTMLButtonElement) submitButton.disabled = true;
    try {
      const response = await fetch("/enfant/" + encodeURIComponent(childSlug.value) + "/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description.value, createdBy: createdBy.value, day: day.value })
      });
      if (!response.ok) throw new Error("request failed");
      location.reload();
    } catch (error) {
      alert("Impossible d'ajouter la tache, reessaie.");
      if (submitButton instanceof HTMLButtonElement) submitButton.disabled = false;
    }
  });
`;

const TREND_UP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4 14 9 8 13 12 20 4"/></svg>`;
const TREND_DOWN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4 6 9 12 13 8 20 16"/></svg>`;

export interface ChildGrades {
  child: ChildConfig;
  /** Couleur choisie par l'enfant, pour rester coherent avec les autres pages. */
  accent: AccentPreset;
  overall: number | null;
  subjects: SubjectSummary[];
  overallSeries: Series;
  subjectSeries: Series[];
}

export function renderNotes(data: ChildGrades[]): string {
  return data
    .map((entry) => {
      if (entry.subjects.length === 0) {
        return `
          <section class="card" style="${childColorVars(entry.accent)}">
            <div class="child-head" style="margin-bottom:12px">
              <div class="child-avatar" style="width:34px;height:34px;flex-basis:34px;font-size:13px">${escapeHtml(entry.child.displayName.slice(0, 1))}</div>
              <div class="child-name">${escapeHtml(entry.child.displayName)}</div>
            </div>
            <p class="empty">Aucune note importee pour le moment. Elles arriveront a la prochaine synchronisation.</p>
          </section>
        `;
      }

      const rows = entry.subjects
        .map((subject) => {
          const better = subject.classAverage !== null && subject.average >= subject.classAverage;
          const trend =
            subject.classAverage === null
              ? ""
              : `<span class="grade-trend ${better ? "trend-up" : "trend-down"}">${better ? TREND_UP : TREND_DOWN}</span>`;

          return `
            <div class="grade-row">
              <div>
                <div class="grade-subject">${escapeHtml(subject.subject)}</div>
                <div class="grade-class">${
                  subject.classAverage === null
                    ? `${subject.count} note(s)`
                    : `Moyenne classe ${escapeHtml(formatGrade(subject.classAverage))}/20`
                }</div>
              </div>
              <div style="display:flex;align-items:center;gap:10px">
                ${trend}
                <div class="grade-value">${escapeHtml(formatGrade(subject.average))}/20</div>
              </div>
            </div>
          `;
        })
        .join("");

      return `
        <section class="card" style="${childColorVars(entry.accent)}">
          <div class="child-head" style="margin-bottom:12px">
            <div class="child-avatar" style="width:34px;height:34px;flex-basis:34px;font-size:13px">${escapeHtml(entry.child.displayName.slice(0, 1))}</div>
            <div class="child-name">${escapeHtml(entry.child.displayName)}</div>
          </div>
          <div class="grade-headline">
            <strong>${entry.overall === null ? "-" : escapeHtml(formatGrade(entry.overall))}</strong>
            <span class="grade-class">de moyenne generale sur 20</span>
          </div>

          <div class="chart-block" style="margin-top:16px">
            <div class="chart-heading">Evolution de la moyenne generale</div>
            ${renderLineChart([entry.overallSeries], { title: `Moyenne generale de ${entry.child.displayName}` })}
          </div>
          <div class="chart-block">
            <div class="chart-heading">Evolution de la moyenne par matiere</div>
            ${renderLineChart(entry.subjectSeries, { title: `Moyennes par matiere de ${entry.child.displayName}` })}
          </div>

          <div style="margin-top:6px">${rows}</div>
        </section>
      `;
    })
    .join("");
}

export interface TutoringView {
  child: ChildConfig;
  accent: AccentPreset;
  /** Seances notees par le prof pour lesquelles aucun exercice n'a encore ete genere. */
  pendingNotes: TutorNote[];
  proposals: { proposal: Proposal; note?: TutorNote }[];
  applied: AppliedExercise[];
}

function childBadge(entry: { child: ChildConfig; accent: AccentPreset }, subject: string): string {
  return `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;${childColorVars(entry.accent)}">
      <span class="child-avatar" style="width:26px;height:26px;flex-basis:26px;font-size:11.5px">${escapeHtml(
        entry.child.displayName.slice(0, 1)
      )}</span>
      <span style="font-weight:700;font-size:13.5px">${escapeHtml(entry.child.displayName)}</span>
      <span style="color:var(--text-secondary);font-size:12.5px">· ${escapeHtml(subject)}</span>
    </div>
  `;
}

function tutorNoteBlock(note: TutorNote): string {
  return `
    <div class="section-label">Seance du ${escapeHtml(formatSessionDate(note.createdAt))}</div>
    <div style="font-size:13px;line-height:1.5;margin-bottom:12px;white-space:pre-wrap;overflow-wrap:anywhere">${escapeHtml(
      note.done || "(non precise)"
    )}</div>
    <div class="section-label">Difficulte notee</div>
    <div style="font-size:13px;line-height:1.5;color:var(--warning);white-space:pre-wrap;overflow-wrap:anywhere">${escapeHtml(
      note.difficulty || "(non precisee)"
    )}</div>
  `;
}

/**
 * Le texte genere est presente dans un champ modifiable, et c'est son contenu
 * au moment du clic qui part chez l'enfant : le parent peut donc corriger le
 * modele avant publication, ce qui est le seul vrai garde-fou sur un texte
 * ecrit a partir d'une note venue de l'exterieur.
 */
export function renderDevoirMaison(views: TutoringView[], options: { error?: string; aiConfigured: boolean }): string {
  const toGenerate = views.flatMap((view) => view.pendingNotes.map((note) => ({ view, note })));
  const pending = views.flatMap((view) => view.proposals.map((entry) => ({ view, ...entry })));
  const applied = views.flatMap((view) => view.applied.map((item) => ({ view, item })));

  const generateCards = toGenerate
    .map(
      ({ view, note }) => `
        <section class="card">
          ${childBadge(view, note.subject)}
          ${tutorNoteBlock(note)}
          <form method="post" action="/parent/devoir-maison/generer" style="margin-top:14px">
            <input type="hidden" name="childSlug" value="${escapeHtml(view.child.slug)}" />
            <input type="hidden" name="noteId" value="${escapeHtml(note.id)}" />
            <button type="submit" class="save-button"${options.aiConfigured ? "" : " disabled"}>Generer un exercice</button>
          </form>
        </section>
      `
    )
    .join("");

  const pendingCards = pending
    .map(
      ({ view, proposal, note }) => `
        <section class="card dm-card">
          <div>
            ${childBadge(view, proposal.subject)}
            ${note ? tutorNoteBlock(note) : `<p class="empty">La note d'origine a ete purgee.</p>`}
          </div>
          <div style="display:flex;flex-direction:column">
            <div class="section-label">Exercice genere par l'IA</div>
            <form method="post" action="/parent/devoir-maison/appliquer" style="display:flex;flex-direction:column;flex:1">
              <input type="hidden" name="childSlug" value="${escapeHtml(view.child.slug)}" />
              <input type="hidden" name="proposalId" value="${escapeHtml(proposal.id)}" />
              <textarea name="exercise" class="dm-exercise" maxlength="2000">${escapeHtml(proposal.exercise)}</textarea>
              <div class="dm-actions">
                <button type="submit" formaction="/parent/devoir-maison/supprimer" class="ghost-button danger">Supprimer</button>
                <button type="submit" formaction="/parent/devoir-maison/regenerer" class="ghost-button"${
                  options.aiConfigured ? "" : " disabled"
                }>Regenerer</button>
                <button type="submit" class="save-button">Appliquer</button>
              </div>
            </form>
          </div>
        </section>
      `
    )
    .join("");

  const appliedRows = applied
    .map(
      ({ view, item }) => `
        <div class="dm-applied">
          <div style="font-size:13px;overflow-wrap:anywhere"><b>${escapeHtml(view.child.displayName)}</b> · ${escapeHtml(
            item.subject
          )} — ${escapeHtml(item.exercise.split("\n")[0].slice(0, 120))}</div>
          <div style="display:flex;align-items:center;gap:12px">
            <span class="badge ${item.done ? "badge-done" : "badge-todo"}">${item.done ? "Fait" : "A faire"}</span>
            <form method="post" action="/parent/devoir-maison/retirer">
              <input type="hidden" name="childSlug" value="${escapeHtml(view.child.slug)}" />
              <input type="hidden" name="appliedId" value="${escapeHtml(item.id)}" />
              <button type="submit" class="ghost-button danger">Retirer</button>
            </form>
          </div>
        </div>
      `
    )
    .join("");

  return `
    ${options.error ? `<div class="notice notice-error">${escapeHtml(options.error)}</div>` : ""}
    ${
      options.aiConfigured
        ? ""
        : `<div class="notice notice-warn">La generation est inactive tant que le secret GEMINI_API_KEY n'est pas defini sur le Worker. Les seances du prof sont bien enregistrees en attendant.</div>`
    }

    ${toGenerate.length ? `<div class="section-label">Seances a traiter</div>${generateCards}` : ""}
    ${pending.length ? `<div class="section-label">En attente de validation</div>${pendingCards}` : ""}
    ${
      toGenerate.length === 0 && pending.length === 0
        ? `<div class="card"><p class="empty">Rien a valider. Les seances notees par le prof de maison apparaitront ici.</p></div>`
        : ""
    }
    ${appliedRows ? `<div class="section-label" style="margin-top:8px">Deja appliques</div>${appliedRows}` : ""}
  `;
}

/**
 * Reglages propres a CET appareil. Maman et Papa partagent le meme token
 * d'acces : un prenom stocke cote serveur serait ecrase par l'autre, donc il
 * vit dans un cookie et chacun installe l'application avec le sien.
 */
function renderParentPreferencesForm(prefs: ParentPreferences): string {
  const themeChoices = THEMES.map(
    (theme) => `
      <label>
        <input type="radio" name="theme" value="${escapeHtml(theme)}" ${prefs.theme === theme ? "checked" : ""} />
        ${escapeHtml(THEME_LABELS[theme])}
      </label>
    `
  ).join("");

  return `
    <section class="card">
      <div class="card-title">Cet appareil</div>
      <form method="post" action="/parent/reglages">
        <div class="field">
          <label for="parent-name">Votre prenom</label>
          <input type="text" id="parent-name" name="name" maxlength="20" value="${escapeHtml(prefs.name)}" placeholder="${escapeHtml(
            DEFAULT_PARENT_PREFERENCES.name
          )}" />
        </div>
        <div class="field">
          <label>Affichage</label>
          <div class="radio-row">${themeChoices}</div>
        </div>
        <button type="submit" class="save-button">Enregistrer</button>
      </form>
      <p class="empty" style="margin-top:12px">Ces deux reglages ne valent que sur cet appareil : Maman et Papa peuvent avoir chacun le sien.</p>
    </section>
  `;
}

/** Tout ce qu'il faut pour rendre le bloc Actu d'un enfant dans Reglages. */
export interface ActuSettingsView {
  childSlug: string;
  config: ActuConfig;
  /** Categories cochables mais dont le secret manque sur le Worker. */
  missingSecrets: ActuCategoryId[];
  /** Championnat en cours de consultation, pour peupler la liste des clubs. */
  competitionCode: string | null;
  teams: Team[];
}

/**
 * Bloc de configuration de la section Actu. Tout est eteint au depart : c'est
 * le parent qui ouvre la section et choisit les categories, jamais l'inverse.
 *
 * Le choix du club se fait en deux temps, sans JavaScript : choisir un
 * championnat recharge la page avec ses clubs, puis on enregistre.
 */
function renderActuSettings(view: ActuSettingsView, childName: string): string {
  const categories = ACTU_CATEGORIES.map((category) => {
    const missing = view.missingSecrets.includes(category.id);
    return `
      <label class="actu-option${missing ? " missing" : ""}">
        <input type="checkbox" name="categorie" value="${category.id}"${
          view.config.categories.includes(category.id) ? " checked" : ""
        } />
        <span>
          <b>${escapeHtml(category.label)}</b>
          <span class="muted">${escapeHtml(category.description)}</span>
          ${missing ? `<span class="actu-missing">Cle ${escapeHtml(category.secret ?? "")} absente du Worker</span>` : ""}
        </span>
      </label>
    `;
  }).join("");

  const themes = QUIZ_THEMES.map(
    (theme) =>
      `<option value="${theme.id}"${theme.id === view.config.quizTheme ? " selected" : ""}>${escapeHtml(theme.label)}</option>`
  ).join("");

  const competitions = COMPETITIONS.map(
    (competition) =>
      `<option value="${competition.code}"${
        competition.code === view.competitionCode ? " selected" : ""
      }>${escapeHtml(competition.label)}</option>`
  ).join("");

  const teams = view.teams.length
    ? `<select name="teamId" aria-label="Club de ${escapeHtml(childName)}">
         <option value="">— choisir un club —</option>
         ${view.teams
           .map(
             (team) =>
               `<option value="${team.id}"${
                 team.id === view.config.football?.teamId ? " selected" : ""
               }>${escapeHtml(team.name)}</option>`
           )
           .join("")}
       </select>`
    : view.competitionCode
      // Un championnat est selectionne mais aucun club n'est revenu : c'est
      // l'API qui n'a pas repondu, pas le parent qui a oublie de choisir.
      ? `<p class="empty">Aucun club recupere pour ce championnat. Verifie la cle FOOTBALL_API_KEY sur le Worker.</p>`
      : `<p class="empty">Choisis un championnat ci-dessus et valide pour voir ses clubs.</p>`;

  return `
    <div style="margin-bottom:14px" id="radar-${escapeHtml(view.childSlug)}">
      <div class="section-label">${escapeHtml(ACTU_LABEL)}</div>
      <!-- L'ancre ramene au bloc apres le rechargement : sans elle la page
           repart en haut et la liste des clubs apparait hors de l'ecran. -->
      <form method="get" action="/parent/reglages#radar-${escapeHtml(view.childSlug)}" class="actu-field" style="margin-bottom:12px">
        <span class="section-label">Championnat</span>
        <select name="championnat-${escapeHtml(view.childSlug)}" aria-label="Championnat de ${escapeHtml(childName)}">
          <option value="">— aucun —</option>
          ${competitions}
        </select>
        <button type="submit" class="ghost-button">Voir les clubs</button>
      </form>
      <form method="post" action="/parent/actu" class="actu-form">
        <input type="hidden" name="childSlug" value="${escapeHtml(view.childSlug)}" />
        <label class="actu-option">
          <input type="checkbox" name="active"${view.config.active ? " checked" : ""} />
          <span><b>Ouvrir la section pour ${escapeHtml(childName)}</b>
          <span class="muted">Decoche et l'onglet disparait de son menu.</span></span>
        </label>
        <div class="actu-options">${categories}</div>

        <div class="actu-field">
          <span class="section-label">Genres de jeux autorises</span>
          <p class="empty" style="margin:0 0 6px">Aucun genre coche = aucun jeu affiche. Ce choix est le seul filtre : le catalogue ne porte pas de classification d'age.</p>
          <div class="genre-grid">
            ${GAME_GENRES.map(
              (genre) => `
                <label class="genre-chip">
                  <input type="checkbox" name="genre" value="${genre.id}"${
                    view.config.gameGenres.includes(genre.id) ? " checked" : ""
                  } />
                  <span>${escapeHtml(genre.label)}</span>
                </label>
              `
            ).join("")}
          </div>
        </div>

        <div class="actu-field">
          <span class="section-label">Theme du quiz</span>
          <select name="quizTheme" aria-label="Theme du quiz de ${escapeHtml(childName)}">${themes}</select>
        </div>

        <div class="actu-field">
          <span class="section-label">Club suivi</span>
          ${teams}
          <input type="hidden" name="championnat" value="${escapeHtml(view.competitionCode ?? "")}" />
          ${
            view.config.football
              ? `<p class="empty">Actuellement : ${escapeHtml(view.config.football.teamName)} (${escapeHtml(
                  view.config.football.competitionName
                )}).</p>`
              : ""
          }
        </div>

        <button type="submit" class="save-button">Enregistrer</button>
      </form>
    </div>
  `;
}

/** Rend le bloc Actu d'un enfant, ou rien si sa configuration n'a pas ete chargee. */
function actuBlockFor(view: ActuSettingsView | undefined, childName: string): string {
  return view ? renderActuSettings(view, childName) : "";
}

/** Messages d'erreur de l'edition des matieres, ecrits pour le parent. */
const SUBJECT_ERRORS: Record<string, string> = {
  invalide: "Nom de matiere vide ou invalide.",
  doublon: "Cette matiere est deja dans la liste.",
  "trop-de-matieres": `Maximum ${MAX_SUBJECTS} matieres. Retires-en une avant d'en ajouter.`
};

/**
 * Matieres du prof de maison, modifiables par le parent. Tant qu'il n'a rien
 * change, la liste affichee est celle de children.ts.
 *
 * Retirer une matiere n'efface aucune seance passee : elles portent leur
 * propre libelle, et un historique ne se reecrit pas parce qu'on arrete des
 * cours.
 */
function renderSubjects(entry: ParentChildData): string {
  const chips = entry.subjects.length
    ? entry.subjects
        .map(
          (subject) => `
            <form method="post" action="/parent/matieres" class="subject-chip">
              <input type="hidden" name="childSlug" value="${escapeHtml(entry.child.slug)}" />
              <input type="hidden" name="retirer" value="${escapeHtml(subject)}" />
              <span>${escapeHtml(subject)}</span>
              <button type="submit" aria-label="Retirer ${escapeHtml(subject)}">&times;</button>
            </form>
          `
        )
        .join("")
    : `<p class="empty" style="margin:0">Aucune matiere : le prof ne pourra pas enregistrer de seance.</p>`;

  return `
    <div style="margin-bottom:14px">
      <div class="section-label">Matieres - devoir maison</div>
      <div class="chip-row" style="margin-bottom:8px">${chips}</div>
      <form method="post" action="/parent/matieres" class="pin-set-form">
        <input type="hidden" name="childSlug" value="${escapeHtml(entry.child.slug)}" />
        <input type="text" name="matiere" maxlength="40" autocomplete="off"
               placeholder="Ajouter une matiere" aria-label="Nouvelle matiere pour ${escapeHtml(
                 entry.child.displayName
               )}" required />
        <button type="submit" class="save-button">Ajouter</button>
      </form>
    </div>
  `;
}

export function renderReglages(
  data: ParentChildData[],
  prefs: ParentPreferences,
  actu: ActuSettingsView[],
  options: { subjectError?: string } = {}
): string {
  const actuByChild = new Map(actu.map((entry) => [entry.childSlug, entry]));

  const cards = data
    .map(
      (entry) => `
        <section class="card" style="${childColorVars(entry.accent)}">
          <div class="child-head" style="margin-bottom:16px">
            <div class="child-avatar" style="width:34px;height:34px;flex-basis:34px;font-size:13px">${escapeHtml(entry.child.displayName.slice(0, 1))}</div>
            <div class="child-name">${escapeHtml(entry.child.displayName)}</div>
            <div style="margin-left:auto;font-size:11.5px;color:var(--text-secondary)">/enfant/${escapeHtml(entry.child.slug)}</div>
          </div>
          <div style="margin-bottom:14px">
            <div class="section-label">Synchronisation</div>
            <div class="chip-row">
              <span class="chip">${entry.sync.externallySynced ? "Synchro externe (ENT)" : "Connexion directe"}</span>
              <span class="chip">${escapeHtml(entry.sync.syncedAt ? `Derniere synchro ${relativeTime(entry.sync.syncedAt)}` : "Jamais synchronise")}</span>
            </div>
          </div>
          <div style="margin-bottom:14px">
            <div class="section-label">Code d'acces</div>
            ${
              entry.hasPin
                ? '<p class="empty" style="margin-bottom:8px">Un code est defini. En saisir un nouveau deconnecte tous ses appareils.</p>'
                : '<div class="alert alert-danger" style="margin-bottom:8px"><div class="alert-bar"></div><div><div class="alert-title">Aucun code defini</div><div class="alert-detail">Sa page est bloquee tant qu\'il n\'en a pas un.</div></div></div>'
            }
            <form method="post" action="/parent/code" class="pin-set-form">
              <input type="hidden" name="childSlug" value="${escapeHtml(entry.child.slug)}" />
              <input type="text" name="pin" inputmode="numeric" pattern="[0-9]{5}" maxlength="5" autocomplete="off"
                     placeholder="5 chiffres" aria-label="Code de ${escapeHtml(entry.child.displayName)}" required />
              <button type="submit" class="save-button">${entry.hasPin ? "Changer le code" : "Definir le code"}</button>
            </form>
          </div>
          <div style="margin-bottom:14px">
            <div class="section-label">Page du prof de maison</div>
            ${
              entry.hasTutorPin
                ? '<p class="empty" style="margin-bottom:8px">Un code est defini. En saisir un nouveau deconnecte le prof.</p>'
                : '<div class="alert alert-warn" style="margin-bottom:8px"><div class="alert-bar"></div><div><div class="alert-title">Aucun code defini</div><div class="alert-detail">La page du prof est bloquee tant qu\'il n\'en a pas un.</div></div></div>'
            }
            <p class="empty" style="margin-bottom:8px">Lien a transmettre : <code>/prof/${escapeHtml(entry.child.tutorSlug)}</code></p>
            <form method="post" action="/parent/code" class="pin-set-form">
              <input type="hidden" name="scope" value="tutor" />
              <input type="hidden" name="childSlug" value="${escapeHtml(entry.child.slug)}" />
              <input type="text" name="pin" inputmode="numeric" pattern="[0-9]{5}" maxlength="5" autocomplete="off"
                     placeholder="5 chiffres" aria-label="Code du prof de ${escapeHtml(entry.child.displayName)}" required />
              <button type="submit" class="save-button">${entry.hasTutorPin ? "Changer le code" : "Definir le code"}</button>
            </form>
          </div>
          ${renderSubjects(entry)}
          ${actuBlockFor(actuByChild.get(entry.child.slug), entry.child.displayName)}
          <div style="margin-bottom:14px">
            <div class="section-label">Prieres suivies</div>
            <div class="chip-row">
              ${prayersFor(entry.child)
                .map((prayer) => `<span class="chip">${escapeHtml(prayer.label)}</span>`)
                .join("")}
            </div>
          </div>
        </section>
      `
    )
    .join("");

  const error = options.subjectError
    ? `<div class="notice notice-error">${escapeHtml(SUBJECT_ERRORS[options.subjectError] ?? "Action impossible.")}</div>`
    : "";

  return `
    ${error}
    ${renderParentPreferencesForm(prefs)}
    ${cards}
    <section class="card">
      <div class="card-title">Installer l'application</div>
      <p class="empty">Sur ordinateur (Chrome ou Edge) : icone d'installation dans la barre d'adresse. Sur Android : menu du navigateur, "Installer l'application". Sur iPhone ou iPad : bouton Partager, puis "Sur l'ecran d'accueil". Une fois installee, elle reste connectee sans avoir a recoller le lien avec le token.</p>
    </section>
    <section class="card">
      <div class="card-title">Modifier la liste des enfants</div>
      <p class="empty">Les enfants, leurs couleurs et leur classe se modifient dans le code (src/children.ts), pas depuis cette page.</p>
    </section>
  `;
}

/**
 * Page 403. Volontairement autonome (pas la coquille avec le menu) : personne
 * n'est authentifie ici, afficher une navigation vers des sections inaccessibles
 * n'aurait pas de sens.
 */
export function renderForbidden(tokenConfigured: boolean): string {
  const message = tokenConfigured
    ? "Ouvre l'espace parent avec le lien complet contenant le token. Si tu viens de le faire et que tu vois quand meme cette page, c'est que le navigateur a refuse le cookie de session : autorise les cookies pour ce site."
    : "L'espace parent est ferme tant que le secret PARENT_ACCESS_TOKEN n'est pas defini sur le Worker.";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Acces refuse</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #F7F8FA; color: #101828; margin: 0; display: grid; place-items: center; min-height: 100vh; padding: 24px; }
    .box { background: #fff; border: 1px solid #E4E7EC; border-radius: 12px; padding: 22px 24px; max-width: 460px; }
    h1 { font-size: 1.15rem; margin: 0 0 8px; }
    p { margin: 0; color: #667085; font-size: 0.92rem; line-height: 1.5; }
    @media (prefers-color-scheme: dark) {
      body { background: #0B0F19; color: #F3F4F6; }
      .box { background: #111827; border-color: #1F2937; }
      p { color: #9CA3AF; }
    }
  </style>
</head>
<body>
  <div class="box">
    <h1>Acces refuse</h1>
    <p>${escapeHtml(message)}</p>
  </div>
</body>
</html>`;
}
