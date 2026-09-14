import type { ChildConfig } from "./children";
import type { DisplayItem } from "./displayItems";
import type { ParentDisplayItem } from "./parentView";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function dayLabel(deadlineISO: string): string {
  const deadline = new Date(deadlineISO);
  const today = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(deadline) - startOfDay(today)) / 86_400_000);

  if (diffDays <= 0) return "Aujourd'hui";
  if (diffDays === 1) return "Demain";
  return deadline.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

const BASE_STYLE = `
  :root { color-scheme: light dark; }
  body {
    font-family: system-ui, -apple-system, sans-serif;
    margin: 0;
    padding: 16px;
    padding-bottom: 48px;
    max-width: 640px;
    margin-inline: auto;
    background: #f7f7f8;
    color: #1a1a1a;
  }
  h1 { font-size: 1.4rem; margin-bottom: 4px; }
  .subtitle { color: #666; margin-top: 0; margin-bottom: 20px; }
  .day-group { margin-bottom: 24px; }
  .day-title { font-size: 1.05rem; font-weight: 600; margin-bottom: 8px; }
  .item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    background: white;
    border-radius: 10px;
    padding: 12px 14px;
    margin-bottom: 8px;
    box-shadow: 0 1px 2px rgba(0,0,0,0.06);
    border-left: 5px solid var(--subject-color, #999);
  }
  .item.done { opacity: 0.55; }
  .item.done .item-desc { text-decoration: line-through; }
  .item input[type="checkbox"] { width: 22px; height: 22px; margin-top: 2px; flex-shrink: 0; }
  .status-icon { font-size: 1.2rem; line-height: 1.4rem; flex-shrink: 0; }
  .item.new-change { box-shadow: 0 0 0 2px #2f6fed; }
  .new-badge {
    display: inline-block;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    color: white;
    background: #2f6fed;
    border-radius: 999px;
    padding: 1px 8px;
    vertical-align: middle;
  }
  .item-subject { font-weight: 600; font-size: 0.95rem; }
  .item-desc { font-size: 0.95rem; margin-top: 2px; white-space: pre-wrap; }
  .empty { color: #666; font-style: italic; }
  .error { background: #fde8e8; color: #8a1f1f; padding: 12px; border-radius: 8px; margin-bottom: 16px; }
  .child-block { margin-bottom: 32px; }
  .child-name { font-size: 1.1rem; font-weight: 700; margin-bottom: 8px; }
  .tag {
    display: inline-block;
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    color: white;
    border-radius: 999px;
    padding: 1px 8px;
    vertical-align: middle;
  }
  .tag-pronote { background: #2f6fed; }
  .tag-custom { background: #a855f7; }
  .add-task-form {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 10px 0 20px;
    padding: 10px;
    background: white;
    border-radius: 10px;
    box-shadow: 0 1px 2px rgba(0,0,0,0.06);
  }
  .add-task-form input[type="text"] { flex: 1 1 160px; min-width: 0; }
  .add-task-form input, .add-task-form select, .add-task-form button {
    font: inherit;
    padding: 6px 8px;
    border-radius: 6px;
    border: 1px solid #ccc;
  }
  .add-task-form button {
    background: #2f6fed;
    color: white;
    border: none;
    cursor: pointer;
  }
  .add-task-form button:disabled { opacity: 0.6; cursor: default; }
  @media (prefers-color-scheme: dark) {
    body { background: #17181a; color: #eee; }
    .item { background: #232427; box-shadow: none; }
    .subtitle { color: #999; }
    .add-task-form { background: #232427; }
    .add-task-form input, .add-task-form select { background: #17181a; color: #eee; border-color: #444; }
  }
`;

const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * item.color vient de Pronote (couleur de matiere), donc d'une source externe.
 * On la valide comme vraie couleur hex plutot que de se fier au seul echappement
 * HTML avant de l'inserer dans un attribut style, pour fermer toute injection CSS.
 */
function safeColor(color: string): string {
  return HEX_COLOR.test(color) ? color : "#999";
}

