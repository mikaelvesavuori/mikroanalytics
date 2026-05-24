import { describe, expect, it } from "vitest";

import type { Report } from "../../src/dashboard/model.js";
import {
  availableSelectedTrendIds,
  createTrendOptions,
  selectedTrendColor,
} from "../../src/dashboard/trendOptions.js";

describe("dashboard trend options", () => {
  it("creates total and dimension trend options with deterministic colors", () => {
    const options = createTrendOptions(report);

    expect(options.slice(0, 3)).toMatchObject([
      {
        category: "totals",
        color: "hsl(213 var(--trend-saturation) var(--trend-lightness))",
        id: "totals:pageviews",
        label: "Pageviews",
        total: 12,
      },
      {
        category: "totals",
        color: "hsl(231 var(--trend-saturation) var(--trend-lightness))",
        id: "totals:events",
        label: "Events",
        total: 2,
      },
      {
        category: "totals",
        color: "hsl(195 var(--trend-saturation) var(--trend-lightness))",
        id: "totals:uniques",
        label: "Daily uniques",
        total: 8,
      },
    ]);
    expect(options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "browsers",
          color: "hsl(38 var(--trend-saturation) var(--trend-lightness))",
          id: "browsers:Safari",
        }),
        expect.objectContaining({
          category: "browsers",
          color: "hsl(56 var(--trend-saturation) var(--trend-lightness))",
          id: "browsers:Chrome",
        }),
      ]),
    );
  });

  it("keeps selected trend ids that are still available in option order", () => {
    const options = createTrendOptions(report);

    expect(
      availableSelectedTrendIds(options, ["browsers:Chrome", "missing", "totals:pageviews"]),
    ).toEqual(["totals:pageviews", "browsers:Chrome"]);
  });

  it("uses a readable selected trend color cycle", () => {
    expect(selectedTrendColor(0)).toBe("hsl(213 var(--trend-saturation) var(--trend-lightness))");
    expect(selectedTrendColor(1)).toBe("hsl(148 var(--trend-saturation) var(--trend-lightness))");
    expect(selectedTrendColor(6)).toBe("hsl(213 var(--trend-saturation) var(--trend-lightness))");
  });
});

const report: Report = {
  browsers: [],
  campaigns: [],
  comparison: {
    delta: { events: null, pageviews: null, uniques: null },
    previous: { events: 0, pageviews: 0, uniques: 0 },
  },
  devices: [],
  events: [],
  generatedAt: "2026-05-22T07:59:00.000Z",
  pages: [],
  range: { days: 2, end: "2026-05-22", start: "2026-05-21" },
  referrers: [],
  series: [
    { date: "2026-05-21", events: 1, pageviews: 4, uniques: 3 },
    { date: "2026-05-22", events: 1, pageviews: 8, uniques: 5 },
  ],
  totals: { events: 2, pageviews: 12, uniques: 8 },
  trends: [
    {
      category: "browsers",
      id: "browsers:Safari",
      label: "Safari",
      total: 7,
      values: [
        { count: 3, date: "2026-05-21" },
        { count: 4, date: "2026-05-22" },
      ],
    },
    {
      category: "browsers",
      id: "browsers:Chrome",
      label: "Chrome",
      total: 5,
      values: [
        { count: 1, date: "2026-05-21" },
        { count: 4, date: "2026-05-22" },
      ],
    },
  ],
};
