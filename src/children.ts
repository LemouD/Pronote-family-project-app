import config from "../familyo.config.json";
import type { ExamId } from "./examPrep";

/**
 * Liste des enfants suivis par cette installation.
 *
 * Elle ne vit plus dans ce fichier mais dans familyo.config.json, a la racine :
 * installer Familyo chez une autre famille ne demande plus de modifier du
 * TypeScript, seulement d'editer un fichier de donnees - genere par
 * bootstrap/nouvelle-famille.mjs. Voir INSTALLATION.md.
 *
 * Le JSON est embarque au moment du build : il n'y a pas de lecture de fichier
 * a l'execution, et donc rien de plus a deployer.
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
  /**
   * Examen prepare cette annee, si l'enfant est concerne. Ouvre l'onglet
   * "Brevet" et la generation d'exercices (voir src/examPrep.ts).
   */
  examPrep?: ExamId;
}

const TEXT_FIELDS = ["slug", "displayName", "secretPrefix", "schoolYear", "defaultAccentId", "defaultAvatar", "tutorSlug"] as const;

/**
 * Relit le fichier de configuration.
 *
 * Une erreur ici arrete le Worker au demarrage, et c'est voulu : servir des
 * pages avec un roster incomplet ferait apparaitre un enfant sans lien secret,
 * ou deux enfants sur la meme adresse. Mieux vaut un echec franc, nomme, au
 * moment de l'installation - c'est la seule fois ou ce fichier est edite.
 */
function readChildren(entries: unknown): ChildConfig[] {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('familyo.config.json : "enfants" doit etre une liste non vide.');
  }

  const children = entries.map((entry, index) => {
    const raw = entry as Record<string, unknown>;
    const where = `familyo.config.json, enfant ${index + 1}`;

    for (const field of TEXT_FIELDS) {
      if (typeof raw[field] !== "string" || (raw[field] as string).trim().length === 0) {
        throw new Error(`${where} : le champ "${field}" est manquant ou vide.`);
      }
    }
    if (!Array.isArray(raw.avatars) || raw.avatars.length === 0) {
      throw new Error(`${where} : "avatars" doit contenir au moins un emoji.`);
    }
    if (!Array.isArray(raw.homeworkSubjects)) {
      throw new Error(`${where} : "homeworkSubjects" doit etre une liste (eventuellement vide).`);
    }

    return raw as unknown as ChildConfig;
  });

  // Deux enfants sur la meme adresse, c'est l'un qui voit les devoirs de
  // l'autre. Le cas est assez grave pour meriter sa propre verification.
  const slugs = children.flatMap((child) => [child.slug, child.tutorSlug]);
  const duplicate = slugs.find((slug, index) => slugs.indexOf(slug) !== index);
  if (duplicate) {
    throw new Error(`familyo.config.json : le lien "${duplicate}" est utilise deux fois.`);
  }

  return children;
}

export const children: ChildConfig[] = readChildren(config.enfants);

export function findChildBySlug(slug: string): ChildConfig | undefined {
  return children.find((child) => child.slug === slug);
}

export function findChildByTutorSlug(slug: string): ChildConfig | undefined {
  return children.find((child) => child.tutorSlug === slug);
}
