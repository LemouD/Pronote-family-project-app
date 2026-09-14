import type { ChildConfig } from "./children";
import type { HomeworkItem } from "./pronote";

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
  .item-subject { font-weight: 600; font-size: 0.95rem; }
  .item-desc { font-size: 0.95rem; margin-top: 2px; white-space: pre-wrap; }
  .empty { color: #666; font-style: italic; }
  .error { background: #fde8e8; color: #8a1f1f; padding: 12px; border-radius: 8px; margin-bottom: 16px; }
  .child-block { margin-bottom: 32px; }
  .child-name { font-size: 1.1rem; font-weight: 700; margin-bottom: 8px; }
  @media (prefers-color-scheme: dark) {
    body { background: #17181a; color: #eee; }
    .item { background: #232427; box-shadow: none; }
    .subtitle { color: #999; }
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

function renderItem(item: HomeworkItem, toggleUrl: string): string {
  return `
    <label class="item ${item.done ? "done" : ""}" style="--subject-color:${safeColor(item.color)}">
      <input type="checkbox" ${item.done ? "checked" : ""} data-id="${escapeHtml(item.id)}" data-toggle-url="${escapeHtml(toggleUrl)}" />
      <span>
        <div class="item-subject">${escapeHtml(item.subject)}</div>
        <div class="item-desc">${escapeHtml(item.description || "(pas de description)")}</div>
      </span>
    </label>
  `;
}

function groupByDay(items: HomeworkItem[]): Map<string, HomeworkItem[]> {
  const groups = new Map<string, HomeworkItem[]>();
  for (const item of items) {
    const label = dayLabel(item.deadline);
    const list = groups.get(label) ?? [];
    list.push(item);
    groups.set(label, list);
  }
  return groups;
}

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

export function renderChildPage(child: ChildConfig, items: HomeworkItem[], error?: string): string {
  const groups = groupByDay(items);
  const toggleUrl = `/enfant/${child.slug}/toggle`;

  const groupsHtml = items.length
    ? [...groups.entries()]
        .map(
          ([label, groupItems]) => `
            <div class="day-group">
              <div class="day-title">${escapeHtml(label)}</div>
              ${groupItems.map((item) => renderItem(item, toggleUrl)).join("")}
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
  items: HomeworkItem[];
  error?: string;
}

export function renderParentPage(sections: ParentChildSection[]): string {
  const blocks = sections
    .map((section) => {
      const groups = groupByDay(section.items);
      const toggleUrl = `/enfant/${section.child.slug}/toggle`;
      const body = section.error
        ? `<div class="error">${escapeHtml(section.error)}</div>`
        : section.items.length
        ? [...groups.entries()]
            .map(
              ([label, groupItems]) => `
                <div class="day-group">
                  <div class="day-title">${escapeHtml(label)}</div>
                  ${groupItems.map((item) => renderItem(item, toggleUrl)).join("")}
                </div>
              `
            )
            .join("")
        : `<p class="empty">Rien a faire pour aujourd'hui/demain. 🎉</p>`;

      return `
        <div class="child-block">
          <div class="child-name">${escapeHtml(section.child.displayName)}</div>
          ${body}
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
  <p class="subtitle">Aujourd'hui / demain, pour tous les enfants.</p>
  ${blocks}
  <script>${TOGGLE_SCRIPT}</script>
</body>
</html>`;
}
