/**
 * Liste des enfants suivis par l'appli. Pour ajouter un enfant (le sien ou
 * celui d'une autre famille qui reprend ce projet) :
 *   1. Ajouter une entree ici avec un slug non-devinable et un secretPrefix.
 *   2. Definir les secrets Cloudflare correspondants :
 *        npx wrangler secret put PRONOTE_<secretPrefix>_URL
 *        npx wrangler secret put PRONOTE_<secretPrefix>_USERNAME
 *        npx wrangler secret put PRONOTE_<secretPrefix>_PASSWORD
 */
export interface ChildConfig {
  /** Segment d'URL, ex. /enfant/<slug>. Doit etre long et non-devinable. */
  slug: string;
  /** Nom affiche sur la page (prenom). */
  displayName: string;
  /** Prefixe utilise pour retrouver les secrets PRONOTE_<prefix>_*. */
  secretPrefix: string;
}

// Le suffixe aleatoire de chaque slug est genere avec :
//   node -e "console.log(require('crypto').randomBytes(9).toString('base64url'))"
// A regenerer avec la meme commande si un slug venait a fuiter.
export const children: ChildConfig[] = [
  { slug: "malick-K5p0nA65n8L1", displayName: "Malick", secretPrefix: "MALICK" },
  { slug: "codou-tBCiBx5FYmTB", displayName: "Codou", secretPrefix: "CODOU" }
];

export function findChildBySlug(slug: string): ChildConfig | undefined {
  return children.find((child) => child.slug === slug);
}
