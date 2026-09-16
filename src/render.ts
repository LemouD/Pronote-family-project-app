import { PIN_LENGTH } from "./pinAuth";
import { type ChildContext, renderCheck, renderChildShell } from "./childShell";
import type { DisplayItem } from "./displayItems";
import type { ExamCatalogue, ExamSessionView, QuotaStatus } from "./examPrep";
import type { AppliedExercise } from "./homeTutoring";
import { dayLabel, escapeHtml } from "./html";
import type { PrayerView } from "./prayers";
import { ACCENTS, avatarsFor, THEME_LABELS, THEMES } from "./preferences";
import {
  KINDS,
  MAX_LEISURE_MINUTES,
  MAX_MINUTES,
  ROUTINE_LABEL,
  type RoutineView,
  STEP_MINUTES
} from "./routine";

const STAR_ICON = `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
const MOON_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>`;

export function renderChildHomework(context: ChildContext, items: DisplayItem[], error?: string): string {
  const toggleUrl = `/enfant/${context.child.slug}/toggle`;

  const body = items.length
    ? items
        .map((item) =>
          renderCheck({
            id: item.id,
            toggleUrl,
            done: item.done,
            body: `
              <span class="item-body">
                <span class="item-meta">
                  <span class="tag">${escapeHtml(item.source === "pronote" ? item.subject : (item.author ?? "Tache"))}</span>
                  <span class="when">${escapeHtml(dayLabel(item.deadline))}</span>
                </span>
                <span class="item-text">${escapeHtml(item.description || "(pas de description)")}</span>
              </span>
            `
          })
        )
        .join("")
    : `<p class="empty">Rien a faire pour aujourd'hui et demain. Bravo !</p>`;

  return renderChildShell({
    context,
    active: "devoirs",
    title: `Salut ${context.child.displayName} !`,
    subtitle: "Voici ce qu'il te reste a faire",
    headIcon: STAR_ICON,
    body,
    error
  });
}

