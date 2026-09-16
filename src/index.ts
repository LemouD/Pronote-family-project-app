import { children, findChildBySlug, findChildByTutorSlug, type ChildConfig } from "./children";
import { addCustomTask, isCustomTaskId, listCustomTasks, setCustomTaskStatus, validateNewCustomTask } from "./customTasks";
import { mergeForDisplay } from "./displayItems";
import type { Env } from "./env";
import { checkAccess, childPinScope, hasPin, isValidPinFormat, type PinScope, sessionCookie, setPin, tutorPinScope, verifyPin } from "./pinAuth";
import { GeminiError, generateExamExercise, generateExercise } from "./gemini";
import {
  addSession,
  catalogueFor,
  completeSession,
  consumeQuota,
  getQuota,
  listSessions,
  markExamSeen,
  newlyCompleted,
  removeSession,
  revealCorrection,
  toView,
  validateChoice
} from "./examPrep";
import {
  addNote,
  applyProposal,
  findNote,
  isAppliedExerciseId,
  listApplied,
  listNotes,
  listProposals,
  removeApplied,
  removeProposal,
  saveProposal,
  setAppliedStatus,
  validateTutorNote
} from "./homeTutoring";
import { renderTutorLogin, renderTutorPage, renderTutorPinMissing } from "./tutorPage";
import { checkAttempts, clearAttempts, recordFailure } from "./loginAttempts";
import { exchangeTokenForSession, isParentAuthorized } from "./parentAuth";
import {
  ADD_TASK_SCRIPT,
  type ChildGrades,
  type DevoirsFilters,
  OVERVIEW_SUBTITLE,
  type ParentChildData,
  renderDevoirs,
  renderDevoirsToolbar,
  renderForbidden,
  renderDevoirMaison,
  renderNotes,
  renderOverview,
  renderReglages,
  type TutoringView
} from "./parentSections";
import { renderParentShell, type ParentSectionId } from "./parentShell";
import type { ChildContext } from "./childShell";
import { annotateNewlyDone, markSeen } from "./parentView";
import { serveFont } from "./fonts";
import { getGrades, overallAverage, overallEvolution, recentGrades, subjectEvolution, summarizeBySubject } from "./grades";
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
import {
  renderChildHomework,
  renderChildLogin,
  renderChildPinMissing,
  renderChildPrayers,
  renderChildSettings,
  renderChildExamPrep,
  renderChildTutoring
} from "./render";

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

/**
 * Verifie un code soumis, avec plafond d'essais. Partage par la page enfant et
 * celle du prof : meme mecanique, seule la portee change.
 */
async function submitPin(
  request: Request,
  env: Env,
  scope: PinScope,
  onFailure: (message: string, status: number) => Response,
  onSuccess: (cookie: string) => Response
): Promise<Response> {
  const attempts = await checkAttempts(env, scope.attemptsScope);
  if (!attempts.allowed) {
    return onFailure(`Trop d'essais. Reessaie dans ${Math.ceil(attempts.retryInSeconds / 60)} minutes.`, 429);
  }

  const form = await request.formData();
  const pin = form.get("pin");
  const token = isValidPinFormat(pin) ? await verifyPin(env, scope, pin) : null;

  if (token === null) {
    await recordFailure(env, scope.attemptsScope);
    return onFailure("Code incorrect.", 401);
  }

  await clearAttempts(env, scope.attemptsScope);
  return onSuccess(sessionCookie(scope, token));
}

