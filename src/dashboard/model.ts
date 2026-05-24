export interface Site {
  allowedEventProperties: string[];
  domains: string[];
  id: string;
  name: string;
  snippet: string;
}

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

export type TrendCategory = "browsers" | "campaigns" | "devices" | "events" | "pages" | "totals";
export type TotalTrendMetric = "events" | "pageviews" | "uniques";
export type ThemePreference = "dark" | "light";

export interface CommandAction {
  detail: string;
  id: string;
  keywords?: string;
  run: () => Promise<void> | void;
  shortcut?: string;
  title: string;
}

export interface DailyTrendPoint {
  count: number;
  date: string;
}

export interface TrendSeries {
  category: Exclude<TrendCategory, "totals">;
  id: string;
  label: string;
  total: number;
  values: DailyTrendPoint[];
}

export interface TrendOption {
  category: TrendCategory;
  color: string;
  id: string;
  label: string;
  total: number;
  values: DailyTrendPoint[];
}

export interface DateRange {
  end: string;
  start: string;
}

export interface Report {
  browsers: CountBucket[];
  campaigns: CampaignBucket[];
  comparison: {
    delta: {
      events: number | null;
      pageviews: number | null;
      uniques: number | null;
    };
    previous: {
      events: number;
      pageviews: number;
      uniques: number;
    };
  };
  devices: CountBucket[];
  events: CountBucket[];
  generatedAt: string;
  pages: CountBucket[];
  range: DateRange & { days: number };
  referrers: CountBucket[];
  series: Array<{ date: string; events: number; pageviews: number; uniques: number }>;
  totals: {
    events: number;
    pageviews: number;
    uniques: number;
  };
  trends: TrendSeries[];
}

export interface CollectAttempt {
  accepted: boolean;
  eventName: string;
  host: string;
  kind: string;
  path: string;
  reason: string;
  siteId: string;
  timestamp: string;
}

export interface RuntimeConfig {
  auth: {
    enabled: boolean;
    mode: "local" | "magic-link";
    routes: {
      logout: string;
      magicLink: string;
      me: string;
      verify: string;
    };
  };
  mode: "api";
}

export type ParsedPeriodCommand =
  | { days: number; kind: "days" }
  | { kind: "range"; range: DateRange };

export const RANGE_PERIOD_VALUE = "range";
export const DEFAULT_TREND_ID = "totals:pageviews";
export const MAX_SELECTED_TRENDS = 6;
export const PERIOD_PRESETS = [
  ["7", "7 days"],
  ["30", "30 days"],
  ["90", "90 days"],
  ["180", "180 days"],
  ["365", "1 year"],
] as const;
export const TOTAL_TRENDS: Array<{ id: string; key: TotalTrendMetric; label: string }> = [
  { id: DEFAULT_TREND_ID, key: "pageviews", label: "Pageviews" },
  { id: "totals:events", key: "events", label: "Events" },
  { id: "totals:uniques", key: "uniques", label: "Daily uniques" },
];
export const TREND_CATEGORY_LABELS: Record<TrendCategory, string> = {
  browsers: "Browsers",
  campaigns: "Campaigns",
  devices: "Devices",
  events: "Events",
  pages: "Pages",
  totals: "Totals",
};