export function renderChildPrayers(context: ChildContext, prayers: PrayerView[]): string {
  const toggleUrl = `/enfant/${context.child.slug}/prieres/toggle`;
  const done = prayers.filter((prayer) => prayer.done).length;

  const summary = `
    <div class="summary">
      <span class="summary-label">Aujourd'hui</span>
      <span class="summary-value">${done} / ${prayers.length}</span>
    </div>
  `;

  const body = prayers
    .map((prayer) =>
      renderCheck({
        id: prayer.id,
        toggleUrl,
        done: prayer.done,
        body: `
          <span class="item-body"><span class="prayer-name">${escapeHtml(prayer.label)}</span></span>
          ${
            prayer.time
              ? `<span class="prayer-time" data-prayer-time="${escapeHtml(prayer.time)}" data-prayer-label="${escapeHtml(
                  prayer.label
                )}">${escapeHtml(prayer.time)}</span>`
              : ""
          }
        `
      })
    )
    .join("");

  return renderChildShell({
    context,
    active: "prieres",
    title: "Mes prieres du jour",
    subtitle: "Coche au fur et a mesure de ta journee",
    headIcon: MOON_ICON,
    beforeList: summary,
    body,
    script: PRAYER_SIGNAL_SCRIPT
  });
}

/**
 * Previent a l'heure d'une priere, avec le meme signal que la fin d'un bloc
 * de "Mon temps". Aucun appel reseau : les horaires du jour sont deja dans la
 * page, la minuterie ne fait que regarder l'heure.
 *
 * Ne marche que page ouverte - c'est assume, une notification application
 * fermee demanderait un Service Worker et l'autorisation du navigateur.
 */
const PRAYER_SIGNAL_SCRIPT = `
  (() => {
    const rows = [...document.querySelectorAll("[data-prayer-time]")];
    if (rows.length === 0) return;

    // L'heure de Paris, pas celle de l'appareil : une tablette mal reglee ou
    // en voyage ne doit pas declencher l'appel au mauvais moment.
    //
    // Les champs sont lus par formatToParts et jamais en decoupant la chaine :
    // selon la locale du navigateur, 18h45 s'ecrit "18:45" ou "18 h 45", et
    // un decoupage sur ":" rendrait NaN la moitie du temps.
    const clock = new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
    const now = () => {
      const parts = {};
      for (const part of clock.formatToParts(new Date())) parts[part.type] = part.value;
      return {
        day: parts.year + "-" + parts.month + "-" + parts.day,
        minutes: Number(parts.hour) % 24 * 60 + Number(parts.minute)
      };
    };

    const loadedOn = now().day;
    // Tout ce qui est deja passe au chargement est considere comme vu : ouvrir
    // la page le soir ne doit pas rejouer les cinq prieres de la journee.
    const pending = rows
      .map((row) => {
        const [hours, mins] = row.dataset.prayerTime.split(":");
        return { at: Number(hours) * 60 + Number(mins), label: row.dataset.prayerLabel };
      })
      .filter((prayer) => prayer.at > now().minutes)
      .sort((a, b) => a.at - b.at);

    const timer = setInterval(() => {
      const current = now();
      // Passe minuit, les horaires affiches sont ceux de la veille : on
      // s'arrete plutot que de sonner sur des donnees perimees.
      if (current.day !== loadedOn) return clearInterval(timer);

      while (pending.length > 0 && pending[0].at <= current.minutes) {
        const prayer = pending.shift();
        window.familySignal?.("C'est l'heure de la priere : " + prayer.label);
      }
      if (pending.length === 0) clearInterval(timer);
    }, 15000);
  })();
`;

const BULB_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 00-4 12.7c.6.5 1 1.2 1 2.05V17h6v-.25c0-.85.4-1.55 1-2.05A7 7 0 0012 2z"/></svg>`;

export function renderChildTutoring(context: ChildContext, exercises: AppliedExercise[]): string {
  const toggleUrl = `/enfant/${context.child.slug}/devoir-maison/toggle`;

  const body = exercises.length
    ? exercises
        .map((exercise) =>
          renderCheck({
            id: exercise.id,
            toggleUrl,
            done: exercise.done,
            body: `
              <span class="item-body">
                <span class="item-meta"><span class="tag">${escapeHtml(exercise.subject)}</span></span>
                <span class="item-text">${escapeHtml(exercise.exercise)}</span>
              </span>
            `
          })
        )
        .join("")
    : `<p class="empty">Aucun exercice en plus pour le moment.</p>`;

  return renderChildShell({
    context,
    active: "devoir-maison",
    title: "Tes exercices en plus",
    subtitle: "Donnes par ton prof, choisis pour toi",
    headIcon: BULB_ICON,
    body
  });
}

const CAP_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`;

/**
 * Preparation d'examen. Trois listes deroulantes, aucun champ libre : c'est
 * ce qui garantit que rien de ce que l'enfant saisit n'atteint le modele.
 *
 * La correction n'est pas dans la page tant qu'elle n'a pas ete demandee :
 * elle reste cote serveur, pour qu'elle ne soit pas lisible dans le code
 * source avant d'avoir cherche.
 */
export function renderChildExamPrep(
  context: ChildContext,
  catalogue: ExamCatalogue,
  sessions: ExamSessionView[],
  quota: QuotaStatus,
  options: { error?: string } = {}
): string {
  const { child } = context;
  const base = `/enfant/${escapeHtml(child.slug)}/brevet`;

  const subjectGroups = catalogue.subjects
    .map(
      (subject) => `
        <optgroup label="${escapeHtml(subject.label)}">
          ${subject.topics
            .map(
              (topic) =>
                `<option value="${escapeHtml(`${subject.id}|${topic}`)}">${escapeHtml(topic)}</option>`
            )
            .join("")}
        </optgroup>
      `
    )
    .join("");

  const formatOptions = catalogue.formats
    .map((format) => `<option value="${escapeHtml(format.id)}">${escapeHtml(format.label)}</option>`)
    .join("");

  const form = `
    <form method="post" action="${base}/generer" class="exam-form">
      <label class="exam-label" for="exam-topic">Ce que tu veux travailler</label>
      <select id="exam-topic" name="topic" required>${subjectGroups}</select>

      <label class="exam-label" for="exam-format">Type d'exercice</label>
      <select id="exam-format" name="formatId" required>${formatOptions}</select>

      <button type="submit"${quota.remaining === 0 ? " disabled" : ""}>
        ${quota.remaining === 0 ? "Quota du jour atteint" : "Generer un exercice"}
      </button>
      <p class="exam-quota">${quota.remaining} exercice(s) restant(s) aujourd'hui</p>
    </form>
  `;

  const list = sessions.length
    ? sessions
        .map(
          (session) => `
            <article class="exam-card ${session.done ? "done" : ""}">
              <div class="item-meta">
                <span class="tag">${escapeHtml(session.subjectLabel)}</span>
                <span class="when">${escapeHtml(session.topic)}</span>
                ${session.done ? `<span class="exam-done">Termine</span>` : ""}
              </div>
              <div class="exam-text">${escapeHtml(session.exercise)}</div>
              ${
                session.correction === null
                  ? `<form method="post" action="${base}/correction" class="exam-actions">
                       <input type="hidden" name="sessionId" value="${escapeHtml(session.id)}" />
                       <button type="submit" class="exam-ghost">Voir la correction</button>
                     </form>`
                  : `<div class="exam-label" style="margin-top:14px">Correction</div>
                     <div class="exam-text exam-correction">${escapeHtml(session.correction)}</div>`
              }
              ${
                // Le bouton Supprimer ne remplace "J'ai termine" qu'une fois
                // l'exercice fini : rien ne permet d'effacer un travail en cours.
                session.done
                  ? `<form method="post" action="${base}/supprimer" class="exam-actions">
                       <input type="hidden" name="sessionId" value="${escapeHtml(session.id)}" />
                       <button type="submit" class="exam-ghost exam-danger">Supprimer</button>
                     </form>`
                  : `<form method="post" action="${base}/valider" class="exam-actions">
                       <input type="hidden" name="sessionId" value="${escapeHtml(session.id)}" />
                       <button type="submit">J'ai termine</button>
                     </form>`
              }
            </article>
          `
        )
        .join("")
    : `<p class="empty">Choisis une notion ci-dessus pour commencer.</p>`;

  return renderChildShell({
    context,
    active: "brevet",
    title: `Preparation ${catalogue.label}`,
    subtitle: "Choisis ce que tu veux reviser, l'exercice est fait pour toi",
    headIcon: CAP_ICON,
    beforeList: `<div class="exam-form-wrap">${form}</div>`,
    body: list,
    error: options.error
  });
}

const LOCK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>`;

/**
 * Ecran de saisie du code. Rendu avec la coquille enfant mais sans onglets ni
 * avatar : rien n'est encore deverrouille, afficher une navigation vers des
 * pages inaccessibles n'aurait pas de sens.
 *
 * inputmode="numeric" fait apparaitre le pave numerique sur une tablette.
 */
export function renderChildLogin(context: ChildContext, options: { error?: string } = {}): string {
  const { child } = context;

  const body = `
    <form method="post" action="/enfant/${escapeHtml(child.slug)}/code" class="pin-form">
      <input
        type="password"
        name="pin"
        inputmode="numeric"
        pattern="[0-9]{${PIN_LENGTH}}"
        maxlength="${PIN_LENGTH}"
        autocomplete="off"
        required
        autofocus
        aria-label="Ton code a ${PIN_LENGTH} chiffres"
        placeholder="${"•".repeat(PIN_LENGTH)}"
      />
      <button type="submit">Entrer</button>
    </form>
  `;

  return renderChildShell({
    context,
    active: null,
    title: `Bonjour ${child.displayName}`,
    subtitle: `Entre ton code a ${PIN_LENGTH} chiffres pour voir tes devoirs.`,
    headIcon: LOCK_ICON,
    body,
    error: options.error
  });
}

/** Aucun code defini : l'enfant ne peut rien faire seul, c'est au parent d'agir. */
export function renderChildPinMissing(context: ChildContext): string {
  return renderChildShell({
    context,
    active: null,
    title: `Bonjour ${context.child.displayName}`,
    subtitle: "Demande a Maman ou Papa de te donner ton code : il se cree dans l'espace parent, dans Reglages.",
    headIcon: LOCK_ICON,
    body: ""
  });
}

const GEAR_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`;

/**
 * Reglages de l'enfant. Il choisit sa couleur, son avatar et son theme, mais
 * pas son prenom : celui-ci vient de la configuration et sert a l'identifier
 * cote parent.
 *
 * Formulaire classique avec envoi et redirection, sans JavaScript : ca marche
 * meme si un script echoue, et ca evite d'inventer un endpoint JSON de plus.
 */
export function renderChildSettings(context: ChildContext): string {
  const { child, prefs } = context;

  const themeChoices = THEMES.map(
    (theme) => `
      <label class="choice">
        <input type="radio" name="theme" value="${escapeHtml(theme)}" ${prefs.theme === theme ? "checked" : ""} />
        <span>${escapeHtml(THEME_LABELS[theme])}</span>
      </label>
    `
  ).join("");

  const accentChoices = ACCENTS.map(
    (preset) => `
      <label class="choice" title="${escapeHtml(preset.label)}">
        <input type="radio" name="accentId" value="${escapeHtml(preset.id)}" ${prefs.accentId === preset.id ? "checked" : ""} />
        <span><span class="swatch" style="background:${preset.light}"></span></span>
        <span class="visually-hidden">${escapeHtml(preset.label)}</span>
      </label>
    `
  ).join("");

  const avatarChoices = avatarsFor(child).map(
    (avatar) => `
      <label class="choice">
        <input type="radio" name="avatar" value="${escapeHtml(avatar)}" ${prefs.avatar === avatar ? "checked" : ""} />
        <span class="choice-emoji">${escapeHtml(avatar)}</span>
      </label>
    `
  ).join("");

  const body = `
    <form method="post" action="/enfant/${escapeHtml(child.slug)}/reglages" id="settings-form">
      <div class="settings-group">
        <div class="settings-label">Mon avatar</div>
        <div class="choices">${avatarChoices}</div>
      </div>
      <div class="settings-group">
        <div class="settings-label">Ma couleur</div>
        <div class="choices">${accentChoices}</div>
      </div>
      <div class="settings-group">
        <div class="settings-label">Affichage</div>
        <div class="choices">${themeChoices}</div>
      </div>
    </form>
  `;

  return renderChildShell({
    context,
    active: "reglages",
    title: "Mes reglages",
    subtitle: `Ton prenom (${child.displayName}) et tes devoirs ne changent pas.`,
    headIcon: GEAR_ICON,
    body,
    footer: `<div class="save-bar"><button type="submit" form="settings-form">Enregistrer</button></div>`,
    error: undefined
  });
}


/* -------------------------------------------------------------------------
   Mon temps
   ---------------------------------------------------------------------- */

const CLOCK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5"/><path d="M9 2h6"/></svg>`;
const UP_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>`;
const DOWN_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>`;
const CROSS_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>`;

function minutesLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest.toString().padStart(2, "0")}`;
}

