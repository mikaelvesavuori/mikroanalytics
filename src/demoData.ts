import type { SanitizedAnalyticsEvent } from "./core/sanitize.js";
import type { SiteInput } from "./core/sites.js";
import type { MikroAnalyticsDatabase } from "./storage/MikroAnalyticsDatabase.js";

export const DEMO_SITE_IDS = ["demo_busy", "demo_medium", "demo_sparse"] as const;

export interface DemoSeedResult {
  generatedAt: string;
  rowsDeleted: number;
  sites: DemoSiteSeedResult[];
}

export interface DemoSiteSeedResult {
  events: number;
  id: string;
  name: string;
  pageviews: number;
}

export interface SeedDemoDataOptions {
  reset?: boolean;
  today?: Date;
}

interface DemoProfile {
  activeDaysAgo?: number[];
  baseEvents: number;
  basePageviews: number;
  days: number;
  eventNames: string[];
  growth: number;
  host: string;
  name: string;
  pages: string[];
  seed: number;
  site: SiteInput & { id: string; name: string };
}

const emptyCampaign: SanitizedAnalyticsEvent["campaign"] = {
  campaign: "",
  content: "",
  medium: "",
  source: "",
  term: "",
};

const browsers = ["Chrome", "Safari", "Firefox", "Edge"];
const campaigns: SanitizedAnalyticsEvent["campaign"][] = [
  { campaign: "launch", content: "hero", medium: "email", source: "newsletter", term: "" },
  { campaign: "docs", content: "sidebar", medium: "referral", source: "github", term: "" },
  { campaign: "brand", content: "", medium: "cpc", source: "duckduckgo", term: "analytics" },
  { campaign: "comparison", content: "", medium: "organic", source: "google", term: "" },
];
const countries = ["US", "SE", "GB", "DE", "NL", "CA", "FR"];
const devices = ["Desktop", "Mobile", "Tablet"];
const oses = ["macOS", "iOS", "Windows", "Android", "Linux"];
const plans = ["free", "solo", "team", "business"];
const referrers = [
  "https://github.com",
  "https://google.com",
  "https://news.ycombinator.com",
  "https://mikaelvesavuori.se",
  "https://duckduckgo.com",
];
const sources = ["direct", "docs", "newsletter", "product", "search"];

const demoProfiles: DemoProfile[] = [
  {
    baseEvents: 5,
    basePageviews: 24,
    days: 120,
    eventNames: [
      "Signup started",
      "Trial created",
      "Checkout opened",
      "Feature used",
      "Invite sent",
      "Plan changed",
    ],
    growth: 0.45,
    host: "busy.example.test",
    name: "Demo: Busy SaaS",
    pages: [
      "/",
      "/pricing",
      "/docs",
      "/docs/install",
      "/dashboard",
      "/settings",
      "/billing",
      "/blog/private-analytics",
      "/compare/umami",
      "/compare/plausible",
    ],
    seed: 11,
    site: {
      allowedEventProperties: ["feature", "placement", "plan", "source"],
      domains: ["busy.example.test"],
      id: "demo_busy",
      name: "Demo: Busy SaaS",
    },
  },
  {
    baseEvents: 2,
    basePageviews: 8,
    days: 90,
    eventNames: ["Search", "Copy snippet", "Open guide", "Run example"],
    growth: 0.08,
    host: "docs.example.test",
    name: "Demo: Medium docs",
    pages: ["/", "/getting-started", "/tracking", "/privacy", "/deployment", "/api"],
    seed: 23,
    site: {
      allowedEventProperties: ["feature", "plan", "source"],
      domains: ["docs.example.test"],
      id: "demo_medium",
      name: "Demo: Medium docs",
    },
  },
  {
    activeDaysAgo: [2, 8, 19, 31, 55, 76, 89, 118],
    baseEvents: 1,
    basePageviews: 2,
    days: 120,
    eventNames: ["Signup started", "Contact clicked"],
    growth: 0,
    host: "launch.example.test",
    name: "Demo: Sparse launch",
    pages: ["/", "/waitlist", "/pricing"],
    seed: 37,
    site: {
      allowedEventProperties: ["feature", "source"],
      domains: ["launch.example.test"],
      id: "demo_sparse",
      name: "Demo: Sparse launch",
    },
  },
];

export function seedDemoData(
  database: MikroAnalyticsDatabase,
  options: SeedDemoDataOptions = {},
): DemoSeedResult {
  database.migrate();

  const today = startOfUtcDay(options.today ?? new Date());
  const reset = options.reset ?? true;
  const rowsDeleted = reset ? database.deleteSites([...DEMO_SITE_IDS]) : 0;
  const sites = demoProfiles.map((profile) => seedSite(database, profile, today));

  return {
    generatedAt: new Date().toISOString(),
    rowsDeleted,
    sites,
  };
}