async function loadParentData(env: Env): Promise<ParentChildData[]> {
  const today = todayInParis();

  return Promise.all(
    children.map(async (child) => {
      const [{ items: homework, error }, customTasks, sync, prayers, prefs, pinConfigured, tutorPinConfigured, examCompleted, notes, proposals, grades] = await Promise.all([
        getHomeworkSafe(env, child),
        listCustomTasks(env, child),
        getExternalSyncStatus(env, child),
        getPrayerProgress(env, child, today),
        getChildPreferences(env, child),
        hasPin(env, childPinScope(child)),
        hasPin(env, tutorPinScope(child)),
        newlyCompleted(env, child),
        // La vue d'ensemble doit dire ce qui attend vraiment le parent :
        // seances non traitees, propositions non validees, dernieres notes.
        listNotes(env, child),
        listProposals(env, child),
        getGrades(env, child)
      ]);
      const items = await annotateNewlyDone(env, child, mergeForDisplay(homework, customTasks));
      const proposedNoteIds = new Set(proposals.map((proposal) => proposal.noteId));
      return {
        child,
        items,
        error,
        sync,
        prayers,
        accent: findAccent(prefs.accentId),
        hasPin: pinConfigured,
        hasTutorPin: tutorPinConfigured,
        examCompleted,
        tutoringPending: notes.filter((note) => !proposedNoteIds.has(note.id)).length + proposals.length,
        recentGrades: recentGrades(grades)
      };
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

async function loadTutoring(env: Env): Promise<TutoringView[]> {
  return Promise.all(
    children.map(async (child) => {
      const [notes, proposals, applied, prefs] = await Promise.all([
        listNotes(env, child),
        listProposals(env, child),
        listApplied(env, child),
        getChildPreferences(env, child)
      ]);

      const proposedNoteIds = new Set(proposals.map((proposal) => proposal.noteId));
      return {
        child,
        accent: findAccent(prefs.accentId),
        pendingNotes: notes.filter((note) => !proposedNoteIds.has(note.id)),
        proposals: proposals.map((proposal) => ({ proposal, note: notes.find((note) => note.id === proposal.noteId) })),
        applied
      };
    })
  );
}

/**
 * Messages d'erreur indexes par code : la redirection ne transporte qu'un
 * identifiant, jamais un texte, pour ne rien refleter d'arbitraire dans la page.
 */
const TUTORING_ERRORS: Record<string, string> = {
  surcharge: "Le service d'IA est momentanement sature. Reessaie dans quelques minutes.",
  generation: "La generation a echoue. Reessaie, ou verifie la cle GEMINI_API_KEY.",
  introuvable: "Cette proposition n'existe plus : elle a peut-etre deja ete traitee."
};

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
    const views = await loadTutoring(env);
    const errorCode = url.searchParams.get("erreur");
    return html(
      renderParentShell({
        prefs,
        active: "devoir-maison",
        title: page.title,
        subtitle: page.subtitle,
        pendingReviews: views.reduce((total, view) => total + view.pendingNotes.length + view.proposals.length, 0),
        body: renderDevoirMaison(views, {
          error: errorCode ? TUTORING_ERRORS[errorCode] : undefined,
          aiConfigured: typeof env.GEMINI_API_KEY === "string" && env.GEMINI_API_KEY.length > 0
        })
      })
    );
  }

  const data = await loadParentData(env);

  if (page.section === "overview") {
    const body = renderOverview(data);
    // La vue d'ensemble est la page d'atterrissage : c'est elle qui consomme
    // les badges "nouveau", pas les autres sections qui affichent les memes devoirs.
    await Promise.all(
      data.flatMap((entry) => [markSeen(env, entry.child, entry.items), markExamSeen(env, entry.child)])
    );
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

    // Page du prof de maison. Protegee par un code, comme les pages enfant :
    // ce lien sort de la famille, il ne peut pas reposer sur sa seule
    // non-devinabilite.
    const tutorMatch = path.match(/^\/prof\/([^/]+)(\/[^?]*)?$/);
    if (tutorMatch) {
      const child = findChildByTutorSlug(tutorMatch[1]);
      if (!child) return html("Page introuvable.", 404);
      const sub = tutorMatch[2] ?? "";
      const scope = tutorPinScope(child);

      if (sub === "/code" && request.method === "POST") {
        return submitPin(
          request,
          env,
          scope,
          (message, status) => html(renderTutorLogin(child, { error: message }), status),
          (cookie) =>
            new Response(null, {
              status: 303,
              headers: { location: `/prof/${child.tutorSlug}`, "set-cookie": cookie, ...NO_STORE }
            })
        );
      }

      const access = await checkAccess(request, env, scope);
      if (access !== "granted") {
        return access === "pin-not-configured"
          ? html(renderTutorPinMissing(child), 403)
          : html(renderTutorLogin(child), 401);
      }

      if (sub === "" && request.method === "GET") {
        const subjectFilter = url.searchParams.get("matiere");
        return html(
          renderTutorPage(child, await listNotes(env, child), {
            saved: url.searchParams.has("ok"),
            // Une matiere inconnue est ignoree plutot que refusee : le
            // filtre est un confort, pas un controle d'acces.
            subjectFilter: subjectFilter && child.homeworkSubjects.includes(subjectFilter) ? subjectFilter : null
          })
        );
      }

      if (sub === "" && request.method === "POST") {
        const form = await request.formData();
        const input = validateTutorNote(child, {
          subject: form.get("subject"),
          done: form.get("done"),
          difficulty: form.get("difficulty")
        });
        if (!input) return html(renderTutorPage(child, await listNotes(env, child)), 400);

        try {
          await addNote(env, child, input);
        } catch (error) {
          console.error(`addNote(${child.slug}) failed:`, error);
          return html("Impossible d'enregistrer la seance, reessayez.", 500);
        }

        return new Response(null, { status: 303, headers: { location: `/prof/${child.tutorSlug}?ok`, ...NO_STORE } });
      }

      return html("Page introuvable.", 404);
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
        const context = await childContext(env, child);
        return submitPin(
          request,
          env,
          childPinScope(child),
          (message, status) => html(renderChildLogin(context, { error: message }), status),
          (cookie) =>
            new Response(null, {
              status: 303,
              headers: { location: `/enfant/${child.slug}`, "set-cookie": cookie, ...NO_STORE }
            })
        );
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

      const access = await checkAccess(request, env, childPinScope(child));
      if (access !== "granted") {
        // Les endpoints appeles en fetch attendent du JSON, pas une page.
        if (request.method === "POST" && sub.endsWith("/toggle")) {
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

      // Preparation d'examen : seulement pour un enfant concerne.
      if (sub.startsWith("/brevet")) {
        const catalogue = catalogueFor(child);
        if (!catalogue) return html("Page introuvable.", 404);

        const today = todayInParis();
        const showPage = async (error?: string, status = 200) => {
          const [context, sessions, quota] = await Promise.all([
            childContext(env, child),
            listSessions(env, child),
            getQuota(env, child, today)
          ]);
          return html(renderChildExamPrep(context, catalogue, sessions.map(toView), quota, { error }), status);
        };

        if (sub === "/brevet" && request.method === "GET") return showPage();

        if (sub === "/brevet/generer" && request.method === "POST") {
          const quota = await getQuota(env, child, today);
          if (quota.remaining === 0) {
            return showPage("Tu as atteint le nombre d'exercices pour aujourd'hui. Reviens demain.", 429);
          }

          // Le select encode "matiere|notion" ; les deux doivent exister dans
          // le catalogue, sinon rien ne part vers le modele.
          const form = await request.formData();
          const raw = String(form.get("topic") ?? "");
          const separator = raw.indexOf("|");
          const choice =
            separator === -1
              ? null
              : validateChoice(catalogue, {
                  subjectId: raw.slice(0, separator),
                  topic: raw.slice(separator + 1),
                  formatId: form.get("formatId")
                });
          if (!choice) return showPage("Choix invalide, reessaie.", 400);

          try {
            const generated = await generateExamExercise(env, child, choice, catalogue.label);
            await addSession(env, child, choice, generated);
            await consumeQuota(env, child, today);
          } catch (error) {
            console.error(`generateExamExercise(${child.slug}) failed:`, error);
            return showPage(
              error instanceof GeminiError && error.transient
                ? "Trop de monde en ce moment. Reessaie dans quelques minutes."
                : "La generation ne marche pas. Previens Maman ou Papa.",
              error instanceof GeminiError && error.transient ? 503 : 502
            );
          }

          return new Response(null, { status: 303, headers: { location: `/enfant/${child.slug}/brevet`, ...NO_STORE } });
        }

        if (sub === "/brevet/supprimer" && request.method === "POST") {
          const form = await request.formData();
          // removeSession refuse un exercice non termine : l'echec ici veut
          // dire "deja supprime" ou "pas encore fini", jamais une suppression
          // silencieuse d'un travail en cours.
          const removed = await removeSession(env, child, String(form.get("sessionId") ?? ""));
          if (!removed) return showPage("Cet exercice ne peut pas etre supprime.", 400);
          return new Response(null, { status: 303, headers: { location: `/enfant/${child.slug}/brevet`, ...NO_STORE } });
        }

        if ((sub === "/brevet/correction" || sub === "/brevet/valider") && request.method === "POST") {
          const form = await request.formData();
          const sessionId = String(form.get("sessionId") ?? "");
          const updated =
            sub === "/brevet/correction"
              ? await revealCorrection(env, child, sessionId)
              : await completeSession(env, child, sessionId);

          if (!updated) return showPage("Cet exercice n'existe plus.", 404);
          return new Response(null, { status: 303, headers: { location: `/enfant/${child.slug}/brevet`, ...NO_STORE } });
        }

        return html("Page introuvable.", 404);
      }

      if (sub === "/devoir-maison" && request.method === "GET") {
        const [context, exercises] = await Promise.all([childContext(env, child), listApplied(env, child)]);
        return html(renderChildTutoring(context, exercises));
      }

      if (sub === "/devoir-maison/toggle" && request.method === "POST") {
        let body: { id?: string; done?: boolean };
        try {
          body = await request.json();
        } catch {
          return json({ error: "invalid body" }, 400);
        }

        if (typeof body.id !== "string" || !isAppliedExerciseId(body.id) || typeof body.done !== "boolean") {
          return json({ error: "id and done are required" }, 400);
        }

        try {
          const found = await setAppliedStatus(env, child, body.id, body.done);
          if (!found) return json({ error: "unknown exercise" }, 404);
          return json({ ok: true });
        } catch (error) {
          console.error(`tutoringToggle(${child.slug}, ${body.id}) failed:`, error);
          return json({ error: "Impossible d'enregistrer, reessaie." }, 500);
        }
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

    // Actions du devoir maison. La generation est declenchee ici, depuis
    // l'espace authentifie : aucune requete non authentifiee ne peut couter
    // un appel a l'API.
    if (path.startsWith("/parent/devoir-maison/") && request.method === "POST") {
      if (!isParentAuthorized(request, env)) {
        return html(renderForbidden(Boolean(env.PARENT_ACCESS_TOKEN)), 403);
      }

      const form = await request.formData();
      const child = findChildBySlug(String(form.get("childSlug") ?? ""));
      if (!child) return html("Enfant inconnu.", 400);

      const back = (errorCode?: string) =>
        new Response(null, {
          status: 303,
          headers: { location: errorCode ? `/parent/devoir-maison?erreur=${errorCode}` : "/parent/devoir-maison", ...NO_STORE }
        });

      if (path === "/parent/devoir-maison/generer" || path === "/parent/devoir-maison/regenerer") {
        // Regenerer part de la proposition affichee pour retrouver sa note ;
        // generer part directement de la note.
        let noteId = String(form.get("noteId") ?? "");
        if (path === "/parent/devoir-maison/regenerer") {
          const proposals = await listProposals(env, child);
          const current = proposals.find((proposal) => proposal.id === String(form.get("proposalId") ?? ""));
          if (!current) return back("introuvable");
          noteId = current.noteId;
        }

        const note = await findNote(env, child, noteId);
        if (!note) return back("introuvable");

        try {
          const exercise = await generateExercise(env, child, note);
          await saveProposal(env, child, note, exercise);
        } catch (error) {
          console.error(`generateExercise(${child.slug}) failed:`, error);
          // Une saturation passagere n'appelle pas le meme geste qu'une cle
          // invalide : on ne renvoie pas le parent verifier sa configuration
          // pour un incident qui se resout tout seul.
          return back(error instanceof GeminiError && error.transient ? "surcharge" : "generation");
        }
        return back();
      }

      // Supprimer une proposition = la sortir de la liste sans rien publier.
      // La note du prof, elle, reste : elle n'appartient pas a cette action.
      if (path === "/parent/devoir-maison/supprimer") {
        const proposal = await removeProposal(env, child, String(form.get("proposalId") ?? ""));
        return proposal ? back() : back("introuvable");
      }

      if (path === "/parent/devoir-maison/retirer") {
        const removed = await removeApplied(env, child, String(form.get("appliedId") ?? ""));
        return removed ? back() : back("introuvable");
      }

      if (path === "/parent/devoir-maison/appliquer") {
        const proposal = await removeProposal(env, child, String(form.get("proposalId") ?? ""));
        if (!proposal) return back("introuvable");

        const edited = form.get("exercise");
        try {
          // Le texte retenu est celui affiche au parent au moment du clic,
          // donc sa version corrigee le cas echeant.
          await applyProposal(env, child, proposal, typeof edited === "string" ? edited : proposal.exercise);
        } catch (error) {
          console.error(`applyProposal(${child.slug}) failed:`, error);
          return back("generation");
        }
        return back();
      }

      return html("Page introuvable.", 404);
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

      const scope = form.get("scope") === "tutor" ? tutorPinScope(child) : childPinScope(child);
      try {
        await setPin(env, scope, pin);
        // Un nouveau code invalide les sessions en cours : les appareils
        // concernes redemanderont le code.
        await clearAttempts(env, scope.attemptsScope);
      } catch (error) {
        console.error(`setPin(${scope.storageKey}) failed:`, error);
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
