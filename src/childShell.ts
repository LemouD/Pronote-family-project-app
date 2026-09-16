import type { ChildConfig } from "./children";
import { fontFace, FONTS } from "./fonts";
import { escapeHtml } from "./html";
import { accentVars, type AccentPreset, type ChildPreferences, themeAttribute } from "./preferences";
import { ROUTINE_LABEL } from "./routine";
import { SIGNAL_BANNER, SIGNAL_SCRIPT, SIGNAL_STYLE } from "./signal";

/**
 * Coquille de l'espace enfant : fond creme, coins ronds, gros reperes
 * tactiles, une couleur par enfant. Rien a piloter ici, juste des choses a
 * cocher - l'oppose de l'espace parent (parentShell.ts).
 */

export type ChildSectionId = "devoirs" | "devoir-maison" | "prieres" | "mon-temps" | "brevet" | "reglages";

const ICON = `viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"`;

/**
 * Entrees du menu. "restricted" marque celles reservees a un enfant : elles
 * n'apparaissent que dans son propre menu.
 */
const MENU: { id: ChildSectionId; label: string; path: string; icon: string; restricted?: boolean }[] = [
  {
    id: "devoirs",
    label: "Aujourd'hui",
    path: "",
    icon: `<svg ${ICON}><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>`
  },
  {
    id: "devoir-maison",
    label: "Devoir maison",
    path: "/devoir-maison",
    icon: `<svg ${ICON}><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 00-4 12.7c.6.5 1 1.2 1 2.05V17h6v-.25c0-.85.4-1.55 1-2.05A7 7 0 0012 2z"/></svg>`
  },
  {
    id: "prieres",
    label: "Prieres",
    path: "/prieres",
    icon: `<svg ${ICON}><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>`
  },
  {
    id: "mon-temps",
    label: ROUTINE_LABEL,
    path: "/mon-temps",
    icon: `<svg ${ICON}><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5"/><path d="M9 2h6"/></svg>`
  },
  {
    id: "brevet",
    label: "Brevet",
    path: "/brevet",
    icon: `<svg ${ICON}><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`,
    restricted: true
  },
  {
    id: "reglages",
    label: "Mes reglages",
    path: "/reglages",
    icon: `<svg ${ICON}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`
  }
];

const CHILD_LIGHT_TOKENS = `
    --bg: #FFF8EC;
    --surface: #FFFFFF;
    --border: #F0E3D0;
    --text: #3A2E2A;
    --text-secondary: #8A7A6D;
    --accent: var(--accent-light);
    --accent-soft: var(--accent-soft-light);
    --error-bg: #FDE2E1;
    --error-text: #8A1F1F;
    /* Une couleur par type de bloc de "Mon temps". Revisions prend la couleur
       de l'enfant : c'est la partie qui lui appartient vraiment. */
    --kind-revisions: var(--accent);
    --kind-pause: #3F8FA8;
    --kind-loisir: #C9752A;
`;

const CHILD_DARK_TOKENS = `
    --bg: #241C15;
    --surface: #33281F;
    --border: #4A3B2E;
    --text: #FDF3E7;
    --text-secondary: #C9B8A8;
    --accent: var(--accent-dark);
    --accent-soft: var(--accent-soft-dark);
    --error-bg: #4A1E1D;
    --error-text: #FFC9C7;
    --kind-revisions: var(--accent);
    --kind-pause: #7FC4DC;
    --kind-loisir: #F0A868;
`;

