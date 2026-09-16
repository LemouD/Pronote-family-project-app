import type { ChildConfig } from "./children";
import { fontFace, FONTS } from "./fonts";
import { escapeHtml, formatSessionDate } from "./html";
import type { TutorNote } from "./homeTutoring";
import { PIN_LENGTH } from "./pinAuth";

/**
 * Page du prof de maison. Adulte exterieur a la famille : ton sobre, pas
 * l'interface enfant. Elle n'affiche ni les devoirs Pronote, ni les notes, ni
 * les prieres - seulement le prenom de l'eleve, ses matieres, et l'historique
 * des seances que le prof a lui-meme ecrites.
 */

const TUTOR_STYLE = `
  ${fontFace("IBM Plex Sans", FONTS.plexSans, "100 700")}

  :root {
    color-scheme: light dark;
    --bg: #F7F8FA; --surface: #FFFFFF; --surface-alt: #F1F2F5; --border: #E4E7EC;
    --text: #101828; --text-secondary: #667085;
    --accent: #4338CA; --accent-soft: #EEF2FF;
    --ok: #16A34A; --ok-soft: #DCFCE7;
    --error: #DC2626; --error-soft: #FEE2E2;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0B0F19; --surface: #111827; --surface-alt: #182034; --border: #1F2937;
      --text: #F3F4F6; --text-secondary: #9CA3AF;
      --accent: #818CF8; --accent-soft: #1E1B4B;
      --ok: #4ADE80; --ok-soft: #14532D;
      --error: #F87171; --error-soft: #7F1D1D;
    }
  }

  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 24px 16px 48px;
    font-family: 'IBM Plex Sans', system-ui, -apple-system, sans-serif;
    background: var(--bg); color: var(--text);
    -webkit-text-size-adjust: 100%;
  }
  .page { max-width: 620px; margin-inline: auto; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .subtitle { font-size: 13.5px; color: var(--text-secondary); margin: 0 0 22px; }

  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 16px; }
  .card h2 { font-size: 14px; margin: 0 0 14px; }

  label { display: block; font-size: 12.5px; font-weight: 600; color: var(--text-secondary); margin-bottom: 6px; }
  select, textarea, input[type="password"] {
    font: inherit; font-size: 14px; width: 100%;
    padding: 10px 12px; margin-bottom: 16px;
    border: 1px solid var(--border); border-radius: 8px;
    background: var(--surface); color: var(--text);
  }
  textarea { min-height: 96px; resize: vertical; line-height: 1.5; }
  select:focus, textarea:focus, input:focus { outline: 2px solid var(--accent); outline-offset: 1px; border-color: transparent; }

  button {
    font: inherit; font-size: 14px; font-weight: 600;
    min-height: 46px; padding: 12px 22px; width: 100%;
    background: var(--accent); color: #fff;
    border: none; border-radius: 8px; cursor: pointer;
  }

  .notice { border-radius: 8px; padding: 12px 14px; font-size: 13.5px; margin-bottom: 16px; }
  .notice-ok { background: var(--ok-soft); color: var(--ok); }
  .notice-error { background: var(--error-soft); color: var(--error); }

  .entry { border-top: 1px solid var(--border); padding: 14px 0; }
  .entry:first-of-type { border-top: none; padding-top: 0; }
  .entry-head { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; margin-bottom: 6px; }
  .entry-subject { font-weight: 600; font-size: 13px; }
  .entry-date { font-size: 12px; color: var(--text-secondary); }
  .entry-text { font-size: 13px; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; }
  .entry-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; color: var(--text-secondary); margin-top: 8px; }
  .empty { color: var(--text-secondary); font-size: 13px; font-style: italic; margin: 0; }

  .filter-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
  .filter-chip {
    display: inline-block; padding: 6px 12px; border-radius: 20px;
    border: 1px solid var(--border); background: var(--surface);
    color: var(--text-secondary); font-size: 12.5px; font-weight: 600; text-decoration: none;
  }
  .filter-chip.active { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); }

  .pin-input { letter-spacing: .4em; text-align: center; font-size: 22px; }
`;

function shell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <title>${escapeHtml(title)}</title>
  <style>${TUTOR_STYLE}</style>
