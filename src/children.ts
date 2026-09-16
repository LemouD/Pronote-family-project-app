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
  /**
   * true si l'etablissement impose l'authentification via un ENT (CAS/
   * Keycloak) que pawnote ne sait pas gerer. Dans ce cas, le Worker ne parle
   * jamais a Pronote en direct : les devoirs sont importes periodiquement
   * par un script externe (voir bootstrap/sync_homework.py + CONTEXT.md), et
   * le statut "fait" est gere uniquement cote KV (pas de re-ecriture vers
   * Pronote, qui de toute facon n'est pas joignable en direct pour ces
   * enfants). Absent/false = connexion directe habituelle (pawnote).
   */
  externallySynced?: boolean;
  /** Classe affichee sous le prenom dans l'espace parent, ex. "5e". */
  schoolYear: string;
  /**
   * Couleur et avatar de depart, dans les listes de src/preferences.ts.
   * L'enfant peut les changer lui-meme depuis sa page de reglages ; ce qui
   * est defini ici ne sert que tant qu'il n'a rien choisi.
   */
  defaultAccentId: string;
  defaultAvatar: string;
  /**
   * Planche d'avatars proposee a cet enfant, selon ses centres d'interet.
   * C'est du contenu : ajouter ou retirer un emoji ici suffit.
   */
  avatars: string[];
  /**
   * Prieres suivies par cet enfant (identifiants de src/prayers.ts). Absent =
   * toutes. A restreindre quand un enfant est trop jeune pour les suivre toutes.
   */
  prayerIds?: string[];
  /**
   * Segment d'URL de la page du prof de maison, ex. /prof/<tutorSlug>.
   * Distinct du slug de l'enfant : ce lien sort de la famille, il ne doit pas
   * donner acces a la page de l'enfant si quelqu'un tronque l'URL.
   */
  tutorSlug: string;
  /**
   * Matieres suivies avec le prof de maison. Liste courte : c'est ce que le
   * prof choisit dans son formulaire.
   */
  homeworkSubjects: string[];
}

// Le suffixe aleatoire de chaque slug est genere avec :
//   node -e "console.log(require('crypto').randomBytes(9).toString('base64url'))"
// A regenerer avec la meme commande si un slug venait a fuiter.
export const children: ChildConfig[] = [
  {
    slug: "malick-K5p0nA65n8L1",
    displayName: "Malick",
    secretPrefix: "MALICK",
    externallySynced: true,
    schoolYear: "3e",
    defaultAccentId: "turquoise",
    defaultAvatar: "⚽",
    // Foot et manga.
    avatars: ["⚽", "🏆", "👟", "🥅", "🧤", "🥇", "🍥", "🐉", "🗡️", "🥷", "🔥", "🍜"],
    tutorSlug: "malick-9PgS5sSs4qt-",
    homeworkSubjects: ["Mathematiques", "Anglais"]
  },
  {
    slug: "codou-tBCiBx5FYmTB",
    displayName: "Codou",
    secretPrefix: "CODOU",
    externallySynced: true,
    schoolYear: "5e",
    defaultAccentId: "corail",
    defaultAvatar: "🎤",
    // K-pop.
    avatars: ["🎤", "🎧", "💜", "🩷", "🎀", "💃", "🦋", "✨", "🧋", "🐰", "🎶", "⭐"],
    tutorSlug: "codou-qLQcKaT-E5cM",
    homeworkSubjects: ["Francais"]
  }
];

export function findChildBySlug(slug: string): ChildConfig | undefined {
  return children.find((child) => child.slug === slug);
}

export function findChildByTutorSlug(slug: string): ChildConfig | undefined {
  return children.find((child) => child.tutorSlug === slug);
}