const CHILD_STYLE = `
  ${fontFace("Nunito", FONTS.nunito, "400 800")}
  ${fontFace("Baloo 2", FONTS.baloo2, "400 800")}

  /* Trois etats de theme : "comme l'appareil" (aucun data-theme), clair force,
     sombre force. Le bloc sombre apparait deux fois - une fois derriere la
     media query pour le mode automatique, une fois pour le choix explicite. */
  :root {
    color-scheme: light dark;
    ${CHILD_LIGHT_TOKENS}
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) { ${CHILD_DARK_TOKENS} }
  }
  :root[data-theme="dark"] { ${CHILD_DARK_TOKENS} }
  :root[data-theme="light"] { color-scheme: light; }
  :root[data-theme="dark"] { color-scheme: dark; }

  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: 'Nunito', system-ui, -apple-system, sans-serif;
    background: var(--bg);
    color: var(--text);
    -webkit-text-size-adjust: 100%;
  }
  .page {
    max-width: 520px;
    margin-inline: auto;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  h1 { font-family: 'Baloo 2', system-ui, sans-serif; font-weight: 800; font-size: 26px; margin: 0; line-height: 1.15; }
  .head { padding: 28px 24px 18px; }
  .head-row { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
  .head-row svg { width: 26px; height: 26px; color: var(--accent); flex-shrink: 0; }
  .head p { font-size: 15px; color: var(--text-secondary); font-weight: 600; margin: 0; }

  .list { flex: 1; padding: 4px 24px 12px; display: flex; flex-direction: column; gap: 14px; }

  .item {
    display: flex; align-items: center; gap: 14px;
    background: var(--surface);
    border: 2px solid var(--accent);
    border-radius: 20px;
    padding: 16px 18px;
    cursor: pointer;
  }
  .item.done { border-color: var(--border); }
  .item input { position: absolute; opacity: 0; width: 0; height: 0; }
  .check {
    width: 32px; height: 32px; flex: 0 0 32px;
    border-radius: 50%;
    border: 2.5px solid var(--border);
    display: flex; align-items: center; justify-content: center;
  }
  .check svg { width: 20px; height: 20px; color: #fff; display: none; }
  .item.done .check { background: var(--accent); border-color: var(--accent); }
  .item.done .check svg { display: block; }
  .item input:focus-visible + .check { outline: 3px solid var(--accent); outline-offset: 2px; }

  .item-body { flex: 1; min-width: 0; }
  .item-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap; }
  .tag {
    background: var(--accent-soft); color: var(--accent);
    font-size: 11px; font-weight: 800;
    border-radius: 20px; padding: 3px 10px;
    text-transform: uppercase; letter-spacing: .02em;
  }
  .when { font-size: 11.5px; color: var(--text-secondary); font-weight: 700; }
  .item-text { font-size: 15px; font-weight: 700; overflow-wrap: anywhere; }
  .item.done .item-text { text-decoration: line-through; color: var(--text-secondary); }

  .prayer-name { font-size: 16.5px; font-weight: 700; }
  .item.done .prayer-name { color: var(--text-secondary); text-decoration: none; }
  .prayer-time { font-family: 'Baloo 2', system-ui, sans-serif; font-weight: 700; font-size: 16px; color: var(--text-secondary); }

  .summary {
    margin: 0 24px 20px;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 16px; padding: 14px 18px;
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
  }
  .summary-label { font-size: 13.5px; font-weight: 700; color: var(--text-secondary); }
  .summary-value { font-family: 'Baloo 2', system-ui, sans-serif; font-weight: 800; font-size: 18px; color: var(--accent); }

  .empty { color: var(--text-secondary); font-weight: 600; font-size: 15px; text-align: center; padding: 24px 0; }
  .error { background: var(--error-bg); color: var(--error-text); padding: 12px 14px; border-radius: 14px; margin: 0 24px 14px; font-weight: 600; font-size: 14px; }

  /* Avatar-bouton dans l'en-tete : c'est l'entree vers les reglages. Une
     quatrieme case dans la barre d'onglets alourdirait une interface faite
     pour un enfant. */
  .avatar-link {
    margin-left: auto; flex-shrink: 0;
    width: 46px; height: 46px; border-radius: 50%;
    background: var(--accent-soft);
    border: 2px solid var(--accent);
    display: flex; align-items: center; justify-content: center;
    font-size: 24px; line-height: 1; text-decoration: none;
  }

  .settings-group { margin-bottom: 22px; }
  .settings-label { font-size: 13px; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; letter-spacing: .03em; margin-bottom: 10px; }
  .choices { display: flex; flex-wrap: wrap; gap: 10px; }
  .choice input { position: absolute; opacity: 0; width: 0; height: 0; }
  .choice {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    min-height: 48px; min-width: 48px; padding: 10px 16px;
    background: var(--surface); border: 2px solid var(--border); border-radius: 16px;
    font-size: 15px; font-weight: 700; cursor: pointer;
  }
  /* L'etat selectionne suit la case reellement cochee, pas une classe rendue
     par le serveur : sans ca, cliquer un autre choix ne changerait rien tant
     que l'enfant n'a pas enregistre. */
  .choice:has(input:checked) { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }
  .choice input:focus-visible + span { outline: 3px solid var(--accent); outline-offset: 3px; border-radius: 6px; }
  .visually-hidden {
    position: absolute; width: 1px; height: 1px;
    padding: 0; margin: -1px; overflow: hidden;
    clip-path: inset(50%); white-space: nowrap;
  }
  .choice-emoji { font-size: 26px; line-height: 1; }
  .swatch { width: 26px; height: 26px; border-radius: 50%; display: block; }
  .save-bar { padding: 4px 24px 8px; }
  .save-bar button {
    width: 100%; min-height: 52px;
    background: var(--accent); color: #fff;
    border: none; border-radius: 18px;
    font: inherit; font-size: 16px; font-weight: 800; cursor: pointer;
  }
  /* --- Preparation d'examen --- */
  .exam-form-wrap { padding: 0 24px 4px; }
  .exam-form {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 18px; padding: 16px 18px;
  }
  .exam-label { display: block; font-size: 12.5px; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; letter-spacing: .03em; margin-bottom: 7px; }
  .exam-form select {
    font: inherit; font-size: 15px; font-weight: 600; width: 100%;
    min-height: 48px; padding: 10px 12px; margin-bottom: 16px;
    background: var(--bg); color: var(--text);
    border: 2px solid var(--border); border-radius: 14px;
  }
  .exam-form button, .exam-actions button {
    font: inherit; font-size: 16px; font-weight: 800;
    width: 100%; min-height: 52px;
    background: var(--accent); color: #fff;
    border: none; border-radius: 16px; cursor: pointer;
  }
  .exam-form button:disabled { opacity: .5; cursor: default; }
  .exam-quota { font-size: 12.5px; font-weight: 700; color: var(--text-secondary); text-align: center; margin: 10px 0 0; }

  .exam-card {
    background: var(--surface); border: 2px solid var(--accent);
    border-radius: 20px; padding: 16px 18px;
  }
  .exam-card.done { border-color: var(--border); }
  .exam-text { font-size: 15px; font-weight: 600; line-height: 1.55; white-space: pre-wrap; overflow-wrap: anywhere; margin-top: 10px; }
  .exam-correction { background: var(--accent-soft); border-radius: 14px; padding: 14px; font-weight: 600; }
  .exam-actions { margin-top: 14px; }
  .exam-ghost {
    background: transparent !important; color: var(--accent) !important;
    border: 2px solid var(--accent) !important;
  }
  /* Une action destructive se signale avant le clic, pas apres. */
  .exam-danger { color: var(--error-text) !important; border-color: var(--error-text) !important; }
  .exam-done { font-size: 11px; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; letter-spacing: .02em; }

  .pin-form { display: flex; flex-direction: column; gap: 14px; align-items: center; padding-top: 12px; }
  .pin-form input {
    font: inherit; font-family: 'Baloo 2', system-ui, sans-serif;
    font-size: 34px; font-weight: 800; letter-spacing: .35em; text-align: center;
    width: 100%; max-width: 260px; min-height: 68px;
    padding: 10px 14px 10px 24px;
    background: var(--surface); color: var(--text);
    border: 2px solid var(--border); border-radius: 20px;
  }
  .pin-form input:focus { outline: none; border-color: var(--accent); }
  .pin-form button {
    width: 100%; max-width: 260px; min-height: 56px;
    background: var(--accent); color: #fff;
    border: none; border-radius: 18px;
    font: inherit; font-size: 17px; font-weight: 800; cursor: pointer;
  }

  /* Menu en tiroir. Bati sur <details> : il s'ouvre et se ferme sans une
     ligne de JavaScript, donc rien a ajouter a la CSP, et il fonctionne meme
     si un script echoue. Une barre d'onglets ne tenait plus a sept entrees. */
  .menu {
    position: sticky; top: 0; z-index: 20;
    background: var(--bg);
    border-bottom: 2px solid var(--border);
  }
  .menu-button {
    list-style: none; cursor: pointer;
    display: flex; align-items: center; gap: 12px;
    padding: 16px 24px;
    font-family: 'Baloo 2', system-ui, sans-serif;
    font-weight: 800; font-size: 17px;
  }
  .menu-button::-webkit-details-marker { display: none; }
  .menu-button svg { width: 24px; height: 24px; color: var(--accent); flex-shrink: 0; }
  .menu-button .chevron { margin-left: auto; width: 18px; height: 18px; color: var(--text-secondary); }
  .menu[open] .chevron { transform: rotate(180deg); }
  .menu-panel { display: flex; flex-direction: column; gap: 4px; padding: 0 16px 14px; }
  .menu-panel a {
    display: flex; align-items: center; gap: 14px;
    min-height: 52px; padding: 10px 16px;
    border-radius: 16px; text-decoration: none;
    color: var(--text); font-size: 16px; font-weight: 700;
  }
  .menu-panel a svg { width: 22px; height: 22px; flex-shrink: 0; color: var(--text-secondary); }
  .menu-panel a.active { background: var(--accent-soft); color: var(--accent); }
  .menu-panel a.active svg { color: var(--accent); }

  /* --- Mon temps --- */

  .meters { display: flex; flex-direction: column; gap: 12px; margin: 0 24px 6px; }
  .meter-row { display: flex; justify-content: space-between; align-items: baseline; font-size: 13.5px; font-weight: 800; }
  .meter-row .muted { color: var(--text-secondary); font-weight: 700; }
  .gauge { height: 10px; border-radius: 999px; background: var(--border); overflow: hidden; margin-top: 6px; }
  .gauge div { height: 100%; background: var(--kind-loisir); border-radius: 999px; }
  .gauge.full div { background: var(--error-text); }

  .block {
    display: flex; align-items: center; gap: 12px;
    background: var(--surface); border: 2px solid var(--border);
    border-left: 6px solid var(--kind); border-radius: 18px;
    padding: 12px 14px;
  }
  .block-body { flex: 1; min-width: 0; }
  .block-kind { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; color: var(--kind); }
  .block-label { font-size: 16px; font-weight: 800; overflow-wrap: anywhere; }
  .block-time { font-size: 15px; font-weight: 800; color: var(--text-secondary); white-space: nowrap; }
  .block.done { opacity: .55; }
  .block.current { border-color: var(--kind); }
  .block-tools { display: flex; gap: 6px; }
  .block-tools button {
    font: inherit; width: 36px; height: 36px; padding: 0;
    display: flex; align-items: center; justify-content: center;
    background: transparent; color: var(--text-secondary);
    border: 2px solid var(--border); border-radius: 12px; cursor: pointer;
  }
  .block-tools button svg { width: 16px; height: 16px; }
  .block-tools button:disabled { opacity: .35; cursor: default; }

  .add-block { background: var(--surface); border: 2px solid var(--border); border-radius: 20px; padding: 16px; }
  .kind-choice { display: flex; gap: 8px; margin-bottom: 12px; }
  .kind-choice label {
    flex: 1; position: relative; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    min-height: 46px; padding: 8px 4px;
    border: 2px solid var(--border); border-radius: 14px;
    font-size: 14px; font-weight: 800; color: var(--text-secondary);
    text-align: center;
  }
  .kind-choice input { position: absolute; opacity: 0; pointer-events: none; }
  /* Selection sans JavaScript : la bordure suit la case reellement cochee. */
  .kind-choice label:has(input:checked) { border-color: var(--kind); color: var(--kind); background: var(--surface); }
  .kind-choice label:has(input:disabled) { opacity: .4; cursor: default; }
  .add-block input[type="text"], .add-block select {
    font: inherit; font-size: 16px; font-weight: 700;
    width: 100%; min-height: 48px; padding: 10px 12px; margin-bottom: 10px;
    background: var(--bg); color: var(--text);
    border: 2px solid var(--border); border-radius: 14px;
  }
  .add-block button, .routine-actions button {
    font: inherit; font-size: 16px; font-weight: 800;
    width: 100%; min-height: 52px;
    background: var(--accent); color: #fff;
    border: none; border-radius: 16px; cursor: pointer;
  }
  .add-block button:disabled { opacity: .5; cursor: default; }
  .routine-actions { display: flex; flex-direction: column; gap: 10px; }
  .routine-ghost {
    background: transparent !important; color: var(--text-secondary) !important;
    border: 2px solid var(--border) !important;
  }

  .timer {
    background: var(--surface); border: 3px solid var(--kind);
    border-radius: 26px; padding: 24px; text-align: center;
  }
  .timer-kind { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: var(--kind); }
  .timer-label { font-family: 'Baloo 2', system-ui, sans-serif; font-size: 24px; font-weight: 800; margin: 4px 0 10px; overflow-wrap: anywhere; }
  .timer-count { font-family: 'Baloo 2', system-ui, sans-serif; font-size: 62px; font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; color: var(--kind); }
  .timer-count.over { color: var(--error-text); }
  .timer-next { font-size: 14px; font-weight: 700; color: var(--text-secondary); margin-top: 14px; }
  .timer-done-note { font-size: 15px; font-weight: 800; color: var(--kind-loisir); margin-top: 14px; }

  .routine-end { text-align: center; padding: 10px 0 4px; }
  .routine-end .big { font-family: 'Baloo 2', system-ui, sans-serif; font-size: 30px; font-weight: 800; margin-bottom: 6px; }

${SIGNAL_STYLE}
`;

