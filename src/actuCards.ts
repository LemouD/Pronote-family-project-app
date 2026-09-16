import { ACTU_LABEL, type ActuCategoryId } from "./actu";
import { type ChildContext, renderChildShell } from "./childShell";
import type { FootballView } from "./actuFootball";
import type { GameHighlight } from "./actuGames";
import type { QuizView } from "./actuQuiz";
import type { SpacePicture } from "./actuSpace";
import type { WikipediaDay } from "./actuWikipedia";
import { escapeHtml } from "./html";

/**
 * Cartes de la section Actu. Une carte par categorie active, dans l'ordre du
 * catalogue. Chacune reste dans l'identite visuelle de l'espace enfant plutot
 * que de ressembler a un fil d'actualite.
 */

const COMPASS_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`;

/** Toutes les images passent par le Worker (voir proxyImage). */
function imageTag(base: string, category: ActuCategoryId, alt: string): string {
  return `<img class="actu-image" src="${base}/image/${category}" alt="${escapeHtml(alt)}" loading="lazy" />`;
}

function card(options: { kind: string; title: string; body: string; footer?: string }): string {
  return `
    <section class="actu-card">
      <div class="actu-kind">${escapeHtml(options.kind)}</div>
      <h2 class="actu-title">${escapeHtml(options.title)}</h2>
      ${options.body}
      ${options.footer ? `<div class="actu-source">${escapeHtml(options.footer)}</div>` : ""}
    </section>
  `;
}

function renderWikipedia(day: WikipediaDay, base: string): string {
  const ephemerides = day.ephemerides.length
    ? `<div class="actu-label">Un ${new Date(`${day.date}T00:00:00Z`).getUTCDate()} comme aujourd'hui</div>
       <ul class="actu-list">${day.ephemerides
         .map((event) => `<li><b>${event.year}</b> — ${escapeHtml(event.text)}</li>`)
         .join("")}</ul>`
    : "";

  return card({
    kind: "Image du jour",
    title: day.caption || "L'image du jour",
    body: `${day.imageUrl ? imageTag(base, "wikipedia", day.caption || "Image du jour") : ""}${ephemerides}`,
    footer: "Wikipedia"
  });
}

function renderSpace(picture: SpacePicture, base: string): string {
  return card({
    kind: "Espace et sciences",
    title: picture.title,
    body: `
      ${picture.imageUrl ? imageTag(base, "espace", picture.title) : `<p class="actu-note">Aujourd'hui la NASA a publie une video : voici seulement son explication.</p>`}
      <p class="actu-text">${escapeHtml(picture.summary)}</p>
    `,
    footer: picture.translated ? "NASA, traduit automatiquement" : "NASA (texte en anglais)"
  });
}

function renderGame(game: GameHighlight, base: string): string {
  return card({
    kind: `Jeux video · ${game.genreLabel}`,
    title: game.title,
    body: `
      ${game.imageUrl ? imageTag(base, "jeux-video", game.title) : ""}
      <div class="actu-chips">
        <span class="actu-chip">${escapeHtml(game.platform)}</span>
        ${game.publisher ? `<span class="actu-chip">${escapeHtml(game.publisher)}</span>` : ""}
      </div>
      ${game.description ? `<p class="actu-text">${escapeHtml(game.description)}</p>` : ""}
    `,
    footer: "FreeToGame - jeu gratuit"
  });
}

function renderQuiz(quiz: QuizView, base: string): string {
  const answered = quiz.chosenIndex !== null;

  const options = quiz.answers
    .map((answer, index) => {
      if (!answered) {
        return `
          <form method="post" action="${base}/quiz">
            <input type="hidden" name="reponse" value="${index}" />
            <button type="submit" class="actu-answer">${escapeHtml(answer)}</button>
          </form>
        `;
      }

      const state = index === quiz.correctIndex ? "juste" : index === quiz.chosenIndex ? "faux" : "";
      return `<div class="actu-answer ${state}">${escapeHtml(answer)}</div>`;
    })
    .join("");

  const verdict = answered
    ? quiz.chosenIndex === quiz.correctIndex
      ? `<p class="actu-verdict juste">Bravo, c'etait la bonne reponse !</p>`
      : `<p class="actu-verdict faux">Rate pour aujourd'hui. La bonne reponse est en vert.</p>`
    : "";

  return card({
    kind: `Quiz · ${quiz.themeLabel}`,
    title: quiz.question,
    body: `<div class="actu-answers">${options}</div>${verdict}`,
    footer: quiz.translated ? "Open Trivia DB, traduit automatiquement" : "Open Trivia DB (en anglais)"
  });
}

function matchLine(match: FootballView["results"][number]): string {
  const score = match.played ? `${match.homeScore} - ${match.awayScore}` : "à venir";
  const date = match.date.slice(0, 10).split("-").reverse().join("/");

  return `
    <li>
      <span class="actu-match-teams">${escapeHtml(match.homeTeam)} <b>${escapeHtml(score)}</b> ${escapeHtml(match.awayTeam)}</span>
      <span class="actu-match-meta">${escapeHtml(date)} · ${escapeHtml(match.competition)}</span>
    </li>
  `;
}

function renderFootball(view: FootballView, base: string): string {
  return card({
    kind: `Foot · ${view.team.competitionName}`,
    title: view.team.teamName,
    body: `
      ${view.team.crest ? `<img class="actu-crest" src="${base}/image/foot" alt="${escapeHtml(view.team.teamName)}" loading="lazy" />` : ""}
      ${
        view.results.length
          ? `<div class="actu-label">Derniers resultats</div><ul class="actu-matches">${view.results.map(matchLine).join("")}</ul>`
          : `<p class="actu-note">Aucun resultat recent.</p>`
      }
      ${view.next ? `<div class="actu-label">Prochain match</div><ul class="actu-matches">${matchLine(view.next)}</ul>` : ""}
    `,
    footer: "football-data.org"
  });
}

export interface ActuContent {
  wikipedia?: WikipediaDay | null;
  espace?: SpacePicture | null;
  jeuxVideo?: GameHighlight | null;
  quiz?: QuizView | null;
  foot?: FootballView | null;
}

export function renderChildActu(context: ChildContext, content: ActuContent): string {
  const base = `/enfant/${context.child.slug}/actu`;

  const cards = [
    content.wikipedia ? renderWikipedia(content.wikipedia, base) : null,
    content.espace ? renderSpace(content.espace, base) : null,
    content.jeuxVideo ? renderGame(content.jeuxVideo, base) : null,
    content.quiz ? renderQuiz(content.quiz, base) : null,
    content.foot ? renderFootball(content.foot, base) : null
  ].filter((entry): entry is string => entry !== null);

  return renderChildShell({
    context,
    active: "actu",
    title: ACTU_LABEL,
    subtitle: "Un peu de curiosite pour aujourd'hui",
    headIcon: COMPASS_ICON,
    body: cards.length
      ? cards.join("")
      : `<p class="empty">Rien a montrer aujourd'hui : les sources n'ont pas repondu. Reessaie plus tard.</p>`
  });
}
