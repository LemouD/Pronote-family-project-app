import { children, findChildBySlug, type ChildConfig } from "./children";
import { addCustomTask, isCustomTaskId, listCustomTasks, setCustomTaskStatus, validateNewCustomTask } from "./customTasks";
import { mergeForDisplay } from "./displayItems";
import type { Env } from "./env";
import { exchangeTokenForSession, isParentAuthorized } from "./parentAuth";
import {
  ADD_TASK_SCRIPT,
  type ChildGrades,
  type DevoirsFilters,
  OVERVIEW_SUBTITLE,
  type ParentChildData,
  renderComingSoon,
  renderDevoirs,
  renderDevoirsToolbar,
  renderForbidden,
  renderNotes,
  renderOverview,
  renderReglages
} from "./parentSections";
import { renderParentShell, type ParentSectionId } from "./parentShell";
import { annotateNewlyDone, markSeen } from "./parentView";
import { serveFont } from "./fonts";
import { getGrades, overallAverage, overallEvolution, subjectEvolution, summarizeBySubject } from "./grades";
import { getPrayerDay, getPrayerProgress, isKnownPrayerId, setPrayerStatus, todayInParis } from "./prayers";
import { getExternalSyncStatus, getHomework, type HomeworkItem, setHomeworkStatus } from "./pronote";
import { PWA_ASSET_PATHS, serveIcon, serveManifest, serveServiceWorker } from "./pwa";
import { renderChildHomework, renderChildPrayers } from "./render";

// Contenu 100% genere cote serveur, pas de ressources externes : une CSP
// stricte (pas de scripts/objets tiers) reste compatible avec le <script>/
// <style> inline utilises dans render.ts et parentShell.ts.
const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "content-security-policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self'; " +
    "worker-src 'self'; manifest-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
};

// Donnees personnelles d'un enfant : jamais mises en cache (navigateur ou
// intermediaire), utile notamment sur une tablette partagee.
const NO_STORE = { "cache-control": "private, no-store" };

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Devoirs">
  <rect width="64" height="64" rx="14" fill="#2f6fed"/>
  <path d="M16 18h25a7 7 0 0 1 7 7v22H23a7 7 0 0 1-7-7V18Z" fill="#fff"/>
  <path d="M23 18v22a7 7 0 0 1 7 7h18" fill="none" stroke="#2f6fed" stroke-width="4"/>
  <path d="m30 32 5 5 10-11" fill="none" stroke="#f5b942" stroke-linecap="round" stroke-linejoin="round" stroke-width="5"/>