function seedSite(
  database: MikroAnalyticsDatabase,
  profile: DemoProfile,
  today: Date,
): DemoSiteSeedResult {
  const existing = database.getSite(profile.site.id);
  if (existing) {
    database.updateSite(profile.site.id, profile.site);
  } else {
    database.createSite(profile.site);
  }

  let events = 0;
  let pageviews = 0;

  for (let daysAgo = profile.days - 1; daysAgo >= 0; daysAgo -= 1) {
    const date = dateDaysAgo(today, daysAgo);
    const counts = getDailyCounts(profile, daysAgo, date);

    for (let index = 0; index < counts.pageviews; index += 1) {
      database.recordEvent(createPageview(profile, date, daysAgo, index, counts.pageviews), {
        storeRawEvent: false,
      });
      pageviews += 1;
    }

    for (let index = 0; index < counts.events; index += 1) {
      database.recordEvent(createProductEvent(profile, date, daysAgo, index), {
        storeRawEvent: false,
      });
      events += 1;
    }
  }

  return {
    events,
    id: profile.site.id,
    name: profile.name,
    pageviews,
  };
}

function getDailyCounts(
  profile: DemoProfile,
  daysAgo: number,
  date: Date,
): { events: number; pageviews: number } {
  if (profile.activeDaysAgo && !profile.activeDaysAgo.includes(daysAgo)) {
    return { events: 0, pageviews: 0 };
  }

  if (profile.activeDaysAgo) {
    return {
      events: (daysAgo + profile.seed) % 3 === 0 ? profile.baseEvents : 0,
      pageviews: profile.basePageviews + ((daysAgo + profile.seed) % 4),
    };
  }

  const weekendFactor = [0, 6].includes(date.getUTCDay()) ? 0.68 : 1;
  const recency = 1 - daysAgo / Math.max(1, profile.days - 1);
  const growthFactor = 1 + recency * profile.growth;
  const waveFactor = 0.82 + ((daysAgo * 17 + profile.seed) % 31) / 100;
  const pageviews = Math.max(
    1,
    Math.round(profile.basePageviews * weekendFactor * growthFactor * waveFactor),
  );
  const events = Math.max(
    0,
    Math.round(profile.baseEvents * weekendFactor * growthFactor * (0.75 + waveFactor / 4)),
  );

  return { events, pageviews };
}

function createPageview(
  profile: DemoProfile,
  date: Date,
  daysAgo: number,
  index: number,
  dailyPageviews: number,
): SanitizedAnalyticsEvent {
  const path = pick(profile.pages, index + daysAgo + profile.seed);
  const uniqueCount = Math.max(1, Math.round(dailyPageviews * 0.72));

  return {
    ...createBaseEvent(profile, date, daysAgo, index, path),
    campaign: index % 7 === 0 ? pick(campaigns, index + daysAgo + profile.seed) : emptyCampaign,
    kind: "pageview",
    referrer: index % 5 === 0 ? pick(referrers, index + daysAgo) : "",
    uniqueKey: `${profile.site.id}-${date.toISOString().slice(0, 10)}-${index % uniqueCount}`,
  };
}

function createProductEvent(
  profile: DemoProfile,
  date: Date,
  daysAgo: number,
  index: number,
): SanitizedAnalyticsEvent {
  const eventName = pick(profile.eventNames, index + daysAgo + profile.seed);
  const path = pick(profile.pages, index * 3 + daysAgo + profile.seed);

  return {
    ...createBaseEvent(profile, date, daysAgo, index + 50, path),
    eventName,
    kind: "event",
    properties: {
      feature: pick(profile.eventNames, index + profile.seed)
        .toLowerCase()
        .replace(/\s+/g, "-"),
      plan: pick(plans, index + daysAgo),
      source: pick(sources, index + profile.seed),
    },
  };
}

function createBaseEvent(
  profile: DemoProfile,
  date: Date,
  daysAgo: number,
  index: number,
  path: string,
): SanitizedAnalyticsEvent {
  const timestamp = timestampFor(date, index + daysAgo + profile.seed);

  return {
    browser: pick(browsers, index + profile.seed),
    campaign: emptyCampaign,
    country: pick(countries, index + daysAgo + profile.seed),
    date: timestamp.slice(0, 10),
    device: pick(devices, index + daysAgo),
    eventName: "",
    host: profile.host,
    kind: "pageview",
    os: pick(oses, index + daysAgo + profile.seed),
    path,
    properties: {},
    referrer: "",
    siteId: profile.site.id,
    timestamp,
  };
}

function timestampFor(date: Date, seed: number): string {
  const timestamp = new Date(date);
  timestamp.setUTCHours(7 + (seed % 14), (seed * 7) % 60, (seed * 13) % 60, 0);
  return timestamp.toISOString();
}

function dateDaysAgo(today: Date, daysAgo: number): Date {
  const date = new Date(today);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date;
}

function startOfUtcDay(date: Date): Date {
  const normalized = new Date(date);
  normalized.setUTCHours(0, 0, 0, 0);
  return normalized;
}

function pick<T>(items: readonly T[], seed: number): T {
  return items[Math.abs(seed) % items.length]!;
}
