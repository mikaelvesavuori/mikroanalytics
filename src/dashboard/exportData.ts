import type { CampaignBucket, CountBucket, Report, Site, TrendOption } from "./model.js";
import { TOTAL_TRENDS } from "./model.js";
import { slugSegment } from "./format.js";

export type ExportFormat = "csv" | "ndjson";
export type ExportRecord = Record<string, unknown>;

export interface DashboardExportInput {
  exportedAt?: string;
  period: string;
  report: Report;
  selectedTrends: TrendOption[];
  site: Site;
  url: string;
}

export function buildExportRecords(input: DashboardExportInput): ExportRecord[] {
  const { period, report, selectedTrends, site, url } = input;
  const exportedAt = input.exportedAt ?? new Date().toISOString();
  const base = exportBaseRecord(site, report, exportedAt, period);
  const records: ExportRecord[] = [
    {
      ...base,
      product: "MikroAnalytics",
      selected_trends: selectedTrends.map((trend) => ({
        category: trend.category,
        id: trend.id,
        label: trend.label,
      })),
      site_domains: site.domains,
      type: "metadata",
      url,
    },
  ];

  records.push(
    ...totalExportRecords(base, report),
    ...comparisonExportRecords(base, report),
    ...dailyExportRecords(base, report),
    ...trendExportRecords(base, selectedTrends),
    ...bucketExportRecords(base, "pages", report.pages),
    ...bucketExportRecords(base, "events", report.events),
    ...bucketExportRecords(base, "referrers", report.referrers),
    ...bucketExportRecords(base, "devices", report.devices),
    ...bucketExportRecords(base, "browsers", report.browsers),
    ...campaignExportRecords(base, report.campaigns),
  );

  return records;
}

export function recordsToNdjson(records: ExportRecord[]): string {
  return `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
}

export function recordsToCsv(records: ExportRecord[]): string {
  const headers = Array.from(new Set(records.flatMap((record) => Object.keys(record))));
  return `${[
    headers.map(csvCell).join(","),
    ...records.map((record) => headers.map((header) => csvCell(record[header])).join(",")),
  ].join("\n")}\n`;
}

export function exportFilename(site: Site, report: Report, extension: string): string {
  return `mikroanalytics-${slugSegment(site.id || site.name)}-${report.range.start}-${report.range.end}.${extension}`;
}

function exportBaseRecord(
  site: Site,
  report: Report,
  exportedAt: string,
  period: string,
): ExportRecord {
  return {
    exported_at: exportedAt,
    generated_at: report.generatedAt,
    period,
    range_days: report.range.days,
    range_end: report.range.end,
    range_start: report.range.start,
    site_id: site.id,
    site_name: site.name,
  };
}

function totalExportRecords(base: ExportRecord, report: Report): ExportRecord[] {
  return Object.entries(report.totals).map(([metric, value]) => ({
    ...base,
    metric,
    type: "total",
    value,
  }));
}

function comparisonExportRecords(base: ExportRecord, report: Report): ExportRecord[] {
  return TOTAL_TRENDS.map(({ key }) => ({
    ...base,
    delta_percent: report.comparison.delta[key],
    metric: key,
    previous_value: report.comparison.previous[key],
    type: "comparison",
    value: report.totals[key],
  }));
}

function dailyExportRecords(base: ExportRecord, report: Report): ExportRecord[] {
  return report.series.flatMap((point) =>
    TOTAL_TRENDS.map(({ key }) => ({
      ...base,
      date: point.date,
      metric: key,
      type: "daily",
      value: point[key],
    })),
  );
}

function trendExportRecords(base: ExportRecord, trends: TrendOption[]): ExportRecord[] {
  return trends.flatMap((trend) =>
    trend.values.map((point) => ({
      ...base,
      date: point.date,
      trend_category: trend.category,
      trend_id: trend.id,
      trend_label: trend.label,
      type: "trend",
      value: point.count,
    })),
  );
}

function bucketExportRecords(
  base: ExportRecord,
  bucket: string,
  rows: CountBucket[],
): ExportRecord[] {
  return rows.map((row) => ({
    ...base,
    bucket,
    name: row.name,
    type: "bucket",
    value: row.count,
  }));
}

function campaignExportRecords(base: ExportRecord, rows: CampaignBucket[]): ExportRecord[] {
  return rows.map((row) => ({
    ...base,
    campaign: row.campaign,
    medium: row.medium,
    source: row.source,
    type: "campaign",
    value: row.count,
  }));
}

function csvCell(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }

  const text =
    typeof value === "string" || typeof value === "number" || typeof value === "boolean"
      ? String(value)
      : JSON.stringify(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
