/**
 * Logo Familyo. Source unique : le favicon, la vignette de la barre laterale
 * et les icones PNG de la PWA descendent toutes des formes ci-dessous.
 *
 * Les PNG ne sont pas generes a l'execution (un Worker n'a pas de moteur de
 * rendu) : ce sont des fichiers de src/assets, redessines a l'identique par
 * tools/make-icons.ps1 a partir des memes coordonnees. Modifier le logo ici
 * demande donc de relancer ce script, puis d'incrementer le numero de cache
 * du service worker dans pwa.ts.
 */

/** Vert du carre du logo : accent de l'espace parent et theme-color de la PWA. */
export const LOGO_GREEN = "#1B5E4F";

/**
 * Les formes, sur un carre de 180. Le fichier fourni par le graphiste reserve
 * douze pixels sous le carre pour laisser deborder la lueur ; dans une icone
 * d'application ce debord n'a nulle part ou aller, donc la lueur est ici
 * rognee par le carre arrondi lui-meme.
 */
const MARK = `
    <ellipse opacity="0.18" cx="90" cy="150" rx="76" ry="42" fill="#2AA399"/>
    <circle cx="62" cy="86" r="33.25" fill="#2E8B6E" stroke="#3DAA88" stroke-width="1.5"/>
    <circle cx="118" cy="86" r="33.25" fill="#2AA399" stroke="#3DBFB5" stroke-width="1.5"/>
    <ellipse opacity="0.55" cx="95" cy="86" rx="9" ry="30" fill="#228F80"/>
    <circle cx="90" cy="121" r="19.75" fill="#2E8B6E" stroke="#FAF9F6" stroke-width="2.5"/>
    <circle cx="120" cy="42" r="8" fill="#F17360"/>
    <circle opacity="0.6" cx="118.5" cy="39.5" r="2.5" fill="#FAF9F6"/>`;

/**
 * Icone complete. L'identifiant du clip est long a dessein : ce SVG est
 * insere tel quel dans la page de l'espace parent, ou les identifiants sont
 * partages avec le reste du document.
 */
export const APP_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" role="img" aria-label="Familyo">
  <defs><clipPath id="familyo-logo-card"><rect width="180" height="180" rx="40"/></clipPath></defs>
  <g clip-path="url(#familyo-logo-card)">
    <rect width="180" height="180" fill="${LOGO_GREEN}"/>${MARK}
  </g>
</svg>`;