/**
 * Le decompte tourne dans le navigateur, mais il repart toujours de
 * l'horodatage de debut envoye par le serveur : recharger la page ne remet
 * pas le bloc a zero.
 *
 * Rien n'avance tout seul. Le signal previent, le bouton reste a taper.
 */
export const ROUTINE_SCRIPT = `
  (() => {
    const timer = document.getElementById("timer");
    if (timer) {
      const count = document.getElementById("timer-count");
      const started = Date.parse(timer.dataset.startedAt || "");
      const total = Number(timer.dataset.minutes) * 60000;
      let rang = false;

      const tick = () => {
        if (!Number.isFinite(started)) return;
        const left = Math.round((started + total - Date.now()) / 1000);
        const sign = left < 0 ? "+" : "";
        const abs = Math.abs(left);
        const minutes = Math.floor(abs / 60);
        const seconds = abs % 60;
        count.textContent = sign + minutes + ":" + String(seconds).padStart(2, "0");
        count.classList.toggle("over", left < 0);

        if (left <= 0 && !rang) {
          rang = true;
          document.getElementById("timer-note")?.removeAttribute("hidden");
          window.familySignal?.("Temps ecoule ! Tape sur Continuer.");
        }
      };

      tick();
      setInterval(tick, 1000);
    }

    // Plafond de loisir : au lieu de laisser depasser puis de refuser, on
    // retire du choix les durees qui ne tiennent pas. Le serveur revalide.
    const form = document.getElementById("add-block");
    if (form) {
      const select = form.querySelector("select");
      const left = Number(form.dataset.leisureLeft);

      const refresh = () => {
        const loisir = form.querySelector('input[name="kind"][value="loisir"]')?.checked;
        let fallback = null;
        for (const option of select.options) {
          const tooLong = loisir && Number(option.value) > left;
          option.disabled = tooLong;
          if (!tooLong) fallback = option.value;
        }
        if (select.selectedOptions[0]?.disabled) select.value = fallback ?? "";
      };

      form.addEventListener("change", refresh);
      refresh();
    }
  })();
`;

