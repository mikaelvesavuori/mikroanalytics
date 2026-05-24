import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { SanitizedAnalyticsEvent } from "../core/sanitize.js";
import { type MikroAnalyticsSite, normalizeSiteInput, type SiteInput } from "../core/sites.js";

export interface CountBucket {
  count: number;
  name: string;
}

export interface CampaignBucket {
  campaign: string;
  count: number;
  medium: string;
  source: string;
}

export interface DailySeriesPoint {
  date: string;
  events: number;
  pageviews: number;
  uniques: number;
}

export interface DailyTrendPoint {
  count: number;
  date: string;
}

export interface TrendSeries {
  category: "browsers" | "campaigns" | "devices" | "events" | "pages";
  id: string;
  label: string;
  total: number;
  values: DailyTrendPoint[];
}

export interface MetricTotals {
  events: number;
  pageviews: number;
  uniques: number;
}

export interface AnalyticsReport {
  browsers: CountBucket[];
  campaigns: CampaignBucket[];
  comparison: {
    delta: {
      events: number | null;
      pageviews: number | null;
      uniques: number | null;
    };
    previous: MetricTotals;
  };
  countries: CountBucket[];
  devices: CountBucket[];
  events: CountBucket[];
  generatedAt: string;
  os: CountBucket[];
  pages: CountBucket[];
  range: {
    days: number;
    end: string;
    start: string;
  };
  referrers: CountBucket[];
  series: DailySeriesPoint[];
  siteId: string;
  totals: MetricTotals;
  trends: TrendSeries[];
}

export interface CleanupResult {
  aggregateCutoffDate: string;
  aggregateRowsDeleted: number;
  rawCutoffTimestamp: string;
  rawRowsDeleted: number;
}

interface SiteRow {
  allowed_event_properties_json: string;
  domains_json: string;
  id: string;
  ingest_token: string;
  name: string;
}

const siteAggregateTables = [
  "daily_totals",
  "page_counts",
  "event_counts",
  "referrer_counts",
  "campaign_counts",
  "browser_counts",
  "os_counts",
  "device_counts",
  "country_counts",
  "daily_uniques",
] as const;

export class MikroAnalyticsDatabase {
  private readonly database: DatabaseSync;