</head>
<body><div class="page">${body}</div></body>
</html>`;
}

export function renderTutorLogin(child: ChildConfig, options: { error?: string } = {}): string {
  return shell(
    `Suivi de ${child.displayName}`,
    `
      <h1>Suivi de ${escapeHtml(child.displayName)}</h1>
      <p class="subtitle">Entrez le code a ${PIN_LENGTH} chiffres transmis par la famille.</p>
      ${options.error ? `<div class="notice notice-error">${escapeHtml(options.error)}</div>` : ""}
      <div class="card">
        <form method="post" action="/prof/${escapeHtml(child.tutorSlug)}/code">
          <label for="pin">Code d'acces</label>
          <input class="pin-input" type="password" id="pin" name="pin" inputmode="numeric"
                 pattern="[0-9]{${PIN_LENGTH}}" maxlength="${PIN_LENGTH}" autocomplete="off" required autofocus
                 placeholder="${"•".repeat(PIN_LENGTH)}" />
          <button type="submit">Entrer</button>
        </form>
      </div>
    `
  );
}

export function renderTutorPinMissing(child: ChildConfig): string {
  return shell(
    `Suivi de ${child.displayName}`,
    `
      <h1>Suivi de ${escapeHtml(child.displayName)}</h1>
      <p class="subtitle">Cette page n'est pas encore ouverte.</p>
      <div class="card">
        <p class="empty">Aucun code d'acces n'a ete defini pour cette page. Demandez-le a la famille.</p>
      </div>
    `
  );
}

export function renderTutorPage(
  child: ChildConfig,
  subjects: string[],
  notes: TutorNote[],
  options: { saved?: boolean; subjectFilter?: string | null } = {}
): string {
  const subjectOptions = subjects
    .map((subject) => `<option value="${escapeHtml(subject)}">${escapeHtml(subject)}</option>`)
    .join("");

  // Les seances s'accumulent : un filtre par matiere evite de derouler des
  // mois d'historique pour retrouver la derniere seance de maths.
  const filtered = options.subjectFilter ? notes.filter((note) => note.subject === options.subjectFilter) : notes;

  const filterLink = (subject: string | null, label: string) => {
    const active = (options.subjectFilter ?? null) === subject;
    const href = subject ? `?matiere=${encodeURIComponent(subject)}` : "?";
    return `<a class="filter-chip${active ? " active" : ""}" href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
  };

  const filters =
    subjects.length > 1
      ? `<div class="filter-row">${filterLink(null, "Toutes")}${subjects
          .map((subject) => filterLink(subject, subject))
          .join("")}</div>`
      : "";

  const history = filtered.length
    ? filtered
        .map(
          (note) => `
            <div class="entry">
              <div class="entry-head">
                <span class="entry-subject">${escapeHtml(note.subject)}</span>
                <span class="entry-date">${escapeHtml(formatSessionDate(note.createdAt))}</span>
              </div>
              ${note.done ? `<div class="entry-text">${escapeHtml(note.done)}</div>` : ""}
              ${
                note.difficulty
                  ? `<div class="entry-label">Difficulte</div><div class="entry-text">${escapeHtml(note.difficulty)}</div>`
                  : ""
              }
            </div>
          `
        )
        .join("")
    : `<p class="empty">Aucune seance pour ce filtre.</p>`;

  return shell(
    `Suivi de ${child.displayName}`,
    `
      <h1>Suivi de ${escapeHtml(child.displayName)}</h1>
      <p class="subtitle">Classe de ${escapeHtml(child.schoolYear)}. Notez apres chaque seance ce qui a ete travaille et ce qui a pose probleme.</p>
      ${options.saved ? `<div class="notice notice-ok">Seance enregistree. La famille preparera un exercice a partir de cette note.</div>` : ""}

      <div class="card">
        <h2>Nouvelle seance</h2>
        <form method="post" action="/prof/${escapeHtml(child.tutorSlug)}">
          <label for="subject">Matiere</label>
          <select id="subject" name="subject" required>${subjectOptions}</select>

          <label for="done">Ce qui a ete fait aujourd'hui</label>
          <textarea id="done" name="done" maxlength="1000" placeholder="Ex. : revision des fractions pendant 45 minutes."></textarea>

          <label for="difficulty">Difficultes rencontrees</label>
          <textarea id="difficulty" name="difficulty" maxlength="1000" placeholder="Ex. : confond encore l'addition et la multiplication de fractions."></textarea>

          <button type="submit">Enregistrer la seance</button>
        </form>
      </div>

      <div class="card">
        <h2>Seances precedentes</h2>
        ${filters}
        ${history}
      </div>
    `
  );
}