function renderBlockRow(
  block: RoutineView["blocks"][number],
  options: { base: string; editable: boolean; first: boolean; last: boolean }
): string {
  const tools = options.editable
    ? `
      <div class="block-tools">
        <form method="post" action="${options.base}/deplacer" style="display:contents">
          <input type="hidden" name="blockId" value="${escapeHtml(block.id)}" />
          <button type="submit" name="direction" value="up" aria-label="Monter"${options.first ? " disabled" : ""}>${UP_ICON}</button>
          <button type="submit" name="direction" value="down" aria-label="Descendre"${options.last ? " disabled" : ""}>${DOWN_ICON}</button>
        </form>
        <form method="post" action="${options.base}/retirer" style="display:contents">
          <input type="hidden" name="blockId" value="${escapeHtml(block.id)}" />
          <button type="submit" aria-label="Retirer">${CROSS_ICON}</button>
        </form>
      </div>
    `
    : "";

  return `
    <div class="block ${block.status}" style="--kind: var(--kind-${block.kind})">
      <div class="block-body">
        <div class="block-kind">${escapeHtml(block.kindLabel)}</div>
        <div class="block-label">${escapeHtml(block.label)}</div>
      </div>
      <div class="block-time">${escapeHtml(minutesLabel(block.minutes))}</div>
      ${tools}
    </div>
  `;
}