/**
 * Un seul gestionnaire pour les deux onglets : la case porte l'URL a appeler
 * et l'identifiant de ce qu'elle coche. En cas d'echec reseau la case revient
 * a son etat precedent, pour ne pas faire croire a l'enfant que c'est
 * enregistre.
 */
export const TOGGLE_SCRIPT = `
  document.addEventListener("change", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.type !== "checkbox") return;
    const url = target.dataset.toggleUrl;
    const id = target.dataset.id;
    if (!url || !id) return;

    const item = target.closest(".item");
    target.disabled = true;
    item?.classList.toggle("done", target.checked);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, done: target.checked })
      });
      if (!response.ok) throw new Error("request failed");
    } catch (error) {
      target.checked = !target.checked;
      item?.classList.toggle("done", target.checked);
      alert("Impossible d'enregistrer, reessaie.");
    } finally {
      target.disabled = false;
    }
  });
`;

/** Case a cocher ronde, partagee par les devoirs et les prieres. */
export function renderCheck(options: { id: string; toggleUrl: string; done: boolean; body: string }): string {
  return `
    <label class="item ${options.done ? "done" : ""}">
      <input type="checkbox" ${options.done ? "checked" : ""} data-id="${escapeHtml(options.id)}" data-toggle-url="${escapeHtml(options.toggleUrl)}" />
      <span class="check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg></span>
      ${options.body}
    </label>
  `;
}