/** Badge indiquant l'origine de l'element : "Pronote", ou le prenom du parent qui a ajoute la tache. */
function renderSourceBadge(item: DisplayItem): string {
  if (item.source === "pronote") return `<span class="tag tag-pronote">Pronote</span>`;
  return `<span class="tag tag-custom">${escapeHtml(item.author ?? "")}</span>`;
}

/** Case a cocher active : utilisee sur la page enfant, ecrit dans Pronote (ou la tache perso) au clic. */
function renderEditableItem(item: DisplayItem, toggleUrl: string): string {
  return `
    <label class="item ${item.done ? "done" : ""}" style="--subject-color:${safeColor(item.color)}">
      <input type="checkbox" ${item.done ? "checked" : ""} data-id="${escapeHtml(item.id)}" data-toggle-url="${escapeHtml(toggleUrl)}" />
      <span>
        <div class="item-subject">${item.source === "pronote" ? `${escapeHtml(item.subject)} ` : ""}${renderSourceBadge(item)}</div>
        <div class="item-desc">${escapeHtml(item.description || "(pas de description)")}</div>
      </span>
    </label>
  `;
}

/**
 * Indicateur de statut en lecture seule : utilise sur la page parent. Pas
 * d'input ni d'appel au toggle endpoint, le parent consulte, il ne modifie pas
 * les devoirs Pronote (il peut en revanche ajouter des taches perso, voir le
 * formulaire dans renderParentPage). isNew surligne ce qui vient d'etre coche
 * "fait" depuis la derniere visite de /parent (voir src/parentView.ts) - pas
 * de notification push, juste visuel.
 */
function renderReadOnlyItem(item: ParentDisplayItem): string {
  return `
    <div class="item ${item.done ? "done" : ""} ${item.isNew ? "new-change" : ""}" style="--subject-color:${safeColor(item.color)}">
      <span class="status-icon" aria-hidden="true">${item.done ? "✅" : "⬜"}</span>
      <span>
        <div class="item-subject">
          ${item.source === "pronote" ? `${escapeHtml(item.subject)} ` : ""}${renderSourceBadge(item)}
          ${item.isNew ? '<span class="new-badge">nouveau</span>' : ""}
        </div>
        <div class="item-desc">${escapeHtml(item.description || "(pas de description)")}</div>
      </span>
    </div>
  `;
}

function groupByDay<T extends { deadline: string }>(items: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const label = dayLabel(item.deadline);
    const list = groups.get(label) ?? [];
    list.push(item);
    groups.set(label, list);
  }
  return groups;
}

/**
 * Ajout d'une tache perso par un parent. Le token d'acces parent (voir
 * isParentAuthorized dans index.ts) est repris depuis l'URL de la page
 * (?token=...) pour etre renvoye en header sur cet appel ; si la page a ete
 * ouverte avec le header x-parent-token uniquement (pas de query string), ce
 * formulaire n'a pas le token et l'ajout echouera - cas volontairement non
 * gere pour l'instant (voir README).
 */
const ADD_TASK_SCRIPT = `
  document.addEventListener("submit", async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.classList.contains("add-task-form")) return;
    event.preventDefault();

    const url = form.dataset.addTaskUrl;
    const description = form.elements.namedItem("description");
    const createdBy = form.elements.namedItem("createdBy");
    const day = form.elements.namedItem("day");
    if (!url || !(description instanceof HTMLInputElement) || !(createdBy instanceof HTMLInputElement) || !(day instanceof HTMLSelectElement)) return;

    const submitButton = form.querySelector('button[type="submit"]');
    const token = new URLSearchParams(location.search).get("token");

    if (submitButton instanceof HTMLButtonElement) submitButton.disabled = true;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "x-parent-token": token } : {})
        },
        body: JSON.stringify({ description: description.value, createdBy: createdBy.value, day: day.value })
      });
      if (!response.ok) throw new Error("request failed");
      location.reload();
    } catch (error) {
      alert("Impossible d'ajouter la tache, reessaie.");
      if (submitButton instanceof HTMLButtonElement) submitButton.disabled = false;
    }
  });
`;

