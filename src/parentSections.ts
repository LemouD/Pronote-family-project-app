import { renderLineChart } from "./charts";
import type { ChildConfig } from "./children";
import { formatGrade, type Series, type SubjectSummary } from "./grades";
import { dayLabel, escapeHtml, relativeTime } from "./html";
import type { ParentDisplayItem } from "./parentView";
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
    return { level: "danger", title: `Synchro ${name} jamais executee`, detail: "Lancer le bootstrap pour cet enfant." };
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

  const missingPin = data
    .filter((entry) => !entry.hasPin)
    .map((entry) => ({
      level: "danger" as const,
      title: `Aucun code pour ${entry.child.displayName}`,
      detail: "Sa page est bloquee tant que tu ne lui en donnes pas un, dans Reglages."
    }));

  const alerts = [...missingPin, ...data.map((entry) => syncAlert(entry))]
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
        <div class="card-title">Devoir maison a valider</div>
        <p class="empty">Bientot disponible.</p>
      </section>
      <section class="card">
        <div class="card-title">Notes recentes</div>
        <p class="empty">Bientot disponible.</p>
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

export function renderComingSoon(title: string, description: string): string {
  return `
    <div class="card">
      <div class="card-title">${escapeHtml(title)}</div>
      <p class="empty">${escapeHtml(description)}</p>
    </div>
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

export function renderReglages(data: ParentChildData[], prefs: ParentPreferences): string {
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
            <div class="section-label">Prieres suivies</div>
            <div class="chip-row">
              ${prayersFor(entry.child)
                .map((prayer) => `<span class="chip">${escapeHtml(prayer.label)}</span>`)
                .join("")}
            </div>
          </div>
          <div>
            <div class="section-label">Matieres - devoir maison</div>
            <p class="empty">A configurer quand le devoir maison sera en place.</p>
          </div>
        </section>
      `
    )
    .join("");

  return `
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
