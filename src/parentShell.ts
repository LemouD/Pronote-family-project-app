import { fontFace, FONTS } from "./fonts";
import { escapeHtml } from "./html";
import { type ParentPreferences, themeAttribute } from "./preferences";
import { PARENT_THEME_COLOR, PWA_ASSET_PATHS } from "./pwa";

/**
 * Coquille de l'espace parent : navigation laterale claire, accent indigo,
 * IBM Plex Sans. Reprend la maquette "Devoirs Famille - Parent et Enfant".
 * Volontairement distincte de l'espace enfant (render.ts), qui a sa propre
 * identite chaleureuse - ce sont deux applications, pas deux vues.
 */

export type ParentSectionId = "overview" | "devoirs" | "notes" | "devoir-maison" | "reglages";

interface NavItem {
  id: ParentSectionId;
  href: string;
  label: string;
  icon: string;
  /** Section presente dans la navigation mais pas encore implementee. */
  soon?: boolean;
}

const ICON = `viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"`;

const NAV_ITEMS: NavItem[] = [
  {
    id: "overview",
    href: "/parent",
    label: "Vue d'ensemble",
    icon: `<svg ${ICON}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>`
  },
  {
    id: "devoirs",
    href: "/parent/devoirs",
    label: "Devoirs",
    icon: `<svg ${ICON}><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>`
  },
  {
    id: "notes",
    href: "/parent/notes",
    label: "Notes",
    icon: `<svg ${ICON}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`
  },
  {
    id: "devoir-maison",
    href: "/parent/devoir-maison",
    label: "Devoir maison",
    icon: `<svg ${ICON}><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 00-4 12.7c.6.5 1 1.2 1 2.05V17h6v-.25c0-.85.4-1.55 1-2.05A7 7 0 0012 2z"/></svg>`
  },
  {
    id: "reglages",
    href: "/parent/reglages",
    label: "Reglages",
    icon: `<svg ${ICON}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`
  }
];

const PARENT_LIGHT_TOKENS = `
    --bg: #F7F8FA;
    --surface: #FFFFFF;
    --surface-alt: #F1F2F5;
    --border: #E4E7EC;
    --text: #101828;
    --text-secondary: #667085;
    --accent: #4338CA;
    --accent-soft: #EEF2FF;
    --accent-text: #3730A3;
    --success: #16A34A;
    --success-soft: #DCFCE7;
    --warning: #D97706;
    --warning-soft: #FEF3C7;
    --danger: #DC2626;
    --danger-soft: #FEE2E2;
    --shadow-chip: 0 1px 2px rgba(0,0,0,.08);
`;

const PARENT_DARK_TOKENS = `
    --bg: #0B0F19;
    --surface: #111827;
    --surface-alt: #182034;
    --border: #1F2937;
    --text: #F3F4F6;
    --text-secondary: #9CA3AF;
    --accent: #818CF8;
    --accent-soft: #1E1B4B;
    --accent-text: #E0E7FF;
    --success: #4ADE80;
    --success-soft: #14532D;
    --warning: #FBBF24;
    --warning-soft: #78350F;
    --danger: #F87171;
    --danger-soft: #7F1D1D;
    --shadow-chip: 0 1px 2px rgba(0,0,0,.4);
`;