</svg>`;

function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", ...SECURITY_HEADERS, ...NO_STORE }
  });
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...SECURITY_HEADERS, ...NO_STORE }
  });
}

/**
 * getHomework peut echouer (Pronote indisponible, secrets manquants, etc.)
 * sans que ca doive faire disparaitre les taches perso (independantes de
 * Pronote) de la page : on isole l'echec ici plutot que de le laisser
 * planter tout le Promise.all appelant.
 */
async function getHomeworkSafe(env: Env, child: ChildConfig): Promise<{ items: HomeworkItem[]; error?: string }> {
  try {
    return { items: await getHomework(env, child) };
  } catch (error) {
    console.error(`getHomework(${child.slug}) failed:`, error);
    return { items: [], error: "Impossible de recuperer les devoirs pour le moment." };
  }
}

async function loadParentData(env: Env): Promise<ParentChildData[]> {
  const today = todayInParis();

  return Promise.all(
    children.map(async (child) => {
      const [{ items: homework, error }, customTasks, sync, prayers] = await Promise.all([
        getHomeworkSafe(env, child),
        listCustomTasks(env, child),
        getExternalSyncStatus(env, child),
        getPrayerProgress(env, child, today)
      ]);
      const items = await annotateNewlyDone(env, child, mergeForDisplay(homework, customTasks));
      return { child, items, error, sync, prayers };
    })
  );
}

function parseDevoirsFilters(url: URL): DevoirsFilters {
  const status = url.searchParams.get("statut");
  const childSlug = url.searchParams.get("enfant");

  return {
    childSlug: childSlug ? childSlug : null,
    status: status === "done" || status === "todo" ? status : "all"
  };
}

interface ParentPage {
  section: ParentSectionId;
  title: string;
  subtitle: string;
}

// Une Map plutot qu'un objet : la cle vient de l'URL, et un objet litteral
// resoudrait aussi les cles heritees de Object.prototype.
const PARENT_PAGES = new Map<string, ParentPage>([
  ["/parent", { section: "overview", title: "Vue d'ensemble", subtitle: "Ou en sont les enfants aujourd'hui et demain." }],
  ["/parent/devoirs", { section: "devoirs", title: "Devoirs", subtitle: "Detail par enfant, filtrable par matiere et par statut." }],
  ["/parent/notes", { section: "notes", title: "Notes", subtitle: "Releve de notes par matiere." }],
  [
    "/parent/devoir-maison",
    { section: "devoir-maison", title: "Devoir maison", subtitle: "Exercices proposes apres les seances avec le prof de maison." }
  ],
  ["/parent/reglages", { section: "reglages", title: "Reglages", subtitle: "Configuration des enfants et installation de l'application." }]
]);

async function loadGrades(env: Env): Promise<ChildGrades[]> {
  return Promise.all(
    children.map(async (child) => {
      const grades = await getGrades(env, child);
      return {
        child,
        overall: overallAverage(grades),
        subjects: summarizeBySubject(grades),
        overallSeries: overallEvolution(grades),
        subjectSeries: subjectEvolution(grades)
      };
    })
  );
}

async function renderParentPage(page: ParentPage, env: Env, url: URL): Promise<Response> {
  if (page.section === "notes") {
    return html(
      renderParentShell({
        active: "notes",
        title: page.title,
        subtitle: page.subtitle,
        body: renderNotes(await loadGrades(env))
      })
    );
  }

  if (page.section === "devoir-maison") {
    return html(
      renderParentShell({
        active: "devoir-maison",
        title: page.title,
        subtitle: page.subtitle,
        body: renderComingSoon(
          "Pas encore disponible",
          "Le prof de maison notera ici ce qui a ete travaille, et tu pourras valider les exercices proposes avant qu'ils arrivent chez l'enfant."
        )
      })
    );
  }

  const data = await loadParentData(env);

  if (page.section === "overview") {
    const body = renderOverview(data);
    // La vue d'ensemble est la page d'atterrissage : c'est elle qui consomme
    // les badges "nouveau", pas les autres sections qui affichent les memes devoirs.
    await Promise.all(data.map((entry) => markSeen(env, entry.child, entry.items)));
    return html(renderParentShell({ active: "overview", title: page.title, subtitle: OVERVIEW_SUBTITLE(), body }));
  }

  if (page.section === "devoirs") {
    const filters = parseDevoirsFilters(url);
    return html(
      renderParentShell({
        active: "devoirs",
        title: page.title,
        toolbar: renderDevoirsToolbar(data, filters),
        body: renderDevoirs(data, filters),
        script: ADD_TASK_SCRIPT
      })
    );
  }

  return html(renderParentShell({ active: "reglages", title: page.title, body: renderReglages(data) }));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    // /parent et /parent/ designent la meme page ; le manifeste PWA utilise la
    // forme avec slash final (obligatoire pour que start_url reste dans scope).
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (path === "/favicon.svg" && request.method === "GET") {
      return new Response(FAVICON_SVG, {
        headers: { "content-type": "image/svg+xml; charset=utf-8", ...SECURITY_HEADERS, "cache-control": "public, max-age=3600" }
      });
    }

    if (path === "/") {
      return html("<p>Voir /enfant/&lt;slug&gt; ou /parent.</p>");
    }

    const childPageMatch = path.match(/^\/enfant\/([^/]+)$/);
    if (childPageMatch && request.method === "GET") {
      const child = findChildBySlug(childPageMatch[1]);
      if (!child) return html("Page introuvable.", 404);

      const [{ items: homework, error }, customTasks] = await Promise.all([getHomeworkSafe(env, child), listCustomTasks(env, child)]);
      return html(renderChildHomework(child, mergeForDisplay(homework, customTasks), error), error ? 500 : 200);
    }

    const prayersPageMatch = path.match(/^\/enfant\/([^/]+)\/prieres$/);
    if (prayersPageMatch && request.method === "GET") {
      const child = findChildBySlug(prayersPageMatch[1]);
      if (!child) return html("Page introuvable.", 404);

      return html(renderChildPrayers(child, await getPrayerDay(env, child, todayInParis())));
    }

    const prayerToggleMatch = path.match(/^\/enfant\/([^/]+)\/prieres\/toggle$/);
    if (prayerToggleMatch && request.method === "POST") {
      const child = findChildBySlug(prayerToggleMatch[1]);
      if (!child) return json({ error: "unknown child" }, 404);

      let body: { id?: string; done?: boolean };
      try {
        body = await request.json();
      } catch {
        return json({ error: "invalid body" }, 400);
      }

      if (typeof body.id !== "string" || !isKnownPrayerId(body.id) || typeof body.done !== "boolean") {
        return json({ error: "id and done are required" }, 400);
      }

      try {
        await setPrayerStatus(env, child, todayInParis(), body.id, body.done);
        return json({ ok: true });
      } catch (error) {
        console.error(`prayerToggle(${child.slug}, ${body.id}) failed:`, error);
        return json({ error: "Impossible d'enregistrer, reessaie." }, 500);
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
        if (isCustomTaskId(body.id)) {
          const found = await setCustomTaskStatus(env, child, body.id, body.done);
          if (!found) return json({ error: "unknown task" }, 404);
        } else {
          await setHomeworkStatus(env, child, body.id, body.done);
        }
        return json({ ok: true });
      } catch (error) {
        console.error(`toggle(${child.slug}, ${body.id}) failed:`, error);
        return json({ error: "Impossible d'enregistrer, reessaie." }, 500);
      }
    }

    // Ajout d'une tache perso par un parent. Meme controle d'acces que /parent :
    // un enfant qui connait son propre slug ne peut pas ajouter de taches sans
    // le PARENT_ACCESS_TOKEN.
    const addTaskMatch = path.match(/^\/enfant\/([^/]+)\/tasks$/);
    if (addTaskMatch && request.method === "POST") {
      if (!isParentAuthorized(request, env)) {
        return json({ error: "unauthorized" }, 403);
      }

      const child = findChildBySlug(addTaskMatch[1]);
      if (!child) return json({ error: "unknown child" }, 404);

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return json({ error: "invalid body" }, 400);
      }

      const input = validateNewCustomTask((body ?? {}) as Record<string, unknown>);
      if (!input) return json({ error: "invalid task" }, 400);

      try {
        const task = await addCustomTask(env, child, input);
        return json({ ok: true, task }, 201);
      } catch (error) {
        console.error(`addCustomTask(${child.slug}) failed:`, error);
        return json({ error: "Impossible d'ajouter la tache, reessaie." }, 500);
      }
    }

    // Ressources statiques (PWA, police) : publiques, sans donnees personnelles
    // (voir pwa.ts - le navigateur telecharge le manifeste sans cookies).
    if (request.method === "GET") {
      if (path === PWA_ASSET_PATHS.manifest) return serveManifest();
      if (path === PWA_ASSET_PATHS.serviceWorker) return serveServiceWorker();
      const asset = serveIcon(path) ?? serveFont(path);
      if (asset) return asset;
    }

    const parentPage = PARENT_PAGES.get(path);
    if (parentPage && request.method === "GET") {
      // Le token arrive en clair dans l'URL a la premiere visite : on l'echange
      // aussitot contre un cookie de session, avant meme le controle d'acces.
      const exchanged = exchangeTokenForSession(request, env);
      if (exchanged) return exchanged;

      if (!isParentAuthorized(request, env)) {
        return html(renderForbidden(Boolean(env.PARENT_ACCESS_TOKEN)), 403);
      }

      return renderParentPage(parentPage, env, url);
    }

    return html("Page introuvable.", 404);
  }
};
