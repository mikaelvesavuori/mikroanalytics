import type { Report, TrendCategory, TrendOption } from "./model.js";
import { TOTAL_TRENDS } from "./model.js";

const SELECTED_TREND_HUES = [213, 148, 356, 32, 262, 190];
const PREVIEW_TREND_HUES: Record<TrendCategory, number> = {
  browsers: 38,
  campaigns: 12,
  devices: 190,
  events: 262,
  pages: 171,
  totals: 213,
};
const PREVIEW_TREND_HUE_OFFSETS = [0, 18, -18, 36, -36, 54, -54, 72, -72, 90];

export function createTrendOptions(report: Report): TrendOption[] {
  const totalOptions = TOTAL_TRENDS.map((trend, index) => ({
    category: "totals" as const,
    color: previewTrendColor("totals", index),
    id: trend.id,
    label: trend.label,
    total: report.totals[trend.key],
    values: report.series.map((point) => ({
      count: point[trend.key],
      date: point.date,
    })),
  }));

  const dimensionOptions = report.trends.map((trend) => ({
    ...trend,
    color: "var(--accent)",
  }));

  return assignDimensionTrendColors([...totalOptions, ...dimensionOptions]);
}

export function availableSelectedTrendIds(options: TrendOption[], ids: string[]): string[] {
  const selectedSet = new Set(ids);
  return options.filter((trend) => selectedSet.has(trend.id)).map((trend) => trend.id);
}

export function selectedTrendColor(index: number): string {
  return trendColor(SELECTED_TREND_HUES[index % SELECTED_TREND_HUES.length] ?? 213);
}

function assignDimensionTrendColors(options: TrendOption[]): TrendOption[] {
  const categoryIndexes = new Map<TrendCategory, number>();
  return options.map((option) => {
    const categoryIndex = categoryIndexes.get(option.category) ?? 0;
    categoryIndexes.set(option.category, categoryIndex + 1);
    return {
      ...option,
      color: previewTrendColor(option.category, categoryIndex),
    };
  });
}

function previewTrendColor(category: TrendCategory, categoryIndex: number): string {
  const offset = PREVIEW_TREND_HUE_OFFSETS[categoryIndex % PREVIEW_TREND_HUE_OFFSETS.length] ?? 0;
  return trendColor(PREVIEW_TREND_HUES[category] + offset);
}

function trendColor(hue: number): string {
  return `hsl(${normalizeHue(hue)} var(--trend-saturation) var(--trend-lightness))`;
}

function normalizeHue(hue: number): number {
  return ((Math.round(hue) % 360) + 360) % 360;
}