const BURGER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`;
const CHEVRON = `<svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>`;

function visibleMenu(child: ChildConfig) {
  // Une entree reservee n'apparait que chez l'enfant concerne : Codou ne doit
  // pas voir le brevet, ni meme savoir qu'il existe.
  return MENU.filter((entry) => !entry.restricted || child.examPrep);
}

function renderMenu(child: ChildConfig, active: ChildSectionId | null): string {
  const current = visibleMenu(child).find((entry) => entry.id === active);

  const links = visibleMenu(child)
    .map((entry) => {
      const isActive = entry.id === active;
      return `<a href="/enfant/${escapeHtml(child.slug)}${entry.path}"${isActive ? ' class="active" aria-current="page"' : ""}>${entry.icon}<span>${escapeHtml(entry.label)}</span></a>`;
    })
    .join("");

  return `
    <details class="menu">
      <summary class="menu-button">${BURGER}<span>${escapeHtml(current?.label ?? "Menu")}</span>${CHEVRON}</summary>
      <nav class="menu-panel">${links}</nav>
    </details>
  `;
}

export interface ChildContext {
  child: ChildConfig;
  prefs: ChildPreferences;
  accent: AccentPreset;
}

export function renderChildShell(options: {
  context: ChildContext;
  active: ChildSectionId | null;
  title: string;
  subtitle: string;
  headIcon: string;
  /** Insere entre l'en-tete et la liste (carte de resume des prieres). */
  beforeList?: string;
  body: string;
  error?: string;
  /** Remplace la barre d'onglets (bouton d'enregistrement des reglages). */
  footer?: string;
  /** Script propre a la page, joue apres celui du signal. */
  script?: string;
}): string {
  const { child, prefs, accent } = options.context;

  return `<!DOCTYPE html>