  constructor(readonly databasePath: string) {
    if (databasePath !== ":memory:") {
      mkdirSync(dirname(databasePath), { recursive: true });
    }

    this.database = new DatabaseSync(databasePath);
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      PRAGMA synchronous = NORMAL;
      PRAGMA temp_store = MEMORY;
    `);
  }

  migrate(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS daily_totals (
        site_id TEXT NOT NULL,
        date TEXT NOT NULL,
        pageviews INTEGER NOT NULL DEFAULT 0,
        events INTEGER NOT NULL DEFAULT 0,
        uniques INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (site_id, date)
      );

      CREATE TABLE IF NOT EXISTS page_counts (
        site_id TEXT NOT NULL,
        date TEXT NOT NULL,
        path TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (site_id, date, path)
      );

      CREATE TABLE IF NOT EXISTS event_counts (
        site_id TEXT NOT NULL,
        date TEXT NOT NULL,
        event_name TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (site_id, date, event_name)
      );

      CREATE TABLE IF NOT EXISTS referrer_counts (
        site_id TEXT NOT NULL,
        date TEXT NOT NULL,
        referrer TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (site_id, date, referrer)
      );

      CREATE TABLE IF NOT EXISTS campaign_counts (
        site_id TEXT NOT NULL,
        date TEXT NOT NULL,
        source TEXT NOT NULL,
        medium TEXT NOT NULL,
        campaign TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (site_id, date, source, medium, campaign)
      );

      CREATE TABLE IF NOT EXISTS browser_counts (
        site_id TEXT NOT NULL,
        date TEXT NOT NULL,
        browser TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (site_id, date, browser)
      );

      CREATE TABLE IF NOT EXISTS os_counts (
        site_id TEXT NOT NULL,
        date TEXT NOT NULL,
        os TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (site_id, date, os)
      );

      CREATE TABLE IF NOT EXISTS device_counts (
        site_id TEXT NOT NULL,
        date TEXT NOT NULL,
        device TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (site_id, date, device)
      );

      CREATE TABLE IF NOT EXISTS country_counts (
        site_id TEXT NOT NULL,
        date TEXT NOT NULL,
        country TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (site_id, date, country)
      );

      CREATE TABLE IF NOT EXISTS daily_uniques (
        site_id TEXT NOT NULL,
        date TEXT NOT NULL,
        unique_key TEXT NOT NULL,
        PRIMARY KEY (site_id, date, unique_key)
      );

      CREATE TABLE IF NOT EXISTS raw_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        kind TEXT NOT NULL,
        path TEXT NOT NULL,
        event_name TEXT NOT NULL,
        properties_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sites (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        domains_json TEXT NOT NULL,
        allowed_event_properties_json TEXT NOT NULL,
        ingest_token TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_daily_totals_site_date ON daily_totals(site_id, date);
      CREATE INDEX IF NOT EXISTS idx_raw_events_timestamp ON raw_events(timestamp);
    `);
  }

  close(): void {
    this.database.close();
  }

  listSites(): MikroAnalyticsSite[] {
    const rows = this.database
      .prepare(
        `
          SELECT id, name, domains_json, allowed_event_properties_json, ingest_token
          FROM sites
          ORDER BY name ASC, id ASC
        `,
      )
      .all() as unknown as SiteRow[];

    return rows.map(rowToSite);
  }

  getSite(id: string): MikroAnalyticsSite | null {
    const row = this.database
      .prepare(
        `
          SELECT id, name, domains_json, allowed_event_properties_json, ingest_token
          FROM sites
          WHERE id = ?
        `,
      )
      .get(id) as SiteRow | undefined;

    return row ? rowToSite(row) : null;
  }

  createSite(input: SiteInput): MikroAnalyticsSite {
    const site = normalizeSiteInput(input);
    const timestamp = new Date().toISOString();

    this.database
      .prepare(
        `
          INSERT INTO sites (
            id,
            name,
            domains_json,
            allowed_event_properties_json,
            ingest_token,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        site.id,
        site.name,
        JSON.stringify(site.domains),
        JSON.stringify(site.allowedEventProperties),
        site.ingestToken,
        timestamp,
        timestamp,
      );

    return site;
  }

  updateSite(id: string, input: SiteInput): MikroAnalyticsSite | null {
    const existing = this.getSite(id);
    if (!existing) {
      return null;
    }

    const site = normalizeSiteInput({
      ...existing,
      ...input,
      id,
    });

    this.database
      .prepare(
        `
          UPDATE sites
          SET
            name = ?,
            domains_json = ?,
            allowed_event_properties_json = ?,
            ingest_token = ?,
            updated_at = ?
          WHERE id = ?
        `,
      )
      .run(
        site.name,
        JSON.stringify(site.domains),
        JSON.stringify(site.allowedEventProperties),
        site.ingestToken,
        new Date().toISOString(),
        id,
      );

    return site;
  }

  deleteSites(ids: string[]): number {
    const siteIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
    if (siteIds.length === 0) {
      return 0;
    }

    const placeholders = siteIds.map(() => "?").join(", ");
    let rowsDeleted = 0;

    this.database.exec("BEGIN IMMEDIATE TRANSACTION");
    try {
      for (const table of siteAggregateTables) {
        const result = this.database
          .prepare(`DELETE FROM ${table} WHERE site_id IN (${placeholders})`)
          .run(...siteIds);
        rowsDeleted += Number(result.changes ?? 0);
      }

      const rawResult = this.database
        .prepare(`DELETE FROM raw_events WHERE site_id IN (${placeholders})`)
        .run(...siteIds);
      rowsDeleted += Number(rawResult.changes ?? 0);

      const siteResult = this.database
        .prepare(`DELETE FROM sites WHERE id IN (${placeholders})`)
        .run(...siteIds);
      rowsDeleted += Number(siteResult.changes ?? 0);

      this.database.exec("COMMIT");
      return rowsDeleted;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  recordEvent(event: SanitizedAnalyticsEvent, options: { storeRawEvent: boolean }): void {
    this.database.exec("BEGIN IMMEDIATE TRANSACTION");
    try {
      this.incrementDailyTotal(event);

      if (event.kind === "pageview") {
        this.incrementDimension("page_counts", ["path"], [event.path], event);
        if (event.referrer) {
          this.incrementDimension("referrer_counts", ["referrer"], [event.referrer], event);
        }
        if (event.campaign.source || event.campaign.medium || event.campaign.campaign) {
          this.incrementDimension(
            "campaign_counts",
            ["source", "medium", "campaign"],
            [event.campaign.source, event.campaign.medium, event.campaign.campaign],
            event,
          );
        }
      } else if (event.eventName) {
        this.incrementDimension("event_counts", ["event_name"], [event.eventName], event);
      }

      this.incrementDimension("browser_counts", ["browser"], [event.browser], event);
      this.incrementDimension("os_counts", ["os"], [event.os], event);
      this.incrementDimension("device_counts", ["device"], [event.device], event);

      if (event.country) {
        this.incrementDimension("country_counts", ["country"], [event.country], event);
      }

      if (event.kind === "pageview" && event.uniqueKey) {
        this.recordDailyUnique(event);
      }

      if (options.storeRawEvent) {
        this.insertRawEvent(event);
      }

      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  getReport(siteId: string, days: number): AnalyticsReport {
    const normalizedDays = Math.max(1, Math.min(730, Math.floor(days)));
    const startDate = dateDaysAgo(normalizedDays - 1);
    const endDate = dateDaysAgo(0);
    return this.getReportForRange(siteId, startDate, endDate);
  }

  getReportForRange(siteId: string, startDate: string, endDate: string): AnalyticsReport {
    const range = normalizeReportRange(startDate, endDate);
    const previousStartDate = addDays(range.start, -range.days);
    const previousEndDate = addDays(range.start, -1);

    const rows = this.database
      .prepare(
        `
          SELECT date, pageviews, events, uniques
          FROM daily_totals
          WHERE site_id = ? AND date >= ? AND date <= ?
          ORDER BY date ASC
        `,
      )
      .all(siteId, range.start, range.end) as unknown as DailySeriesPoint[];

    const byDate = new Map(rows.map((row) => [row.date, row]));
    const series = Array.from({ length: range.days }, (_item, index) => {
      const date = addDays(range.start, index);
      return byDate.get(date) ?? { date, events: 0, pageviews: 0, uniques: 0 };
    });
    const totals = series.reduce(
      (sum, point) => ({
        events: sum.events + point.events,
        pageviews: sum.pageviews + point.pageviews,
        uniques: sum.uniques + point.uniques,
      }),
      { events: 0, pageviews: 0, uniques: 0 },
    );
    const previous = this.getTotals(siteId, previousStartDate, previousEndDate);

    const browsers = this.getTopCounts("browser_counts", "browser", siteId, range.start, range.end);
    const campaigns = this.getTopCampaigns(siteId, range.start, range.end);
    const devices = this.getTopCounts("device_counts", "device", siteId, range.start, range.end);
    const events = this.getTopCounts("event_counts", "event_name", siteId, range.start, range.end);
    const pages = this.getTopCounts("page_counts", "path", siteId, range.start, range.end);

    return {
      browsers,
      campaigns,
      comparison: {
        delta: {
          events: percentChange(totals.events, previous.events),
          pageviews: percentChange(totals.pageviews, previous.pageviews),
          uniques: percentChange(totals.uniques, previous.uniques),
        },
        previous,
      },
      countries: this.getTopCounts("country_counts", "country", siteId, range.start, range.end),
      devices,
      events,
      generatedAt: new Date().toISOString(),
      os: this.getTopCounts("os_counts", "os", siteId, range.start, range.end),
      pages,
      range,
      referrers: this.getTopCounts("referrer_counts", "referrer", siteId, range.start, range.end),
      series,
      siteId,
      totals,
      trends: [
        ...this.getCountTrends({
          category: "pages",
          dates: series.map((point) => point.date),
          labelColumn: "path",
          siteId,
          table: "page_counts",
          topBuckets: pages,
        }),
        ...this.getCountTrends({
          category: "events",
          dates: series.map((point) => point.date),
          labelColumn: "event_name",
          siteId,
          table: "event_counts",
          topBuckets: events,
        }),
        ...this.getCountTrends({
          category: "browsers",
          dates: series.map((point) => point.date),
          labelColumn: "browser",
          siteId,
          table: "browser_counts",
          topBuckets: browsers,
        }),
        ...this.getCountTrends({
          category: "devices",
          dates: series.map((point) => point.date),
          labelColumn: "device",
          siteId,
          table: "device_counts",
          topBuckets: devices,
        }),
        ...this.getCampaignTrends(
          siteId,
          series.map((point) => point.date),
          campaigns,
        ),
      ],
    };
  }

  cleanup(input: {
    aggregateRetentionDays: number;
    rawEventRetentionHours: number;
  }): CleanupResult {
    const aggregateCutoffDate = dateDaysAgo(input.aggregateRetentionDays);
    const rawCutoffTimestamp = new Date(
      Date.now() - input.rawEventRetentionHours * 60 * 60 * 1000,
    ).toISOString();

    let aggregateRowsDeleted = 0;
    this.database.exec("BEGIN IMMEDIATE TRANSACTION");
    try {
      for (const table of siteAggregateTables) {
        const result = this.database
          .prepare(`DELETE FROM ${table} WHERE date < ?`)
          .run(aggregateCutoffDate);
        aggregateRowsDeleted += Number(result.changes ?? 0);
      }

      const rawResult = this.database
        .prepare("DELETE FROM raw_events WHERE timestamp < ?")
        .run(rawCutoffTimestamp);
      this.database.exec("COMMIT");

      return {
        aggregateCutoffDate,
        aggregateRowsDeleted,
        rawCutoffTimestamp,
        rawRowsDeleted: Number(rawResult.changes ?? 0),
      };
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  private incrementDailyTotal(event: SanitizedAnalyticsEvent): void {
    this.database
      .prepare(
        `
          INSERT INTO daily_totals (site_id, date, pageviews, events, uniques)
          VALUES (?, ?, ?, ?, 0)
          ON CONFLICT(site_id, date) DO UPDATE SET
            pageviews = pageviews + excluded.pageviews,
            events = events + excluded.events
        `,
      )
      .run(
        event.siteId,
        event.date,
        event.kind === "pageview" ? 1 : 0,
        event.kind === "event" ? 1 : 0,
      );
  }

  private incrementDimension(
    table: string,
    columns: string[],
    values: string[],
    event: SanitizedAnalyticsEvent,
  ): void {
    const columnSql = columns.join(", ");
    const placeholders = columns.map(() => "?").join(", ");
    const updateSql = columns.map((column) => `${column} = excluded.${column}`).join(", ");

    this.database
      .prepare(
        `
          INSERT INTO ${table} (site_id, date, ${columnSql}, count)
          VALUES (?, ?, ${placeholders}, 1)
          ON CONFLICT(site_id, date, ${columnSql}) DO UPDATE SET
            ${updateSql},
            count = count + 1
        `,
      )
      .run(event.siteId, event.date, ...values);
  }

  private recordDailyUnique(event: SanitizedAnalyticsEvent): void {
    const result = this.database
      .prepare("INSERT OR IGNORE INTO daily_uniques (site_id, date, unique_key) VALUES (?, ?, ?)")
      .run(event.siteId, event.date, event.uniqueKey ?? "");

    if (Number(result.changes ?? 0) > 0) {
      this.database
        .prepare(
          `
            UPDATE daily_totals
            SET uniques = uniques + 1
            WHERE site_id = ? AND date = ?
          `,
        )
        .run(event.siteId, event.date);
    }
  }

  private insertRawEvent(event: SanitizedAnalyticsEvent): void {
    this.database
      .prepare(
        `
          INSERT INTO raw_events (site_id, timestamp, kind, path, event_name, properties_json)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        event.siteId,
        event.timestamp,
        event.kind,
        event.path,
        event.eventName,
        JSON.stringify(event.properties),
      );
  }

  private getTopCounts(
    table: string,
    labelColumn: string,
    siteId: string,
    startDate: string,
    endDate: string,
  ): CountBucket[] {
    return this.database
      .prepare(
        `
          SELECT ${labelColumn} AS name, SUM(count) AS count
          FROM ${table}
          WHERE site_id = ? AND date >= ? AND date <= ?
          GROUP BY ${labelColumn}
          ORDER BY count DESC, name ASC
          LIMIT 20
        `,
      )
      .all(siteId, startDate, endDate) as unknown as CountBucket[];
  }

  private getTopCampaigns(siteId: string, startDate: string, endDate: string): CampaignBucket[] {
    return this.database
      .prepare(
        `
          SELECT source, medium, campaign, SUM(count) AS count
          FROM campaign_counts
          WHERE site_id = ? AND date >= ? AND date <= ?
          GROUP BY source, medium, campaign
          ORDER BY count DESC, source ASC
          LIMIT 20
        `,
      )
      .all(siteId, startDate, endDate) as unknown as CampaignBucket[];
  }

  private getTotals(siteId: string, startDate: string, endDate: string): MetricTotals {
    const row = this.database
      .prepare(
        `
          SELECT
            COALESCE(SUM(pageviews), 0) AS pageviews,
            COALESCE(SUM(events), 0) AS events,
            COALESCE(SUM(uniques), 0) AS uniques
          FROM daily_totals
          WHERE site_id = ? AND date >= ? AND date <= ?
        `,
      )
      .get(siteId, startDate, endDate) as MetricTotals | undefined;

    return row ?? { events: 0, pageviews: 0, uniques: 0 };
  }

  private getCountTrends(input: {
    category: TrendSeries["category"];
    dates: string[];
    labelColumn: string;
    siteId: string;
    table: string;
    topBuckets: CountBucket[];
  }): TrendSeries[] {
    const selectedBuckets = input.topBuckets.slice(0, 10);
    if (!selectedBuckets.length || !input.dates.length) {
      return [];
    }

    return selectedBuckets.map((bucket) => {
      const rows = this.database
        .prepare(
          `
            SELECT date, count
            FROM ${input.table}
            WHERE site_id = ? AND ${input.labelColumn} = ? AND date >= ? AND date <= ?
            ORDER BY date ASC
          `,
        )
        .all(
          input.siteId,
          bucket.name,
          input.dates[0] ?? "",
          input.dates.at(-1) ?? "",
        ) as unknown as DailyTrendPoint[];

      return {
        category: input.category,
        id: trendId(input.category, bucket.name),
        label: bucket.name,
        total: bucket.count,
        values: fillTrendValues(input.dates, rows),
      };
    });
  }

  private getCampaignTrends(
    siteId: string,
    dates: string[],
    topCampaigns: CampaignBucket[],
  ): TrendSeries[] {
    const selectedCampaigns = topCampaigns.slice(0, 10);
    if (!selectedCampaigns.length || !dates.length) {
      return [];
    }

    return selectedCampaigns.map((campaign) => {
      const rows = this.database
        .prepare(
          `
            SELECT date, count
            FROM campaign_counts
            WHERE site_id = ?
              AND source = ?
              AND medium = ?
              AND campaign = ?
              AND date >= ?
              AND date <= ?
            ORDER BY date ASC
          `,
        )
        .all(
          siteId,
          campaign.source,
          campaign.medium,
          campaign.campaign,
          dates[0] ?? "",
          dates.at(-1) ?? "",
        ) as unknown as DailyTrendPoint[];
      const label = campaignLabel(campaign);

      return {
        category: "campaigns",
        id: trendId("campaigns", label),
        label,
        total: campaign.count,
        values: fillTrendValues(dates, rows),
      };
    });
  }
}

