import type { ChildConfig } from "./children";
import { renderCheck, renderChildShell } from "./childShell";
import type { DisplayItem } from "./displayItems";
import { dayLabel, escapeHtml } from "./html";
import type { PrayerView } from "./prayers";

const STAR_ICON = `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
const MOON_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>`;

export function renderChildHomework(child: ChildConfig, items: DisplayItem[], error?: string): string {
  const toggleUrl = `/enfant/${child.slug}/toggle`;

  const body = items.length
    ? items
        .map((item) =>
          renderCheck({
            id: item.id,
            toggleUrl,
            done: item.done,
            body: `
              <span class="item-body">
                <span class="item-meta">
                  <span class="tag">${escapeHtml(item.source === "pronote" ? item.subject : (item.author ?? "Tache"))}</span>
                  <span class="when">${escapeHtml(dayLabel(item.deadline))}</span>
                </span>
                <span class="item-text">${escapeHtml(item.description || "(pas de description)")}</span>
              </span>
            `
          })
        )
        .join("")
    : `<p class="empty">Rien a faire pour aujourd'hui et demain. Bravo !</p>`;

  return renderChildShell({
    child,
    active: "devoirs",
    title: `Salut ${child.displayName} !`,
    subtitle: "Voici ce qu'il te reste a faire",
    headIcon: STAR_ICON,
    body,
    error
  });
}

export function renderChildPrayers(child: ChildConfig, prayers: PrayerView[]): string {
  const toggleUrl = `/enfant/${child.slug}/prieres/toggle`;
  const done = prayers.filter((prayer) => prayer.done).length;

  const summary = `
    <div class="summary">
      <span class="summary-label">Aujourd'hui</span>
      <span class="summary-value">${done} / ${prayers.length}</span>
    </div>
  `;

  const body = prayers
    .map((prayer) =>
      renderCheck({
        id: prayer.id,
        toggleUrl,
        done: prayer.done,
        body: `
          <span class="item-body"><span class="prayer-name">${escapeHtml(prayer.label)}</span></span>
          ${prayer.time ? `<span class="prayer-time">${escapeHtml(prayer.time)}</span>` : ""}
        `
      })
    )
    .join("");

  return renderChildShell({
    child,
    active: "prieres",
    title: "Mes prieres du jour",
    subtitle: "Coche au fur et a mesure de ta journee",
    headIcon: MOON_ICON,
    beforeList: summary,
    body,
    error: undefined
  });
}
