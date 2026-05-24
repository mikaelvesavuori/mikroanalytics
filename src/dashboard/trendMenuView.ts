import { formatNumber } from "./format.js";
import type { TrendCategory, TrendOption } from "./model.js";
import { TREND_CATEGORY_LABELS } from "./model.js";

export function trendMenuResetItem(
  isDefaultSelection: boolean,
  onReset: () => void,
): HTMLButtonElement {
  const item = document.createElement("button");
  item.className = "trend-menu-reset";
  item.type = "button";
  item.disabled = isDefaultSelection;
  item.setAttribute("role", "menuitem");
  item.textContent = "Reset to Pageviews";
  item.addEventListener("click", onReset);
  return item;
}

export function trendGroupHeading(category: TrendCategory): HTMLElement {
  const heading = document.createElement("div");
  heading.className = "trend-menu-heading";
  heading.textContent = TREND_CATEGORY_LABELS[category];
  return heading;
}

export function trendMenuItem(
  trend: TrendOption,
  isSelected: boolean,
  onToggle: () => void,
): HTMLButtonElement {
  const item = document.createElement("button");
  item.className = isSelected ? "trend-menu-item active" : "trend-menu-item";
  item.type = "button";
  item.setAttribute("aria-pressed", String(isSelected));
  item.setAttribute("role", "menuitemcheckbox");

  const check = document.createElement("span");
  const label = document.createElement("span");
  const total = document.createElement("small");
  check.className = "trend-check";
  label.className = "trend-item-label";
  label.textContent = trend.label;
  total.textContent = formatNumber(trend.total);
  item.append(check, label, total);
  item.addEventListener("click", onToggle);
  return item;
}

export function trendLegendItem(trend: TrendOption): HTMLElement {
  const item = document.createElement("span");
  const swatch = document.createElement("span");
  item.className = "trend-legend-item";
  swatch.style.background = trend.color;
  item.append(swatch, document.createTextNode(trend.label));
  return item;
}
