import type { ChildConfig } from "./children";
import { fontFace, FONTS } from "./fonts";
import { escapeHtml, safeColor } from "./html";

/**
 * Coquille de l'espace enfant : fond creme, coins ronds, gros reperes
 * tactiles, une couleur par enfant. Rien a piloter ici, juste des choses a
 * cocher - l'oppose de l'espace parent (parentShell.ts).
 */

export type ChildSectionId = "devoirs" | "prieres";

const ICON = `viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"`;

const TABS: { id: ChildSectionId; label: string; path: string; icon: string }[] = [
  {
    id: "devoirs",
    label: "Aujourd'hui",
    path: "",
    icon: `<svg ${ICON}><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>`
  },
  {
    id: "prieres",
    label: "Prieres",
    path: "/prieres",
    icon: `<svg ${ICON}><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>`
  }
];

const CHILD_STYLE = `
  ${fontFace("Nunito", FONTS.nunito, "400 800")}
  ${fontFace("Baloo 2", FONTS.baloo2, "400 800")}

  :root {
    color-scheme: light dark;
    --bg: #FFF8EC;
    --surface: #FFFFFF;
    --border: #F0E3D0;
    --text: #3A2E2A;
    --text-secondary: #8A7A6D;
    --accent: var(--accent-light);
    --accent-soft: var(--accent-soft-light);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #241C15;
      --surface: #33281F;
      --border: #4A3B2E;
      --text: #FDF3E7;
      --text-secondary: #C9B8A8;
      --accent: var(--accent-dark);
      --accent-soft: var(--accent-soft-dark);
    }
  }

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
  .error { background: #FDE2E1; color: #8a1f1f; padding: 12px 14px; border-radius: 14px; margin: 0 24px 14px; font-weight: 600; font-size: 14px; }
  @media (prefers-color-scheme: dark) { .error { background: #4A1E1D; color: #FFC9C7; } }

  .tabs {
    position: sticky; bottom: 0;
    display: flex; gap: 8px;
    padding: 12px 20px calc(22px + env(safe-area-inset-bottom));
    background: var(--bg);
  }
  .tabs a {
    flex: 1;
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    padding: 8px; border-radius: 16px;
    text-decoration: none;
    color: var(--text-secondary);
  }
  .tabs a svg { width: 20px; height: 20px; }
  .tabs a span { font-size: 11px; font-weight: 800; }
  .tabs a.active { background: var(--accent-soft); color: var(--accent); }
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

function renderTabs(child: ChildConfig, active: ChildSectionId): string {
  return TABS.map((tab) => {
    const isActive = tab.id === active;
    return `<a href="/enfant/${escapeHtml(child.slug)}${tab.path}"${isActive ? ' class="active" aria-current="page"' : ""}>${tab.icon}<span>${escapeHtml(tab.label)}</span></a>`;
  }).join("");
}

export function renderChildShell(options: {
  child: ChildConfig;
  active: ChildSectionId;
  title: string;
  subtitle: string;
  headIcon: string;
  /** Insere entre l'en-tete et la liste (carte de resume des prieres). */
  beforeList?: string;
  body: string;
  error?: string;
}): string {
  const { child } = options;
  // Les deux variantes de couleur sont exposees ici ; c'est la feuille de
  // styles qui choisit selon le theme (un style inline gagnerait sur la
  // media query et figerait la version claire).
  const colors =
    `--accent-light:${safeColor(child.accent.light)};--accent-dark:${safeColor(child.accent.dark)};` +
    `--accent-soft-light:${safeColor(child.accentSoft.light)};--accent-soft-dark:${safeColor(child.accentSoft.dark)}`;

  return `<!DOCTYPE html>
<html lang="fr" style="${colors}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="${safeColor(child.accent.light)}" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="preload" as="font" type="font/woff2" href="${FONTS.nunito}" crossorigin />
  <title>${escapeHtml(options.title)}</title>
  <style>${CHILD_STYLE}</style>
</head>
<body>
  <div class="page">
    <div class="head">
      <div class="head-row">
        ${options.headIcon}
        <h1>${escapeHtml(options.title)}</h1>
      </div>
      <p>${escapeHtml(options.subtitle)}</p>
    </div>
    ${options.error ? `<div class="error">${escapeHtml(options.error)}</div>` : ""}
    ${options.beforeList ?? ""}
    <div class="list">${options.body}</div>
    <nav class="tabs">${renderTabs(child, options.active)}</nav>
  </div>
  <script>${TOGGLE_SCRIPT}</script>
</body>
</html>`;
}
