import { CHILD_PIN_LENGTH } from "./childAuth";
import { type ChildContext, renderCheck, renderChildShell } from "./childShell";
import type { DisplayItem } from "./displayItems";
import { dayLabel, escapeHtml } from "./html";
import type { PrayerView } from "./prayers";
import { ACCENTS, avatarsFor, THEME_LABELS, THEMES } from "./preferences";

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
          ${prayer.time ? `<span class="prayer-time">${escapeHtml(prayer.time)}</span>` : ""}
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
    body
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
        pattern="[0-9]{${CHILD_PIN_LENGTH}}"
        maxlength="${CHILD_PIN_LENGTH}"
        autocomplete="off"
        required
        autofocus
        aria-label="Ton code a ${CHILD_PIN_LENGTH} chiffres"
        placeholder="${"•".repeat(CHILD_PIN_LENGTH)}"
      />
      <button type="submit">Entrer</button>
    </form>
  `;

  return renderChildShell({
    context,
    active: null,
    title: `Bonjour ${child.displayName}`,
    subtitle: `Entre ton code a ${CHILD_PIN_LENGTH} chiffres pour voir tes devoirs.`,
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
    active: null,
    title: "Mes reglages",
    subtitle: `Ton prenom (${child.displayName}) et tes devoirs ne changent pas.`,
    headIcon: GEAR_ICON,
    body: `<a class="back-link" href="/enfant/${escapeHtml(child.slug)}">Retour</a>${body}`,
    footer: `<div class="save-bar"><button type="submit" form="settings-form">Enregistrer</button></div>`,
    error: undefined
  });
}
