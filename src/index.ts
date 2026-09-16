import { children, findChildBySlug, type ChildConfig } from "./children";
import { addCustomTask, isCustomTaskId, listCustomTasks, setCustomTaskStatus, validateNewCustomTask } from "./customTasks";
import { mergeForDisplay } from "./displayItems";
import type { Env } from "./env";
import { checkChildAccess, childSessionCookie, hasChildPin, isValidPinFormat, setChildPin, verifyChildPin } from "./childAuth";
import { checkAttempts, clearAttempts, recordFailure } from "./loginAttempts";
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
import type { ChildContext } from "./childShell";
import { annotateNewlyDone, markSeen } from "./parentView";
import { serveFont } from "./fonts";
import { getGrades, overallAverage, overallEvolution, subjectEvolution, summarizeBySubject } from "./grades";
import { getPrayerDay, getPrayerProgress, isKnownPrayerId, setPrayerStatus, todayInParis } from "./prayers";
import {
  type ChildPreferences,
  findAccent,
  getChildPreferences,
  getParentPreferences,
  isAccentId,
  isAvatarFor,
  isTheme,
  type ParentPreferences,
  parentPreferencesCookie,
  sanitizeParentName,
  setChildPreferences,
  type Theme
} from "./preferences";
import { getExternalSyncStatus, getHomework, type HomeworkItem, setHomeworkStatus } from "./pronote";
import { PWA_ASSET_PATHS, serveIcon, serveManifest, serveServiceWorker } from "./pwa";
import { renderChildHomework, renderChildLogin, renderChildPinMissing, renderChildPrayers, renderChildSettings } from "./render";

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

/** Contexte d'affichage d'un enfant : sa config plus ce qu'il a choisi lui-meme. */
async function childContext(env: Env, child: ChildConfig): Promise<ChildContext> {
  const prefs = await getChildPreferences(env, child);
  return { child, prefs, accent: findAccent(prefs.accentId) };
}

async function loadParentData(env: Env): Promise<ParentChildData[]> {
  const today = todayInParis();

  return Promise.all(
    children.map(async (child) => {
      const [{ items: homework, error }, customTasks, sync, prayers, prefs, hasPin] = await Promise.all([
        getHomeworkSafe(env, child),
        listCustomTasks(env, child),
        getExternalSyncStatus(env, child),
        getPrayerProgress(env, child, today),
        getChildPreferences(env, child),
        hasChildPin(env, child)
      ]);
      const items = await annotateNewlyDone(env, child, mergeForDisplay(homework, customTasks));
      return { child, items, error, sync, prayers, accent: findAccent(prefs.accentId), hasPin };
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
      const [grades, prefs] = await Promise.all([getGrades(env, child), getChildPreferences(env, child)]);
      return {
        child,
        accent: findAccent(prefs.accentId),
        overall: overallAverage(grades),
        subjects: summarizeBySubject(grades),
        overallSeries: overallEvolution(grades),
        subjectSeries: subjectEvolution(grades)
      };
    })
  );
}

