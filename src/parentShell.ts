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
    --surface-alt: #F4F5F7;
    --border: #E8EAEE;
    --text: #1A2B23;
    --text-secondary: #6B7280;
    --accent: #1B5E3F;
    --accent-soft: #E7F3EB;
    --accent-text: #14563A;
    --success: #16A34A;
    --success-soft: #DCFCE7;
    --warning: #D9761F;
    --warning-soft: #FDEEE1;
    --danger: #DC2626;
    --danger-soft: #FDE8E8;
    --shadow-chip: 0 1px 2px rgba(0,0,0,.06);
`;

const PARENT_DARK_TOKENS = `
    --bg: #0C1310;
    --surface: #141D18;
    --surface-alt: #1B2721;
    --border: #23332B;
    --text: #ECF3EE;
    --text-secondary: #9AA8A0;
    --accent: #5FBE8C;
    --accent-soft: #16301F;
    --accent-text: #A7E3C1;
    --success: #4ADE80;
    --success-soft: #14532D;
    --warning: #F2A25C;
    --warning-soft: #4A2C13;
    --danger: #F87171;
    --danger-soft: #4A1D1D;
    --shadow-chip: 0 1px 2px rgba(0,0,0,.4);
`;

const PARENT_STYLE = `
  ${fontFace("IBM Plex Sans", FONTS.plexSans, "100 700")}
  ${fontFace("Lora", FONTS.lora, "400 700")}

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

  /* Les titres passent en serif : c'est ce qui distingue le plus la maquette
     de l'ancienne interface, et ca separe nettement les reperes de lecture du
     texte courant, qui reste en sans. */
  .display { font-family: 'Lora', Georgia, 'Times New Roman', serif; }

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
  .brand { display: block; padding: 4px 8px 26px; }
  .brand-row { display: flex; align-items: center; gap: 9px; }
  .brand-mark {
    width: 30px; height: 30px; flex: 0 0 30px;
    border-radius: 9px; background: var(--accent);
    display: flex; align-items: center; justify-content: center;
  }
  .brand-mark svg { width: 17px; height: 17px; color: #fff; }
  .brand-title {
    font-family: 'Lora', Georgia, serif;
    font-weight: 700; font-size: 19px; line-height: 1.1; color: var(--accent);
  }
  .brand-sub {
    font-size: 10px; color: var(--text-secondary);
    text-transform: uppercase; letter-spacing: .09em; margin-top: 6px;
  }

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
    width: 32px; height: 32px; flex: 0 0 32px; border-radius: 50%;
    background: var(--warning); color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 13px;
  }
  .account-name { font-size: 12.5px; font-weight: 600; }
  .account-sub { font-size: 11px; color: var(--text-secondary); }

  /* --- Zone principale --- */
  .main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
  /* Pas de filet sous le titre : la maquette laisse le titre respirer dans la
     zone de contenu, sans separateur. */
  .topbar {
    display: flex; align-items: flex-end; justify-content: space-between; gap: 16px;
    padding: 30px 36px 0;
    flex-wrap: wrap;
  }
  .topbar h1 {
    font-family: 'Lora', Georgia, serif;
    font-size: 27px; font-weight: 700; margin: 0; letter-spacing: -.01em;
  }
  .topbar .subtitle { font-size: 13px; color: var(--text-secondary); margin: 4px 0 0; }
  .content { flex: 1; padding: 22px 36px 48px; display: flex; flex-direction: column; gap: 18px; }

  /* --- Briques communes --- */
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 22px; }
  .card-title {
    font-family: 'Lora', Georgia, serif;
    font-weight: 700; font-size: 16px; margin-bottom: 16px;
    display: flex; align-items: center; gap: 8px;
  }
  .card-title svg { width: 16px; height: 16px; color: var(--text-secondary); }
  .card-title .count {
    margin-left: auto; background: var(--warning); color: #fff;
    font-size: 11px; font-weight: 700; border-radius: 999px;
    min-width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;
  }

  .grid-children { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 18px; }
  /* Deux colonnes, chacune empilant ses cartes : la maquette met les alertes
     et le devoir maison a gauche, les notes recentes a droite. */
  .grid-lower { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; align-items: start; }
  .grid-col { display: flex; flex-direction: column; gap: 18px; min-width: 0; }
  @media (max-width: 900px) { .grid-lower { grid-template-columns: 1fr; } }

  /* Couleur de l'enfant : l'element porte les deux variantes en style inline,
     c'est le CSS qui choisit selon le theme (un style inline l'emporterait
     sur la media query, donc il ne peut pas decider lui-meme). La bascule
     sombre est faite plus haut, avec les jetons de theme. */
  .card, .row { --child-accent: var(--c-light); --child-soft: var(--s-light); }

  .child-head { display: flex; align-items: center; gap: 12px; margin-bottom: 22px; }
  .child-avatar {
    width: 42px; height: 42px; flex: 0 0 42px; border-radius: 50%;
    background: var(--child-accent); color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 16px;
  }
  .child-name { font-weight: 700; font-size: 15.5px; }
  .child-year { font-size: 12.5px; color: var(--text-secondary); margin-top: 1px; }

  /* Etat de synchro en pastille, dans l'angle de la carte plutot qu'en
     bandeau d'alerte : c'est une information de contexte, pas un incident. */
  .status-pill {
    margin-left: auto; display: inline-flex; align-items: center; gap: 5px;
    font-size: 11.5px; font-weight: 600; border-radius: 999px; padding: 5px 11px;
    white-space: nowrap;
  }
  .status-pill svg { width: 13px; height: 13px; }
  .status-pill.ok { background: var(--success-soft); color: var(--success); }
  .status-pill.warn { background: var(--warning-soft); color: var(--warning); }
  .status-pill.danger { background: var(--danger-soft); color: var(--danger); }

  .meters-row { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  @media (max-width: 520px) { .meters-row { grid-template-columns: 1fr; } }
  .meter-name { font-size: 12.5px; color: var(--text-secondary); margin-bottom: 9px; }
  .meter-line { display: flex; align-items: center; gap: 10px; }
  .meter-count { font-size: 19px; font-weight: 700; line-height: 1; white-space: nowrap; }
  .meter-pct { font-size: 12px; font-weight: 600; color: var(--text-secondary); white-space: nowrap; }
  .meter { flex: 1; height: 6px; border-radius: 20px; background: var(--surface-alt); overflow: hidden; }
  .meter > div { height: 100%; border-radius: 20px; background: var(--accent); }
  .meter.prieres > div { background: var(--warning); }

  /* Fond neutre et filet colore : la couleur dit le niveau sans teinter tout
     le bloc, ce qui evite qu'une page d'alertes ressemble a un sapin. */
  .alert { display: flex; gap: 11px; align-items: center; padding: 12px 14px; border-radius: 10px; background: var(--surface-alt); }
  .alert-bar { width: 3px; flex: 0 0 3px; border-radius: 4px; align-self: stretch; }
  .alert-icon { width: 17px; height: 17px; flex-shrink: 0; }
  .alert-title { font-size: 12.5px; font-weight: 600; color: var(--text); }
  .alert-detail { font-size: 11.5px; color: var(--text-secondary); margin-top: 2px; }
  .alert-ok .alert-bar, .alert-ok .alert-icon { background: transparent; color: var(--success); }
  .alert-ok .alert-bar { background: var(--success); }
  .alert-warn .alert-bar { background: var(--warning); }
  .alert-warn .alert-icon { color: var(--warning); }
  .alert-danger .alert-bar { background: var(--danger); }
  .alert-danger .alert-icon { color: var(--danger); }

  /* Pastille de l'enfant : reprend sa couleur, partout ou une ligne concerne
     l'un plutot que l'autre. */
  .child-chip {
    font-size: 11px; font-weight: 600; border-radius: 999px; padding: 3px 9px;
    background: var(--child-soft); color: var(--child-accent); white-space: nowrap;
  }

  .grade-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 13px 0; border-bottom: 1px solid var(--border); }
  .grade-row:last-child { border-bottom: none; padding-bottom: 0; }
  .grade-row:first-child { padding-top: 0; }
  .grade-subject { font-size: 13.5px; font-weight: 600; overflow-wrap: anywhere; }
  .grade-date { font-size: 11.5px; color: var(--text-secondary); margin-top: 2px; }
  .grade-side { display: flex; align-items: center; gap: 9px; flex-shrink: 0; }
  .grade-pill { font-size: 12.5px; font-weight: 700; border-radius: 8px; padding: 5px 9px; white-space: nowrap; }
  .grade-pill.bon { background: var(--success-soft); color: var(--success); }
  .grade-pill.moyen { background: var(--warning-soft); color: var(--warning); }
  .grade-pill.faible { background: var(--danger-soft); color: var(--danger); }

  .open-link { font-size: 12.5px; font-weight: 600; color: var(--accent); white-space: nowrap; }

  .badge { font-size: 11.5px; font-weight: 700; border-radius: 20px; padding: 4px 10px; white-space: nowrap; }
  .badge-done { background: var(--success-soft); color: var(--success); }
  .badge-todo { background: var(--warning-soft); color: var(--warning); }
  .badge-new { background: var(--accent-soft); color: var(--accent-text); }

  /* --- Tableau des devoirs --- */
  /* Une ligne par devoir, en carte plutot qu'en tableau : a cette densite le
     tableau imposait des colonnes fixes qui coupaient les enonces longs. */
  .hw-day { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--text-secondary); margin: 10px 0 2px; }
  .hw-day:first-child { margin-top: 0; }
  .hw-row {
    display: flex; align-items: center; gap: 14px;
    background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
    padding: 14px 18px;
  }
  .hw-row.done { background: var(--surface-alt); border-color: transparent; }
  .hw-check {
    width: 20px; height: 20px; flex: 0 0 20px; border-radius: 50%;
    border: 2px solid var(--border);
    display: flex; align-items: center; justify-content: center;
  }
  .hw-check svg { width: 12px; height: 12px; color: #fff; visibility: hidden; }
  .hw-row.done .hw-check { background: var(--success); border-color: var(--success); }
  .hw-row.done .hw-check svg { visibility: visible; }
  .hw-subject {
    font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em;
    color: var(--child-accent); white-space: nowrap;
  }
  .hw-text { flex: 1; min-width: 0; font-size: 13.5px; overflow-wrap: anywhere; }
  .hw-row.done .hw-text, .hw-row.done .hw-subject { text-decoration: line-through; opacity: .55; }
  .hw-side { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

  /* --- Filtres en pastilles --- */
  .segmented { display: flex; gap: 8px; flex-wrap: wrap; }
  .segmented a {
    padding: 8px 17px; border-radius: 999px;
    font-size: 13px; font-weight: 600;
    background: var(--surface); border: 1px solid var(--border);
    color: var(--text-secondary);
  }
  .segmented a:hover { border-color: var(--accent); color: var(--accent); }
  .segmented a.active { background: var(--accent); border-color: var(--accent); color: #fff; }
  .filters { display: flex; gap: 14px; flex-wrap: wrap; }

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
    font: inherit; font-size: 13.5px; font-weight: 600;
    min-height: 44px; padding: 11px 22px;
    background: var(--accent); color: #fff;
    border: none; border-radius: 9px; cursor: pointer;
  }
  .save-button:hover { filter: brightness(1.12); }

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
  /* --- Configuration de la section Actu --- */
  .actu-form { display: flex; flex-direction: column; gap: 14px; align-items: stretch; }
  /* Dans une colonne flex, un bouton s'etire sur toute la largeur. La
     maquette le veut compact, cale a gauche. */
  .actu-form > .save-button { align-self: flex-start; }
  .actu-options { display: flex; flex-direction: column; gap: 8px; }
  .actu-option {
    display: flex; gap: 10px; align-items: flex-start; cursor: pointer;
    padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px;
    background: var(--surface-alt);
  }
  .actu-option input { margin-top: 3px; flex-shrink: 0; }
  .actu-option span { display: flex; flex-direction: column; gap: 2px; font-size: 13px; }
  .actu-option .muted { font-size: 12px; line-height: 1.45; }
  .actu-option.missing { opacity: .75; }
  .actu-missing { font-size: 11.5px; font-weight: 700; color: var(--danger); }
  .actu-field { display: flex; flex-direction: column; gap: 6px; }
  /* Puce de matiere : le libelle et sa croix forment un seul bloc, pour que
     la cible tactile de suppression soit evidente sans etre piegeuse. */
  .subject-chip {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 5px 6px 5px 12px; border-radius: 999px;
    background: var(--surface-alt); border: 1px solid var(--border);
    font-size: 12.5px; font-weight: 600;
  }
  .subject-chip button {
    font: inherit; font-size: 15px; line-height: 1;
    width: 22px; height: 22px; padding: 0;
    display: flex; align-items: center; justify-content: center;
    background: transparent; color: var(--text-secondary);
    border: none; border-radius: 999px; cursor: pointer;
  }
  .subject-chip button:hover { background: var(--danger-soft); color: var(--danger); }
  .genre-grid { display: flex; flex-wrap: wrap; gap: 6px; }
  .genre-chip {
    display: flex; align-items: center; gap: 6px; cursor: pointer;
    font-size: 12.5px; font-weight: 600;
    padding: 6px 10px; border-radius: 999px;
    border: 1px solid var(--border); background: var(--surface);
  }
  /* L'etat coche se lit sans avoir a viser la case elle-meme. */
  .genre-chip:has(input:checked) { border-color: var(--accent); color: var(--accent); }
  .actu-field select {
    font: inherit; font-size: 14px;
    min-height: 44px; padding: 11px 14px;
    border: 1px solid transparent; border-radius: 9px;
    background: var(--surface-alt); color: var(--text);
  }
  .dm-applied {
    background: var(--surface-alt); border: 1px solid var(--border); border-radius: 10px;
    padding: 14px 18px; margin-bottom: 10px;
    display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
  }
  @media (max-width: 900px) { .dm-card { grid-template-columns: 1fr; } }

  .pin-set-form { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
  .pin-set-form input {
    font: inherit; font-size: 14px;
    flex: 1 1 200px; min-width: 0; min-height: 44px; padding: 11px 14px;
    border: 1px solid transparent; border-radius: 9px;
    background: var(--surface-alt); color: var(--text);
  }
  .pin-set-form input[name="pin"] { letter-spacing: .2em; flex: 0 0 150px; }
  .pin-set-form input:focus, .actu-field select:focus, .actu-field input:focus {
    outline: none; border-color: var(--accent); background: var(--surface);
  }

  .chip { background: var(--surface-alt); border: 1px solid transparent; border-radius: 999px; padding: 6px 13px; font-size: 12.5px; font-weight: 600; }
  .chip.on { background: var(--accent-soft); color: var(--accent-text); }
  .chip-row { display: flex; gap: 8px; flex-wrap: wrap; }
  .section-label { font-size: 12.5px; font-weight: 500; color: var(--text-secondary); margin-bottom: 7px; }
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
  <meta name="apple-mobile-web-app-title" content="Familyo" />
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
        <div class="brand-row">
          <div class="brand-mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>
          </div>
          <div class="brand-title">Familyo</div>
        </div>
        <div class="brand-sub">Espace Parent</div>
      </div>
      <nav class="nav">${renderNav(options.active, options.pendingReviews ?? 0)}</nav>
      <a class="account" href="/parent/reglages">
        <div class="avatar">${escapeHtml(prefs.name.slice(0, 1).toUpperCase())}</div>
        <div>
          <div class="account-name">${escapeHtml(prefs.name)}</div>
          <div class="account-sub">Compte principal</div>
        </div>
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