function renderAddBlock(view: RoutineView, base: string): string {
  const durations = [];
  for (let minutes = STEP_MINUTES; minutes <= MAX_MINUTES; minutes += STEP_MINUTES) {
    durations.push(
      `<option value="${minutes}"${minutes === 15 ? " selected" : ""}>${escapeHtml(minutesLabel(minutes))}</option>`
    );
  }

  // Quand il ne reste plus une minute de loisir, le type lui-meme n'est plus
  // proposable : l'enfant voit la limite avant d'ecrire son bloc, pas apres.
  const kinds = KINDS.map((kind) => {
    const blocked = kind.id === "loisir" && view.leisureLeft === 0;
    return `
      <label style="--kind: var(--kind-${kind.id})">
        <input type="radio" name="kind" value="${kind.id}"${kind.id === "revisions" ? " checked" : ""}${
          blocked ? " disabled" : ""
        } />
        ${escapeHtml(kind.label)}
      </label>
    `;
  }).join("");

  return `
    <form class="add-block" id="add-block" method="post" action="${base}/ajouter" data-leisure-left="${view.leisureLeft}">
      <div class="kind-choice">${kinds}</div>
      <input type="text" name="label" placeholder="Ce que tu vas faire" maxlength="40" required />
      <select name="minutes" aria-label="Duree">${durations.join("")}</select>
      <button type="submit">Ajouter ce bloc</button>
    </form>
  `;
}