const PARENT_STYLE = `
  ${fontFace("IBM Plex Sans", FONTS.plexSans, "100 700")}

  :root {
    color-scheme: light dark;
    ${PARENT_LIGHT_TOKENS}
  }
  /* Trois etats : "comme l'appareil" (aucun data-theme), clair force, sombre
     force. Le bloc sombre sert deux fois - la media query pour l'automatique,
     l'attribut pour le choix explicite. */
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) { ${PARENT_DARK_TOKENS} }
    :root:not([data-theme="light"]) .card,
    :root:not([data-theme="light"]) .row { --child-accent: var(--c-dark); --child-soft: var(--s-dark); }
  }
  :root[data-theme="dark"] { ${PARENT_DARK_TOKENS} color-scheme: dark; }
  :root[data-theme="dark"] .card,
  :root[data-theme="dark"] .row { --child-accent: var(--c-dark); --child-soft: var(--s-dark); }
  :root[data-theme="light"] { color-scheme: light; }

  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: 'IBM Plex Sans', system-ui, -apple-system, sans-serif;
    background: var(--bg);
    color: var(--text);
    -webkit-text-size-adjust: 100%;
  }
  a { color: var(--accent); text-decoration: none; }

  .app { display: flex; min-height: 100vh; }

  /* --- Navigation laterale --- */
  .sidebar {
    width: 240px; flex: 0 0 240px;
    background: var(--surface);
    border-right: 1px solid var(--border);
    display: flex; flex-direction: column;
    padding: 20px 16px;
    position: sticky; top: 0; height: 100vh;
  }
  .brand { display: flex; align-items: center; gap: 10px; padding: 4px 8px 24px; }
  .brand-mark {
    width: 32px; height: 32px; flex: 0 0 32px;
    border-radius: 9px; background: var(--accent);
    display: flex; align-items: center; justify-content: center;
  }
  .brand-mark svg { width: 18px; height: 18px; color: #fff; }
  .brand-title { font-weight: 700; font-size: 15px; line-height: 1.1; }
  .brand-sub { font-size: 11px; color: var(--text-secondary); }

  .nav { display: flex; flex-direction: column; gap: 2px; }
  .nav a {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 10px; min-height: 40px;
    border-radius: 8px;
    color: var(--text-secondary);
    font-weight: 500; font-size: 13.5px;
  }
  .nav a svg { width: 17px; height: 17px; flex-shrink: 0; }
  .nav a:hover { background: var(--surface-alt); }
  .nav a.active { background: var(--accent-soft); color: var(--accent-text); font-weight: 600; }
  .nav-count {
    margin-left: auto; background: var(--warning); color: #fff;
    font-size: 10.5px; font-weight: 700; border-radius: 20px; padding: 1px 7px;
  }
  .nav-soon { margin-left: auto; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: var(--text-secondary); }

  .account {
    margin-top: auto; display: flex; align-items: center; gap: 10px;
    padding: 10px 8px; border-top: 1px solid var(--border);
    color: var(--text); text-decoration: none; border-radius: 8px;
  }
  .account:hover { background: var(--surface-alt); }
  .avatar {
    width: 30px; height: 30px; flex: 0 0 30px; border-radius: 50%;
    background: var(--accent-soft); color: var(--accent-text);
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 13px;
  }
  .account-name { font-size: 12.5px; font-weight: 600; }

  /* --- Zone principale --- */
  .main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
  .topbar {
    min-height: 64px;
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
    padding: 10px 28px;
    border-bottom: 1px solid var(--border);
    flex-wrap: wrap;
  }
  .topbar h1 { font-size: 18px; font-weight: 700; margin: 0; }
  .topbar .subtitle { font-size: 12px; color: var(--text-secondary); margin: 0; }
  .content { flex: 1; padding: 24px 28px 48px; display: flex; flex-direction: column; gap: 20px; }

  /* --- Briques communes --- */
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px; }
  .card-title { font-weight: 700; font-size: 13.5px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
  .card-title svg { width: 16px; height: 16px; color: var(--text-secondary); }
  .card-title .count { margin-left: auto; background: var(--warning-soft); color: var(--warning); font-size: 11px; font-weight: 700; border-radius: 20px; padding: 2px 8px; }

  .grid-children { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
  .grid-lower { display: grid; grid-template-columns: 1.1fr 1fr 1fr; gap: 16px; align-items: start; }

  /* Couleur de l'enfant : l'element porte les deux variantes en style inline,
     c'est le CSS qui choisit selon le theme (un style inline l'emporterait
     sur la media query, donc il ne peut pas decider lui-meme). La bascule
     sombre est faite plus haut, avec les jetons de theme. */
  .card, .row { --child-accent: var(--c-light); --child-soft: var(--s-light); }

  .child-head { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
  .child-avatar {
    width: 40px; height: 40px; flex: 0 0 40px; border-radius: 50%;
    background: var(--child-soft); color: var(--child-accent);
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 15px;
  }
  .child-name { font-weight: 700; font-size: 15px; }
  .child-year { font-size: 12px; color: var(--text-secondary); }

  .meter-label { display: flex; justify-content: space-between; font-size: 12.5px; margin-bottom: 6px; }
  .meter-label span:first-child { color: var(--text-secondary); }
  .meter-label span:last-child { font-weight: 600; }
  .meter { height: 7px; border-radius: 20px; background: var(--surface-alt); overflow: hidden; }
  .meter > div { height: 100%; border-radius: 20px; background: var(--child-accent); }

  .alert { display: flex; gap: 10px; padding: 10px; border-radius: 8px; }
  .alert-bar { width: 6px; flex: 0 0 6px; border-radius: 4px; }
  .alert-title { font-size: 12.5px; font-weight: 600; color: var(--text); }
  .alert-detail { font-size: 11.5px; color: var(--text-secondary); margin-top: 2px; }
  .alert-ok { background: var(--success-soft); }
  .alert-ok .alert-bar { background: var(--success); }
  .alert-warn { background: var(--warning-soft); }
  .alert-warn .alert-bar { background: var(--warning); }
  .alert-danger { background: var(--danger-soft); }
  .alert-danger .alert-bar { background: var(--danger); }

  .badge { font-size: 11.5px; font-weight: 700; border-radius: 20px; padding: 4px 10px; white-space: nowrap; }
  .badge-done { background: var(--success-soft); color: var(--success); }
  .badge-todo { background: var(--warning-soft); color: var(--warning); }
  .badge-new { background: var(--accent-soft); color: var(--accent-text); }

  /* --- Tableau des devoirs --- */
  .table-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
  .row { display: grid; grid-template-columns: 120px 150px 1fr 120px 130px; gap: 12px; padding: 14px 20px; align-items: center; font-size: 13px; border-bottom: 1px solid var(--border); }
  .row:last-child { border-bottom: none; }
  .row-head { padding: 12px 20px; font-size: 11.5px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: .04em; }
  .row-child { display: flex; align-items: center; gap: 8px; font-weight: 600; }
  .dot { width: 8px; height: 8px; flex: 0 0 8px; border-radius: 50%; background: var(--child-accent); }
  .row-muted { color: var(--text-secondary); }
  .row-done .row-text { text-decoration: line-through; color: var(--text-secondary); }

  /* --- Filtres segmentes --- */
  .segmented { display: flex; background: var(--surface-alt); border-radius: 8px; padding: 3px; gap: 2px; }
  .segmented a {
    padding: 6px 12px; border-radius: 6px;
    font-size: 12px; font-weight: 600;
    color: var(--text-secondary);
  }
  .segmented a.active { background: var(--surface); color: var(--text); box-shadow: var(--shadow-chip); }
  .filters { display: flex; gap: 8px; flex-wrap: wrap; }

  /* --- Formulaire d'ajout --- */
  .add-task-form { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
  .add-task-form input, .add-task-form select, .add-task-form button {
    font: inherit; font-size: 13px; min-height: 38px;
    padding: 7px 10px; border-radius: 8px;
    border: 1px solid var(--border); background: var(--surface); color: var(--text);
  }
  .add-task-form input[type="text"] { flex: 1 1 180px; min-width: 0; }
  .add-task-form button { background: var(--accent); color: #fff; border-color: transparent; font-weight: 600; cursor: pointer; padding-inline: 16px; }
  .add-task-form button:disabled { opacity: .6; cursor: default; }

  /* --- Graphiques (SVG genere cote serveur, voir charts.ts) --- */
  .chart { width: 100%; height: auto; display: block; overflow: visible; }
  .chart-grid { stroke: var(--border); stroke-width: 1; }
  .chart-label { fill: var(--text-secondary); font-size: 10px; font-family: inherit; }
  .chart-legend { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 10px; }
  .chart-legend-item { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--text-secondary); font-weight: 600; }
  .chart-swatch { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
  .chart-block { margin-bottom: 18px; }
  .chart-block:last-child { margin-bottom: 0; }
  .chart-heading { font-size: 12px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: .03em; margin-bottom: 8px; }

  .grade-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 13px 0; border-bottom: 1px solid var(--border); }
  .grade-row:last-child { border-bottom: none; }
  .grade-subject { font-size: 13px; font-weight: 600; }
  .grade-class { font-size: 11.5px; color: var(--text-secondary); }
  .grade-value { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 600; font-size: 14px; min-width: 62px; text-align: right; }
  .grade-trend { display: flex; align-items: center; }
  .grade-trend svg { width: 13px; height: 13px; }
  .trend-up { color: var(--success); }
  .trend-down { color: var(--danger); }
  .grade-headline { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px; }
  .grade-headline strong { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 22px; }

  /* --- Formulaire de reglages --- */
  .field { margin-bottom: 16px; }
  .field label { display: block; font-size: 12px; font-weight: 600; color: var(--text-secondary); margin-bottom: 6px; }
  .field input[type="text"] {
    font: inherit; font-size: 14px; width: 100%; max-width: 280px;
    min-height: 40px; padding: 8px 12px;
    border: 1px solid var(--border); border-radius: 8px;
    background: var(--surface); color: var(--text);
  }
  .radio-row { display: flex; flex-wrap: wrap; gap: 8px; }
  .radio-row input { position: absolute; opacity: 0; width: 0; height: 0; }
  .radio-row label {
    display: inline-flex; align-items: center;
    min-height: 40px; padding: 8px 16px; margin: 0;
    border: 1px solid var(--border); border-radius: 8px;
    background: var(--surface); color: var(--text);
    font-size: 13px; font-weight: 600; cursor: pointer;
  }
  /* L'etat suit la case cochee, pas une classe rendue par le serveur :
     sinon cliquer une option ne changerait rien avant l'enregistrement. */
  .radio-row label:has(input:checked) { border-color: var(--accent); background: var(--accent-soft); color: var(--accent-text); }
  .radio-row label:has(input:focus-visible) { outline: 2px solid var(--accent); outline-offset: 2px; }
  .save-button {
    font: inherit; font-size: 13px; font-weight: 600;
    min-height: 40px; padding: 8px 20px;
    background: var(--accent); color: #fff;
    border: none; border-radius: 8px; cursor: pointer;
  }

  /* --- Devoir maison --- */
  .dm-card { display: grid; grid-template-columns: 1fr 1.2fr; gap: 24px; }
  .dm-exercise {
    font: inherit; font-size: 13px; line-height: 1.6;
    flex: 1; min-height: 140px; resize: vertical;
    padding: 14px; border-radius: 8px;
    background: var(--surface-alt); border: 1px solid var(--border); color: var(--text);
  }
  .dm-actions { display: flex; gap: 10px; margin-top: 14px; justify-content: flex-end; flex-wrap: wrap; }
  .ghost-button {
    font: inherit; font-size: 12.5px; font-weight: 600;
    min-height: 40px; padding: 9px 16px;
    background: transparent; color: var(--text-secondary);
    border: 1px solid var(--border); border-radius: 8px; cursor: pointer;
  }
  .ghost-button:disabled, .save-button:disabled { opacity: .5; cursor: default; }
  /* Une action destructive se signale avant le clic, pas apres. */
  .ghost-button.danger { color: var(--danger); border-color: var(--danger); }
  .dm-applied {
    background: var(--surface-alt); border: 1px solid var(--border); border-radius: 10px;
    padding: 14px 18px; margin-bottom: 10px;
    display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
  }
  @media (max-width: 900px) { .dm-card { grid-template-columns: 1fr; } }

  .pin-set-form { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .pin-set-form input {
    font: inherit; font-size: 14px; letter-spacing: .2em;
    width: 140px; min-height: 40px; padding: 8px 12px;
    border: 1px solid var(--border); border-radius: 8px;
    background: var(--surface); color: var(--text);
  }

  .chip { background: var(--surface-alt); border: 1px solid var(--border); border-radius: 20px; padding: 5px 12px; font-size: 12px; font-weight: 600; }
  .chip-row { display: flex; gap: 8px; flex-wrap: wrap; }
  .section-label { font-size: 11.5px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: .03em; margin-bottom: 8px; }
  .empty { color: var(--text-secondary); font-size: 12.5px; margin: 0; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 600; }

  @media (max-width: 900px) {
    .app { flex-direction: column; }
    .sidebar {
      width: auto; flex: none; height: auto;
      flex-direction: row; align-items: center; gap: 12px;
      padding: 10px 12px; overflow-x: auto;
      border-right: none; border-bottom: 1px solid var(--border);
      z-index: 10;
    }
    .brand { padding: 0; }
    .brand-text, .account { display: none; }
    .nav { flex-direction: row; gap: 4px; }
    .nav a { white-space: nowrap; }
    .nav-soon { display: none; }
    .topbar, .content { padding-inline: 16px; }
    .grid-lower { grid-template-columns: 1fr; }
    .row { grid-template-columns: 1fr auto; gap: 4px 10px; padding: 14px 16px; }
    .row-head { display: none; }
    .row-subject { grid-column: 1; }
    .row-text { grid-column: 1 / -1; }
    .row-due { grid-column: 1; }
  }
`;

