import { formatNumber, formatShortDate } from "./format.js";
import type { DailyTrendPoint, Report, TrendOption } from "./model.js";
import { TREND_CATEGORY_LABELS } from "./model.js";

export function lineTrendElement(
  series: Report["series"],
  trends: TrendOption[],
  max: number,
): HTMLElement {
  const stage = document.createElement("div");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const hitGrid = document.createElement("div");

  stage.className = "trend-lines-stage";
  svg.classList.add("trend-lines");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("viewBox", "0 0 1000 100");
  hitGrid.className = "trend-hit-grid";
  hitGrid.style.setProperty("--trend-points", String(Math.max(series.length, 1)));
  hitGrid.style.setProperty("--trend-gap", trendGap(series.length));

  for (const trend of trends) {
    const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    polyline.setAttribute("class", "trend-line");
    polyline.setAttribute("points", svgPoints(trend.values, max));
    polyline.style.stroke = trend.color;
    svg.append(polyline);

    if (series.length <= 45) {
      for (const [index, point] of trend.values.entries()) {
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        const x = trendX(index, trend.values.length);
        const y = trendY(point.count, max);
        circle.setAttribute("class", "trend-point");
        circle.setAttribute("cx", String(x));
        circle.setAttribute("cy", String(y));
        circle.setAttribute("r", "2.7");
        circle.style.fill = trend.color;
        svg.append(circle);
      }
    }
  }

  hitGrid.replaceChildren(
    ...series.map((_point, index) => {
      const hit = document.createElement("div");
      hit.className = "trend-hit";
      hit.dataset.index = String(index);
      hit.dataset.tooltip = trendTooltip(index, series, trends);
      hit.tabIndex = 0;
      hit.title = hit.dataset.tooltip;
      return hit;
    }),
  );
  stage.append(svg, hitGrid);
  return stage;
}

export function trendAxisLabel(trend: TrendOption | undefined): string {
  if (!trend) {
    return "Counts";
  }

  return trend.category === "totals" ? trend.label : TREND_CATEGORY_LABELS[trend.category];
}

export function trendGap(pointCount: number): string {
  if (pointCount > 180) return "0";
  if (pointCount > 90) return "1px";
  if (pointCount > 45) return "2px";
  return "4px";
}

function svgPoints(values: DailyTrendPoint[], max: number): string {
  return values
    .map((point, index) => `${trendX(index, values.length)},${trendY(point.count, max)}`)
    .join(" ");
}

function trendX(index: number, pointCount: number): number {
  return pointCount <= 1 ? 500 : (index / (pointCount - 1)) * 1000;
}

function trendY(value: number, max: number): number {
  return 100 - (value / max) * 92;
}

function trendTooltip(index: number, series: Report["series"], trends: TrendOption[]): string {
  const date = series[index]?.date;
  const values = trends
    .map((trend) => `${trend.label}: ${formatNumber(trend.values[index]?.count ?? 0)}`)
    .join(" · ");
  return `${date ? formatShortDate(date) : ""}: ${values}`;
}