export function renderChildRoutine(context: ChildContext, view: RoutineView, error?: string): string {
  const base = `/enfant/${context.child.slug}/mon-temps`;
  const current = view.currentIndex === null ? null : view.blocks[view.currentIndex];
  const next = view.currentIndex === null ? null : view.blocks[view.currentIndex + 1];

  const meters = `
    <div class="meters">
      <div>
        <div class="meter-row"><span>Total de ta soiree</span><span class="muted">${escapeHtml(
          minutesLabel(view.totalMinutes)
        )}</span></div>
      </div>
      <div>
        <div class="meter-row">
          <span>Loisir</span>
          <span class="muted">${view.leisureMinutes} / ${MAX_LEISURE_MINUTES} min</span>
        </div>
        <div class="gauge ${view.leisureLeft === 0 ? "full" : ""}"><div style="width:${Math.round(
          (view.leisureMinutes / MAX_LEISURE_MINUTES) * 100
        )}%"></div></div>
      </div>
    </div>
  `;

  const list = view.blocks
    .map((block, index) =>
      renderBlockRow(block, {
        base,
        editable: view.editable,
        first: index === 0,
        last: index === view.blocks.length - 1
      })
    )
    .join("");

  if (view.finished) {
    return renderChildShell({
      context,
      active: "mon-temps",
      title: ROUTINE_LABEL,
      subtitle: "Tu es alle au bout de ton programme",
      headIcon: CLOCK_ICON,
      error,
      body: `
        <div class="routine-end">
          <div class="big">Bravo !</div>
          <p class="empty">Tu as tenu ${escapeHtml(minutesLabel(view.totalMinutes))} de programme.</p>
        </div>
        ${list}
        <form class="routine-actions" method="post" action="${base}/recommencer">
          <button type="submit">Recommencer</button>
        </form>
      `
    });
  }

  if (current) {
    return renderChildShell({
      context,
      active: "mon-temps",
      title: ROUTINE_LABEL,
      subtitle: "C'est parti, garde le rythme",
      headIcon: CLOCK_ICON,
      error,
      script: ROUTINE_SCRIPT,
      body: `
        <div class="timer" id="timer" style="--kind: var(--kind-${current.kind})" data-started-at="${escapeHtml(
          view.startedAt ?? ""
        )}" data-minutes="${current.minutes}">
          <div class="timer-kind">${escapeHtml(current.kindLabel)}</div>
          <div class="timer-label">${escapeHtml(current.label)}</div>
          <div class="timer-count" id="timer-count" role="timer" aria-live="off">${escapeHtml(
            String(current.minutes)
          )}:00</div>
          <div class="timer-note" id="timer-note" hidden>
            <p class="timer-done-note">Temps ecoule !</p>
          </div>
          <div class="timer-next">${
            next ? `Ensuite : ${escapeHtml(next.label)} (${escapeHtml(minutesLabel(next.minutes))})` : "C'est le dernier bloc"
          }</div>
        </div>
        <div class="routine-actions">
          <form method="post" action="${base}/continuer">
            <button type="submit">${next ? "Continuer" : "Terminer"}</button>
          </form>
          <form method="post" action="${base}/recommencer">
            <button type="submit" class="routine-ghost">Tout arreter</button>
          </form>
        </div>
        ${list}
      `
    });
  }

  return renderChildShell({
    context,
    active: "mon-temps",
    title: ROUTINE_LABEL,
    subtitle: "Organise ta soiree comme tu veux",
    headIcon: CLOCK_ICON,
    error,
    script: ROUTINE_SCRIPT,
    beforeList: view.blocks.length > 0 ? meters : undefined,
    body: `
      ${list || `<p class="empty">Ajoute ton premier bloc pour commencer.</p>`}
      ${renderAddBlock(view, base)}
      ${
        view.blocks.length > 0
          ? `<form class="routine-actions" method="post" action="${base}/demarrer">
               <button type="submit">C'est parti !</button>
             </form>`
          : ""
      }
    `
  });
}
