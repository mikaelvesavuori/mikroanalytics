import { describe, expect, it } from "vitest";

import {
  buildExportRecords,
  exportFilename,
  recordsToCsv,
  recordsToNdjson,
} from "../../src/dashboard/exportData.js";
import type { Report, Site, TrendOption } from "../../src/dashboard/model.js";

describe("dashboard export data", () => {
  it("exports the current dashboard view as structured records", () => {
    const records = buildExportRecords({
      exportedAt: "2026-05-22T08:00:00.000Z",
      period: "30 days",
      report,
      selectedTrends,
      site,
      url: "https://analytics.example.com/?site=site_demo&days=30&trend=totals%3Apageviews",
    });

    expect(records[0]).toMatchObject({
      exported_at: "2026-05-22T08:00:00.000Z",
      period: "30 days",
      product: "MikroAnalytics",
      range_end: "2026-05-22",
      range_start: "2026-05-21",
      site_id: "site_demo",
      type: "metadata",
    });
    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metric: "pageviews", type: "total", value: 12 }),
        expect.objectContaining({
          delta_percent: 100,
          metric: "pageviews",
          previous_value: 6,
          type: "comparison",
        }),
        expect.objectContaining({
          date: "2026-05-21",
          metric: "events",
          type: "daily",
          value: 1,
        }),
        expect.objectContaining({
          date: "2026-05-22",
          trend_id: "totals:pageviews",
          type: "trend",
          value: 8,
        }),
        expect.objectContaining({ bucket: "pages", name: "/pricing", type: "bucket", value: 7 }),
        expect.objectContaining({
          campaign: "Launch, phase 1",
          medium: "email",
          source: "newsletter",
          type: "campaign",
        }),
      ]),
    );
  });

  it("serializes records to newline-delimited JSON", () => {
    const records = buildExportRecords({
      exportedAt: "2026-05-22T08:00:00.000Z",
      period: "selected_range",
      report,
      selectedTrends,
      site,
      url: "https://analytics.example.com/?site=site_demo&start=2026-05-21&end=2026-05-22",
    });

    const lines = recordsToNdjson(records).trimEnd().split("\n");

    expect(lines).toHaveLength(records.length);
    expect(JSON.parse(lines[0] ?? "{}")).toMatchObject({
      period: "selected_range",
      site_id: "site_demo",
      type: "metadata",
    });
  });

  it("serializes records to CSV with escaped object and comma values", () => {
    const csv = recordsToCsv(
      buildExportRecords({
        exportedAt: "2026-05-22T08:00:00.000Z",
        period: "30 days",
        report,
        selectedTrends,
        site,
        url: "https://analytics.example.com/?site=site_demo&days=30",
      }),
    );

    expect(csv).toContain("exported_at,generated_at,period");
    expect(csv).toContain('"Launch, phase 1"');
    expect(csv).toContain(
      '"[{""category"":""totals"",""id"":""totals:pageviews"",""label"":""Pageviews""}]"',
    );
  });

  it("creates stable export filenames", () => {
    expect(exportFilename(site, report, "csv")).toBe(
      "mikroanalytics-site_demo-2026-05-21-2026-05-22.csv",
    );
  });
});

const site: Site = {
  allowedEventProperties: ["plan"],
  domains: ["example.com"],
  id: "site_demo",
  name: "Demo site",
  snippet: "<script></script>",
};

const report: Report = {
  browsers: [{ count: 12, name: "Safari" }],
  campaigns: [{ campaign: "Launch, phase 1", count: 4, medium: "email", source: "newsletter" }],
  comparison: {
    delta: { events: -50, pageviews: 100, uniques: null },
    previous: { events: 4, pageviews: 6, uniques: 0 },
  },
  devices: [{ count: 12, name: "Desktop" }],
  events: [{ count: 2, name: "signup" }],
  generatedAt: "2026-05-22T07:59:00.000Z",
  pages: [{ count: 7, name: "/pricing" }],
  range: { days: 2, end: "2026-05-22", start: "2026-05-21" },
  referrers: [{ count: 3, name: "https://example.org" }],
  series: [
    { date: "2026-05-21", events: 1, pageviews: 4, uniques: 3 },
    { date: "2026-05-22", events: 1, pageviews: 8, uniques: 5 },
  ],
  totals: { events: 2, pageviews: 12, uniques: 8 },
  trends: [],
};

const selectedTrends: TrendOption[] = [
  {
    category: "totals",
    color: "blue",
    id: "totals:pageviews",
    label: "Pageviews",
    total: 12,
    values: [
      { count: 4, date: "2026-05-21" },
      { count: 8, date: "2026-05-22" },
    ],
  },
];