const TOGGLE_SCRIPT = `
  document.addEventListener("change", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.type !== "checkbox") return;
    const url = target.dataset.toggleUrl;
    const id = target.dataset.id;
    if (!url || !id) return;
    const item = target.closest(".item");
    target.disabled = true;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, done: target.checked })
      });
      if (!response.ok) throw new Error("request failed");
      item?.classList.toggle("done", target.checked);
    } catch (error) {
      target.checked = !target.checked;
      alert("Impossible d'enregistrer, reessaie.");
    } finally {
      target.disabled = false;
    }
  });
`;

export function renderChildPage(child: ChildConfig, items: DisplayItem[], error?: string): string {
  const groups = groupByDay(items);
  const toggleUrl = `/enfant/${child.slug}/toggle`;

  const groupsHtml = items.length
    ? [...groups.entries()]
        .map(
          ([label, groupItems]) => `
            <div class="day-group">
              <div class="day-title">${escapeHtml(label)}</div>
              ${groupItems.map((item) => renderEditableItem(item, toggleUrl)).join("")}
            </div>
          `
        )
        .join("")
    : `<p class="empty">Rien a faire pour aujourd'hui/demain. 🎉</p>`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <title>Devoirs de ${escapeHtml(child.displayName)}</title>
  <style>${BASE_STYLE}</style>
</head>
<body>
  <h1>Devoirs de ${escapeHtml(child.displayName)}</h1>
  <p class="subtitle">Coche au fur et a mesure ce qui est fait.</p>
  ${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}
  ${groupsHtml}
  <script>${TOGGLE_SCRIPT}</script>
</body>
</html>`;
}

export interface ParentChildSection {
  child: ChildConfig;
  items: ParentDisplayItem[];
  error?: string;
}

function renderAddTaskForm(child: ChildConfig): string {
  return `
    <form class="add-task-form" data-add-task-url="/enfant/${escapeHtml(child.slug)}/tasks">
      <input type="text" name="description" placeholder="Nouvelle tache..." maxlength="300" required />
      <input type="text" name="createdBy" placeholder="Maman / Papa" maxlength="30" required list="task-authors" />
      <datalist id="task-authors"><option value="Maman"></option><option value="Papa"></option></datalist>
      <select name="day">
        <option value="today">Aujourd'hui</option>
        <option value="tomorrow">Demain</option>
      </select>
      <button type="submit">Ajouter</button>
    </form>
  `;
}

export function renderParentPage(sections: ParentChildSection[]): string {
  const blocks = sections
    .map((section) => {
      const groups = groupByDay(section.items);
      // L'erreur Pronote (le cas echeant) et les items (devoirs + taches perso, qui
      // peuvent exister meme si Pronote echoue) s'affichent tous les deux, pas l'un
      // ou l'autre - une tache perso ne doit pas disparaitre a cause d'un souci Pronote.
      const itemsHtml = section.items.length
        ? [...groups.entries()]
            .map(
              ([label, groupItems]) => `
                <div class="day-group">
                  <div class="day-title">${escapeHtml(label)}</div>
                  ${groupItems.map((item) => renderReadOnlyItem(item)).join("")}
                </div>
              `
            )
            .join("")
        : `<p class="empty">Rien a faire pour aujourd'hui/demain. 🎉</p>`;

      return `
        <div class="child-block">
          <div class="child-name">${escapeHtml(section.child.displayName)}</div>
          ${renderAddTaskForm(section.child)}
          ${section.error ? `<div class="error">${escapeHtml(section.error)}</div>` : ""}
          ${itemsHtml}
        </div>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <title>Devoirs - vue parent</title>
  <style>${BASE_STYLE}</style>
</head>
<body>
  <h1>Devoirs - vue d'ensemble</h1>
  <p class="subtitle">Aujourd'hui / demain, pour tous les enfants. Devoirs Pronote en lecture seule ; vous pouvez ajouter vos propres taches.</p>
  ${blocks}
  <script>${ADD_TASK_SCRIPT}</script>
</body>
</html>`;
}
