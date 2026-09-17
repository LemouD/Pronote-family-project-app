import baloo2 from "./assets/baloo2.woff2";
import lora from "./assets/lora.woff2";
import nunito from "./assets/nunito.woff2";
import plexSans from "./assets/plex-sans.woff2";

/**
 * Polices servies depuis notre propre domaine plutot que depuis Google Fonts :
 * la CSP reste en 'self', et aucune requete ne part vers un tiers depuis la
 * tablette d'un enfant. Les trois fichiers sont des polices variables, donc
 * un seul fichier couvre toutes les graisses de sa famille.
 */
export const FONTS = {
  /** Espace parent, texte courant. */
  plexSans: "/assets/plex-sans.woff2",
  /** Espace parent, titres. Le serif porte une bonne part de l'identite. */
  lora: "/assets/lora.woff2",
  /** Espace enfant, texte courant. */
  nunito: "/assets/nunito.woff2",
  /** Espace enfant, titres. */
  baloo2: "/assets/baloo2.woff2"
} as const;

const FILES = new Map<string, ArrayBuffer>([
  [FONTS.plexSans, plexSans],
  [FONTS.lora, lora],
  [FONTS.nunito, nunito],
  [FONTS.baloo2, baloo2]
]);

export function serveFont(path: string): Response | null {
  const file = FILES.get(path);
  if (!file) return null;

  return new Response(file, {
    headers: {
      "content-type": "font/woff2",
      // Fichiers immuables : un cache long evite de les retelecharger.
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff"
    }
  });
}

/** Bloc @font-face pour une police variable servie par serveFont. */
export function fontFace(family: string, path: string, weightRange: string): string {
  return `@font-face {
    font-family: '${family}';
    src: url('${path}') format('woff2');
    font-weight: ${weightRange};
    font-style: normal;
    font-display: swap;
  }`;
}