async function renderParentPage(page: ParentPage, env: Env, url: URL, prefs: ParentPreferences): Promise<Response> {
  if (page.section === "notes") {
    return html(
      renderParentShell({
        prefs,
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
        prefs,
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
    return html(renderParentShell({ prefs, active: "overview", title: page.title, subtitle: OVERVIEW_SUBTITLE(), body }));
  }

  if (page.section === "devoirs") {
    const filters = parseDevoirsFilters(url);
    return html(
      renderParentShell({
        prefs,
        active: "devoirs",
        title: page.title,
        toolbar: renderDevoirsToolbar(data, filters),
        body: renderDevoirs(data, filters),
        script: ADD_TASK_SCRIPT
      })
    );
  }

  return html(renderParentShell({ prefs, active: "reglages", title: page.title, body: renderReglages(data, prefs) }));
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

    // Tout /enfant/<slug>/... passe par ce point unique : le controle d'acces
    // est fait une seule fois, ce qui evite d'oublier une route en ajoutant
    // une page plus tard.
    const childMatch = path.match(/^\/enfant\/([^/]+)(\/[^?]*)?$/);
    if (childMatch) {
      const child = findChildBySlug(childMatch[1]);
      if (!child) return html("Page introuvable.", 404);
      const sub = childMatch[2] ?? "";

      // Seule route ouverte : la soumission du code lui-meme.
      if (sub === "/code" && request.method === "POST") {
        const scope = `child:${child.slug}`;
        const attempts = await checkAttempts(env, scope);
        if (!attempts.allowed) {
          return html(
            renderChildLogin(await childContext(env, child), {
              error: `Trop d'essais. Reessaie dans ${Math.ceil(attempts.retryInSeconds / 60)} minutes.`
            }),
            429
          );
        }

        const form = await request.formData();
        const pin = form.get("pin");
        const token = isValidPinFormat(pin) ? await verifyChildPin(env, child, pin) : null;

        if (token === null) {
          await recordFailure(env, scope);
          return html(renderChildLogin(await childContext(env, child), { error: "Code incorrect." }), 401);
        }

        await clearAttempts(env, scope);
        return new Response(null, {
          status: 303,
          headers: { location: `/enfant/${child.slug}`, "set-cookie": childSessionCookie(child, token), ...NO_STORE }
        });
      }

      // Ajout d'une tache perso par un parent, depuis son propre espace. Cette
      // route est volontairement placee AVANT le controle d'acces enfant :
      // elle s'authentifie avec le token parent, pas avec le code de l'enfant,
      // que le navigateur du parent ne possede pas.
      if (sub === "/tasks" && request.method === "POST") {
        if (!isParentAuthorized(request, env)) return json({ error: "unauthorized" }, 403);

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

      const access = await checkChildAccess(request, env, child);
      if (access !== "granted") {
        // Les endpoints appeles en fetch attendent du JSON, pas une page.
        if (request.method === "POST" && (sub === "/toggle" || sub === "/prieres/toggle")) {
          return json({ error: "locked" }, 401);
        }
        const context = await childContext(env, child);
        return access === "pin-not-configured"
          ? html(renderChildPinMissing(context), 403)
          : html(renderChildLogin(context), 401);
      }

      if (sub === "" && request.method === "GET") {
        const [{ items: homework, error }, customTasks, context] = await Promise.all([
          getHomeworkSafe(env, child),
          listCustomTasks(env, child),
          childContext(env, child)
        ]);
        return html(renderChildHomework(context, mergeForDisplay(homework, customTasks), error), error ? 500 : 200);
      }

      if (sub === "/prieres" && request.method === "GET") {
        const [context, prayers] = await Promise.all([childContext(env, child), getPrayerDay(env, child, todayInParis())]);
        return html(renderChildPrayers(context, prayers));
      }

      if (sub === "/reglages" && request.method === "GET") {
        return html(renderChildSettings(await childContext(env, child)));
      }

      if (sub === "/reglages" && request.method === "POST") {
        // Tout est un choix dans une liste fermee : une valeur inconnue laisse
        // le reglage en place plutot que d'en imposer un autre par defaut.
        const form = await request.formData();
        const current = await getChildPreferences(env, child);
        const theme = form.get("theme");
        const accentId = form.get("accentId");
        const avatar = form.get("avatar");

        const next: ChildPreferences = {
          theme: isTheme(theme) ? theme : current.theme,
          accentId: isAccentId(accentId) ? accentId : current.accentId,
          avatar: isAvatarFor(child, avatar) ? avatar : current.avatar
        };

        try {
          await setChildPreferences(env, child, next);
        } catch (error) {
          console.error(`setChildPreferences(${child.slug}) failed:`, error);
          return html("Impossible d'enregistrer, reessaie.", 500);
        }

        // Redirection apres envoi : un rechargement ne renvoie pas le formulaire.
        return new Response(null, { status: 303, headers: { location: `/enfant/${child.slug}/reglages`, ...NO_STORE } });
      }

      if (sub === "/toggle" && request.method === "POST") {
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

      if (sub === "/prieres/toggle" && request.method === "POST") {
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

      return html("Page introuvable.", 404);
    }

    // Ressources statiques (PWA, police) : publiques, sans donnees personnelles
    // (voir pwa.ts - le navigateur telecharge le manifeste sans cookies).
    if (request.method === "GET") {
      if (path === PWA_ASSET_PATHS.manifest) return serveManifest();
      if (path === PWA_ASSET_PATHS.serviceWorker) return serveServiceWorker();
      const asset = serveIcon(path) ?? serveFont(path);
      if (asset) return asset;
    }

    if (path === "/parent/code" && request.method === "POST") {
      if (!isParentAuthorized(request, env)) {
        return html(renderForbidden(Boolean(env.PARENT_ACCESS_TOKEN)), 403);
      }

      const form = await request.formData();
      const child = findChildBySlug(String(form.get("childSlug") ?? ""));
      const pin = form.get("pin");
      if (!child || !isValidPinFormat(pin)) {
        return html("Code invalide : il doit faire exactement 5 chiffres.", 400);
      }

      try {
        await setChildPin(env, child, pin);
        // Un nouveau code invalide les sessions en cours : les appareils de
        // l'enfant redemanderont le code.
        await clearAttempts(env, `child:${child.slug}`);
      } catch (error) {
        console.error(`setChildPin(${child.slug}) failed:`, error);
        return html("Impossible d'enregistrer le code, reessaie.", 500);
      }

      return new Response(null, { status: 303, headers: { location: "/parent/reglages", ...NO_STORE } });
    }

    if (path === "/parent/reglages" && request.method === "POST") {
      if (!isParentAuthorized(request, env)) {
        return html(renderForbidden(Boolean(env.PARENT_ACCESS_TOKEN)), 403);
      }

      const form = await request.formData();
      const theme = form.get("theme");
      const prefs: ParentPreferences = {
        name: sanitizeParentName(form.get("name")),
        theme: isTheme(theme) ? (theme as Theme) : "system"
      };

      return new Response(null, {
        status: 303,
        headers: { location: "/parent/reglages", "set-cookie": parentPreferencesCookie(prefs), ...NO_STORE }
      });
    }

    const parentPage = PARENT_PAGES.get(path);
    if (parentPage && request.method === "GET") {
      // Le token arrive en clair dans l'URL a la premiere visite : on l'echange
      // aussitot contre un cookie de session, avant meme le controle d'acces.
      const exchanged = exchangeTokenForSession(request, env);
      if (exchanged) {
        await clearAttempts(env, "parent");
        return exchanged;
      }

      if (!isParentAuthorized(request, env)) {
        // Un token presente et refuse compte comme un essai ; une visite sans
        // token du tout n'en est pas un, sinon un simple lien partage
        // bloquerait l'acces legitime.
        const presented = url.searchParams.has("token") || request.headers.has("x-parent-token");
        if (presented) {
          const attempts = await checkAttempts(env, "parent");
          if (!attempts.allowed) {
            return html(renderForbidden(Boolean(env.PARENT_ACCESS_TOKEN)), 429);
          }
          await recordFailure(env, "parent");
        }
        return html(renderForbidden(Boolean(env.PARENT_ACCESS_TOKEN)), 403);
      }

      return renderParentPage(parentPage, env, url, getParentPreferences(request));
    }

    return html("Page introuvable.", 404);
  }
};
