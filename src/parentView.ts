import type { ChildConfig } from "./children";
import type { DisplayItem } from "./displayItems";
import type { Env } from "./env";

export type ParentDisplayItem = DisplayItem & { isNew: boolean };

function seenKey(child: ChildConfig): string {
  return `parent-seen:${child.slug}`;
}

/**
 * Marque isNew=true sur ce qui a ete coche "fait" depuis la derniere visite
 * consommee par le parent. Lecture seule : plusieurs pages de l'espace parent
 * affichent les memes devoirs, seule celle sur laquelle le parent atterrit
 * (la vue d'ensemble) consomme l'etat, via markSeen.
 */
export async function annotateNewlyDone(env: Env, child: ChildConfig, items: DisplayItem[]): Promise<ParentDisplayItem[]> {
  const previouslySeen = (await env.PRONOTE_CACHE.get(seenKey(child), "json")) as Record<string, boolean> | null;

  return items.map((item) => ({
    ...item,
    isNew: item.done && previouslySeen?.[item.id] !== true
  }));
}

/** Enregistre l'etat courant comme "vu" : les badges "nouveau" actuels ne reapparaitront plus. */
export async function markSeen(env: Env, child: ChildConfig, items: DisplayItem[]): Promise<void> {
  const seen: Record<string, boolean> = {};
  for (const item of items) seen[item.id] = item.done;
  await env.PRONOTE_CACHE.put(seenKey(child), JSON.stringify(seen));
}