const REGISTER_SERVICE_WORKER = `
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("${PWA_ASSET_PATHS.serviceWorker}").catch(() => {});
  }
`;

function renderNav(active: ParentSectionId, pendingReviews: number): string {
  return NAV_ITEMS.map((item) => {
    const isActive = item.id === active;
    let trailing = "";
    if (item.id === "devoir-maison" && pendingReviews > 0) {
      trailing = `<span class="nav-count">${pendingReviews}</span>`;
    } else if (item.soon) {
      trailing = `<span class="nav-soon">bientot</span>`;
    }
    return `<a href="${item.href}"${isActive ? ' class="active" aria-current="page"' : ""}>${item.icon}<span>${escapeHtml(
      item.label
    )}</span>${trailing}</a>`;
  }).join("");
}

export function renderParentShell(options: {
  active: ParentSectionId;
  title: string;
  subtitle?: string;
  /** Contenu optionnel aligne a droite dans la barre du haut (filtres). */
  toolbar?: string;
  body: string;
  script?: string;
  pendingReviews?: number;
  /** Prenom et theme choisis sur CET appareil (voir src/preferences.ts). */
  prefs: ParentPreferences;
}): string {
  const { prefs } = options;

  return `<!DOCTYPE html>
<html lang="fr"${themeAttribute(prefs.theme)}>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="${PARENT_THEME_COLOR}" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-title" content="Devoirs" />
  <link rel="manifest" href="${PWA_ASSET_PATHS.manifest}" />
  <link rel="preload" as="font" type="font/woff2" href="${FONTS.plexSans}" crossorigin />
  <link rel="icon" type="image/png" sizes="192x192" href="${PWA_ASSET_PATHS.icon192}" />
  <link rel="apple-touch-icon" href="${PWA_ASSET_PATHS.appleTouchIcon}" />
  <title>${escapeHtml(options.title)} - Espace parent</title>
  <style>${PARENT_STYLE}</style>
</head>
<body>
  <div class="app">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        </div>
        <div class="brand-text">
          <div class="brand-title">Devoirs</div>
          <div class="brand-sub">Espace Parent</div>
        </div>
      </div>
      <nav class="nav">${renderNav(options.active, options.pendingReviews ?? 0)}</nav>
      <a class="account" href="/parent/reglages">
        <div class="avatar">${escapeHtml(prefs.name.slice(0, 1).toUpperCase())}</div>
        <div class="account-name">${escapeHtml(prefs.name)}</div>
      </a>
    </aside>
    <main class="main">
      <div class="topbar">
        <div>
          <h1>${escapeHtml(options.title)}</h1>
          ${options.subtitle ? `<p class="subtitle">${escapeHtml(options.subtitle)}</p>` : ""}
        </div>
        ${options.toolbar ?? ""}
      </div>
      <div class="content">${options.body}</div>
    </main>
  </div>
  <script>${REGISTER_SERVICE_WORKER}${options.script ?? ""}</script>
</body>
</html>`;
}
