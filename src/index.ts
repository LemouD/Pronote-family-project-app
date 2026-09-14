import { children, findChildBySlug } from "./children";
import type { Env } from "./env";
import { getHomework, setHomeworkStatus } from "./pronote";
import { renderChildPage, renderParentPage } from "./render";

function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" }
  });
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function isParentAuthorized(request: Request, env: Env): boolean {
  if (!env.PARENT_ACCESS_TOKEN) return true; // pas de protection configuree
  const url = new URL(request.url);
  const provided = url.searchParams.get("token") ?? request.headers.get("x-parent-token");
  return provided === env.PARENT_ACCESS_TOKEN;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

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
        return html(renderChildPage(child, [], (error as Error).message), 500);
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

      if (typeof body.id !== "string" || typeof body.done !== "boolean") {
        return json({ error: "id and done are required" }, 400);
      }

      try {
        await setHomeworkStatus(env, child, body.id, body.done);
        return json({ ok: true });
      } catch (error) {
        return json({ error: (error as Error).message }, 500);
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
            return { child, items };
          } catch (error) {
            return { child, items: [], error: (error as Error).message };
          }
        })
      );

      return html(renderParentPage(sections));
    }

    return html("Page introuvable.", 404);
  }
};