<html lang="fr"${themeAttribute(prefs.theme)} style="${accentVars(accent)}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="${accent.light}" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="preload" as="font" type="font/woff2" href="${FONTS.nunito}" crossorigin />
  <title>${escapeHtml(options.title)}</title>
  <style>${CHILD_STYLE}</style>
</head>
<body>
  <div class="page">
    ${options.active === null ? "" : renderMenu(child, options.active)}
    <div class="head">
      <div class="head-row">
        ${options.headIcon}
        <h1>${escapeHtml(options.title)}</h1>
        ${
          options.active === null || options.active === "reglages"
            ? ""
            : `<a class="avatar-link" href="/enfant/${escapeHtml(child.slug)}/reglages" aria-label="Mes reglages">${escapeHtml(prefs.avatar)}</a>`
        }
      </div>
      <p>${escapeHtml(options.subtitle)}</p>
    </div>
    ${options.error ? `<div class="error">${escapeHtml(options.error)}</div>` : ""}
    ${options.beforeList ?? ""}
    <div class="list">${options.body}</div>
    ${options.footer ?? ""}
  </div>
  ${SIGNAL_BANNER}
  <script>${TOGGLE_SCRIPT}</script>
  <script>${SIGNAL_SCRIPT}</script>
  ${options.script ? `<script>${options.script}</script>` : ""}
</body>
</html>`;
}
