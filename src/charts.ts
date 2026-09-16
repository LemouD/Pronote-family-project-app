import type { Series } from "./grades";
import { escapeHtml } from "./html";

/**
 * Graphiques en courbes generes cote serveur, en SVG inline. Pas de
 * bibliotheque et pas de JavaScript : la CSP reste en 'self', rien a
 * telecharger, et le graphique est deja dessine a l'affichage de la page.
 */

/** Palette lisible sur le fond clair comme sur le fond sombre de l'espace parent. */
const PALETTE = ["#6366F1", "#14B8A6", "#F87171", "#F59E0B", "#A78BFA", "#38BDF8", "#84CC16", "#F472B6"];

const WIDTH = 560;
const HEIGHT = 200;
const PAD = { top: 12, right: 14, bottom: 26, left: 32 };
/**
 * Ecart minimal affiche sur l'axe des notes. Une moyenne bouge de quelques
 * dixiemes : sur une echelle 0-20 fixe la courbe serait plate et illisible,
 * mais sans plancher la moindre variation remplirait tout le cadre et
 * ressemblerait a un effondrement. Les graduations restent chiffrees, donc
 * l'echelle reelle est toujours lisible.
 */
const MIN_SPAN = 4;

interface Bounds {
  min: number;
  max: number;
  ticks: number[];
}

function computeBounds(values: number[]): Bounds {
  let min = Math.floor(Math.min(...values) - 1);
  let max = Math.ceil(Math.max(...values) + 1);

  if (max - min < MIN_SPAN) {
    const middle = (max + min) / 2;
    min = Math.floor(middle - MIN_SPAN / 2);
    max = Math.ceil(middle + MIN_SPAN / 2);
  }

  min = Math.max(0, min);
  max = Math.min(20, Math.max(max, min + MIN_SPAN));

  const step = (max - min) / 4;
  const ticks = [0, 1, 2, 3, 4].map((index) => Math.round((min + index * step) * 10) / 10);
  return { min, max, ticks: [...new Set(ticks)] };
}

function plotWidth(): number {
  return WIDTH - PAD.left - PAD.right;
}

function yFor(value: number, bounds: Bounds): number {
  const ratio = (value - bounds.min) / (bounds.max - bounds.min);
  return HEIGHT - PAD.bottom - ratio * (HEIGHT - PAD.top - PAD.bottom);
}

function xFor(date: string, minTime: number, maxTime: number): number {
  const span = maxTime - minTime;
  // Une seule date : on centre le point plutot que de diviser par zero.
  const ratio = span === 0 ? 0.5 : (Date.parse(date) - minTime) / span;
  return PAD.left + ratio * plotWidth();
}

function formatAxisDate(date: string): string {
  return new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function round(value: number): string {
  return value.toFixed(1);
}

export function renderLineChart(series: Series[], options: { title: string }): string {
  const withPoints = series.filter((entry) => entry.points.length > 0);
  if (withPoints.length === 0) {
    return `<p class="empty">Pas encore assez de notes pour tracer une courbe.</p>`;
  }

  // Une evolution a besoin d'au moins deux points. Avec un seul, le trace est
  // un grand cadre vide avec une pastille au milieu, et une echelle inventee
  // autour d'une unique valeur : la forme promet une tendance qui n'existe
  // pas encore. On dit ce qu'on a, et la courbe apparaitra d'elle-meme.
  if (withPoints.every((entry) => entry.points.length < 2)) {
    const seules = withPoints
      .map((entry) => `${escapeHtml(entry.label)} : ${round(entry.points[0].value)} sur 20`)
      .join(" · ");
    return `<p class="empty">${seules}. Une seule note pour l'instant : la courbe apparaitra a partir de la deuxieme.</p>`;
  }

  const times = withPoints.flatMap((entry) => entry.points.map((point) => Date.parse(point.date)));
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);

  const bounds = computeBounds(withPoints.flatMap((entry) => entry.points.map((point) => point.value)));

  const grid = bounds.ticks
    .map((value) => {
      const y = yFor(value, bounds);
      return (
        `<line class="chart-grid" x1="${PAD.left}" y1="${round(y)}" x2="${WIDTH - PAD.right}" y2="${round(y)}" />` +
        `<text class="chart-label" x="${PAD.left - 6}" y="${round(y + 3)}" text-anchor="end">${escapeHtml(
          String(value).replace(".", ",")
        )}</text>`
      );
    })
    .join("");

  const firstDate = new Date(minTime).toISOString().slice(0, 10);
  const lastDate = new Date(maxTime).toISOString().slice(0, 10);
  const axisDates =
    `<text class="chart-label" x="${PAD.left}" y="${HEIGHT - 8}" text-anchor="start">${escapeHtml(formatAxisDate(firstDate))}</text>` +
    (minTime === maxTime
      ? ""
      : `<text class="chart-label" x="${WIDTH - PAD.right}" y="${HEIGHT - 8}" text-anchor="end">${escapeHtml(formatAxisDate(lastDate))}</text>`);

  const lines = withPoints
    .map((entry, index) => {
      const color = PALETTE[index % PALETTE.length];
      const coords = entry.points.map((point) => ({ x: xFor(point.date, minTime, maxTime), y: yFor(point.value, bounds) }));
      const polyline =
        coords.length > 1
          ? `<polyline fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="${coords
              .map((c) => `${round(c.x)},${round(c.y)}`)
              .join(" ")}" />`
          : "";
      const dots = coords.map((c) => `<circle cx="${round(c.x)}" cy="${round(c.y)}" r="3" fill="${color}" />`).join("");
      return polyline + dots;
    })
    .join("");

  // Une seule serie : la legende n'apprendrait rien de plus que le titre.
  const legend =
    withPoints.length > 1
      ? `<div class="chart-legend">${withPoints
          .map(
            (entry, index) =>
              `<span class="chart-legend-item"><span class="chart-swatch" style="background:${
                PALETTE[index % PALETTE.length]
              }"></span>${escapeHtml(entry.label)}</span>`
          )
          .join("")}</div>`
      : "";

  const summary = withPoints
    .map((entry) => `${entry.label} : ${round(entry.points[entry.points.length - 1].value)} sur 20`)
    .join(", ");

  return `
    <svg class="chart" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${escapeHtml(
      `${options.title}. ${summary}`
    )}">
      ${grid}
      ${axisDates}
      ${lines}
    </svg>
    ${legend}
  `;
}