function rowToSite(row: SiteRow): MikroAnalyticsSite {
  return {
    allowedEventProperties: parseJsonStringArray(row.allowed_event_properties_json),
    domains: parseJsonStringArray(row.domains_json),
    id: row.id,
    ingestToken: row.ingest_token,
    name: row.name,
  };
}

function parseJsonStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }

  return Math.round(((current - previous) / previous) * 100);
}

function dateDaysAgo(daysAgo: number): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function normalizeReportRange(startDate: string, endDate: string) {
  let start = parseDateInput(startDate) ?? dateDaysAgo(29);
  let end = parseDateInput(endDate) ?? dateDaysAgo(0);

  if (start > end) {
    [start, end] = [end, start];
  }

  const days = Math.min(730, dateDiffDays(start, end) + 1);
  if (days < dateDiffDays(start, end) + 1) {
    start = addDays(end, -(days - 1));
  }

  return { days, end, start };
}

function parseDateInput(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dateDiffDays(start: string, end: string): number {
  const startTime = new Date(`${start}T00:00:00.000Z`).getTime();
  const endTime = new Date(`${end}T00:00:00.000Z`).getTime();
  return Math.round((endTime - startTime) / 86_400_000);
}

function fillTrendValues(dates: string[], rows: DailyTrendPoint[]): DailyTrendPoint[] {
  const countsByDate = new Map(rows.map((row) => [row.date, row.count]));
  return dates.map((date) => ({ count: countsByDate.get(date) ?? 0, date }));
}

function campaignLabel(campaign: CampaignBucket): string {
  return [campaign.source, campaign.medium, campaign.campaign].filter(Boolean).join(" / ");
}

function trendId(category: TrendSeries["category"], label: string): string {
  return `${category}:${label}`;
}
