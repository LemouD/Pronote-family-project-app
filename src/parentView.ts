import type { ChildConfig } from "./children";
import type { DisplayItem } from "./displayItems";
import type { Env } from "./env";

export type ParentDisplayItem = DisplayItem & { isNew: boolean };

function seenKey(child: ChildConfig): string {
  return `parent-seen:${child.slug}`;
}

/**
 * Compare les devoirs actuels au dernier etat vu par le parent (stocke en
 * KV) pour marquer isNew=true sur ce qui vient d'etre coche "fait" depuis sa
 * derniere visite de /parent, puis met a jour cet etat pour la prochaine
 * visite. Pas de vraie notification push : juste un indicateur visuel.
 */
export async function annotateNewlyDone(env: Env, child: ChildConfig, items: DisplayItem[]): Promise<ParentDisplayItem[]> {
  const previouslySeen = (await env.PRONOTE_CACHE.get(seenKey(child), "json")) as Record<string, boolean> | null;

  const annotated = items.map((item) => ({
    ...item,
    isNew: item.done && previouslySeen?.[item.id] !== true
  }));

  const nextSeen: Record<string, boolean> = {};
  for (const item of items) nextSeen[item.id] = item.done;
  await env.PRONOTE_CACHE.put(seenKey(child), JSON.stringify(nextSeen));

  return annotated;
}
