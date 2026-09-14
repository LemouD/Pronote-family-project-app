import { children, findChildBySlug } from "./children";
import type { Env } from "./env";
import { annotateNewlyDone } from "./parentView";
import { getHomework, setHomeworkStatus } from "./pronote";
import { renderChildPage, renderParentPage } from "./render";

// Contenu 100% genere cote serveur, pas de ressources externes : une CSP
// stricte (pas de scripts/objets tiers) reste compatible avec le <script>/
// <style> inline utilises dans render.ts.
const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "content-security-policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  // Donnees personnelles d'un enfant : jamais mises en cache (navigateur ou intermediaire),
  // utile notamment sur une tablette partagee.
  "cache-control": "private, no-store"
};

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Devoirs">
  <rect width="64" height="64" rx="14" fill="#2f6fed"/>
  <path d="M16 18h25a7 7 0 0 1 7 7v22H23a7 7 0 0 1-7-7V18Z" fill="#fff"/>
  <path d="M23 18v22a7 7 0 0 1 7 7h18" fill="none" stroke="#2f6fed" stroke-width="4"/>
  <path d="m30 32 5 5 10-11" fill="none" stroke="#f5b942" stroke-linecap="round" stroke-linejoin="round" stroke-width="5"/>
</svg>`;

function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", ...SECURITY_HEADERS }
  });
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...SECURITY_HEADERS }
  });
}

/** Comparaison a temps constant pour eviter une fuite d'info par timing sur le token. */
function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  // Longueur differente : on compare quand meme un buffer de meme taille que bufA
  // pour ne pas court-circuiter immediatement (fuite de longueur), puis on echoue.
  const length = Math.max(bufA.length, bufB.length, 1);
  let diff = bufA.length === bufB.length ? 0 : 1;
  for (let i = 0; i < length; i++) {
    diff |= (bufA[i] ?? 0) ^ (bufB[i] ?? 0);
  }
  return diff === 0;
}

function isParentAuthorized(request: Request, env: Env): boolean {
  // Fail-closed : sans token configure, /parent est un chemin fixe et
  // devinable (contrairement a /enfant/<slug>), donc pas de mode "ouvert".
  if (!env.PARENT_ACCESS_TOKEN) return false;
  const url = new URL(request.url);
  const provided = url.searchParams.get("token") ?? request.headers.get("x-parent-token");
  if (!provided) return false;
  return timingSafeEqual(provided, env.PARENT_ACCESS_TOKEN);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/favicon.svg" && request.method === "GET") {
      return new Response(FAVICON_SVG, {
        headers: { "content-type": "image/svg+xml; charset=utf-8", ...SECURITY_HEADERS }
      });
    }

    if (path === "/" ) {
      return html("<p>Voir /enfant/&lt;slug&gt; ou /parent.</p>");
    }

    const childPageMatch = path.match(/^\/enfant\/([^/]+)$/);
    if (childPageMatch && request.method === "GET") {
      const child = findChildBySlug(childPageMatch[1]);
      if (!child) return html("Page introuvable.", 404);

      try {
        const items = await getHomework(env, child);
        return html(renderChildPage(child, items));
      } catch (error) {
        console.error(`getHomework(${child.slug}) failed:`, error);
        return html(renderChildPage(child, [], "Impossible de recuperer les devoirs pour le moment."), 500);
      }
    }

    const toggleMatch = path.match(/^\/enfant\/([^/]+)\/toggle$/);
    if (toggleMatch && request.method === "POST") {
      const child = findChildBySlug(toggleMatch[1]);
      if (!child) return json({ error: "unknown child" }, 404);

      let body: { id?: string; done?: boolean };
      try {
        body = await request.json();
      } catch {
        return json({ error: "invalid body" }, 400);
      }

      if (typeof body.id !== "string" || body.id.length === 0 || body.id.length > 200 || typeof body.done !== "boolean") {
        return json({ error: "id and done are required" }, 400);
      }

      try {
        await setHomeworkStatus(env, child, body.id, body.done);
        return json({ ok: true });
      } catch (error) {
        console.error(`setHomeworkStatus(${child.slug}, ${body.id}) failed:`, error);
        return json({ error: "Impossible d'enregistrer, reessaie." }, 500);
      }
    }

    if (path === "/parent" && request.method === "GET") {
      if (!isParentAuthorized(request, env)) {
        return html("Acces refuse.", 403);
      }

      const sections = await Promise.all(
        children.map(async (child) => {
          try {
            const items = await getHomework(env, child);
            return { child, items: await annotateNewlyDone(env, child, items) };
          } catch (error) {
            console.error(`getHomework(${child.slug}) failed:`, error);
            return { child, items: [], error: "Impossible de recuperer les devoirs pour le moment." };
          }
        })
      );

      return html(renderParentPage(sections));
    }

    return html("Page introuvable.", 404);
  }
};
