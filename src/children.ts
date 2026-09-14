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

export const children: ChildConfig[] = [
  { slug: "enfant1-changeme", displayName: "Enfant 1", secretPrefix: "ENFANT1" },
  { slug: "enfant2-changeme", displayName: "Enfant 2", secretPrefix: "ENFANT2" }
];

export function findChildBySlug(slug: string): ChildConfig | undefined {
  return children.find((child) => child.slug === slug);
}
