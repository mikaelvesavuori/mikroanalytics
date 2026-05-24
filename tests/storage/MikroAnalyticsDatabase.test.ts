import { describe, expect, it } from "vitest";
import type { SanitizedAnalyticsEvent } from "../../src/core/sanitize.js";
import { MikroAnalyticsDatabase } from "../../src/storage/MikroAnalyticsDatabase.js";

describe("MikroAnalyticsDatabase", () => {
  it("creates, lists, and updates sites", () => {
    const database = new MikroAnalyticsDatabase(":memory:");
    database.migrate();

    const site = database.createSite({
      allowedEventProperties: "plan, source",
      domains: ["https://example.com", "www.example.com"],
      id: "site_marketing",
      name: "Marketing",
    });

    expect(site).toMatchObject({
      allowedEventProperties: ["plan", "source"],
      domains: ["example.com", "www.example.com"],
      id: "site_marketing",
      name: "Marketing",
    });
    expect(database.listSites()).toHaveLength(1);

    const updated = database.updateSite("site_marketing", {
      domains: ["app.example.com"],
      name: "App",
    });

    expect(updated).toMatchObject({
      domains: ["app.example.com"],
      id: "site_marketing",
      name: "App",
    });

    database.close();
  });

  it("records aggregate pageviews, events, and daily uniques", () => {
    const database = new MikroAnalyticsDatabase(":memory:");
    database.migrate();

    const event = createEvent({ uniqueKey: "unique-1" });
    database.recordEvent(event, { storeRawEvent: false });
    database.recordEvent(event, { storeRawEvent: false });
    database.recordEvent(
      { ...event, eventName: "signup", kind: "event" },
      { storeRawEvent: false },
    );

    const report = database.getReport("site_1", 7);
    expect(report.totals.pageviews).toBe(2);
    expect(report.totals.events).toBe(1);
    expect(report.totals.uniques).toBe(1);
    expect(report.comparison.previous).toEqual({ events: 0, pageviews: 0, uniques: 0 });
    expect(report.comparison.delta.events).toBeNull();
    expect(report.pages[0]).toEqual({ count: 2, name: "/pricing" });
    expect(report.events[0]).toEqual({ count: 1, name: "signup" });
    expect(report.trends).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "pages", id: "pages:/pricing", total: 2 }),
        expect.objectContaining({ category: "events", id: "events:signup", total: 1 }),
        expect.objectContaining({ category: "browsers", id: "browsers:Chrome", total: 3 }),
        expect.objectContaining({ category: "devices", id: "devices:Desktop", total: 3 }),
        expect.objectContaining({
          category: "campaigns",
          id: "campaigns:newsletter / email / Launch",
          total: 2,
        }),
      ]),
    );
    expect(report.trends.some((trend) => String(trend.category) === "referrers")).toBe(false);

    database.close();
  });

  it("compares reports with the immediately previous period of the same length", () => {
    const database = new MikroAnalyticsDatabase(":memory:");
    database.migrate();

    for (let index = 0; index < 4; index += 1) {
      const date = dateDaysAgo(index);
      database.recordEvent(
        createEvent({
          date,
          timestamp: `${date}T12:00:00.000Z`,
          uniqueKey: `current-${index}`,
        }),
        { storeRawEvent: false },
      );
    }

    database.recordEvent(
      createEvent({
        date: dateDaysAgo(2),
        eventName: "signup",
        kind: "event",
        timestamp: `${dateDaysAgo(2)}T13:00:00.000Z`,
      }),
      { storeRawEvent: false },
    );

    for (let index = 0; index < 2; index += 1) {
      const date = dateDaysAgo(7 + index);
      database.recordEvent(
        createEvent({
          date,
          timestamp: `${date}T12:00:00.000Z`,
          uniqueKey: `previous-${index}`,
        }),
        { storeRawEvent: false },
      );
      database.recordEvent(
        createEvent({
          date,
          eventName: "signup",
          kind: "event",
          timestamp: `${date}T13:00:00.000Z`,
        }),
        { storeRawEvent: false },
      );
    }

    const report = database.getReport("site_1", 7);

    expect(report.totals).toEqual({ events: 1, pageviews: 4, uniques: 4 });
    expect(report.comparison.previous).toEqual({ events: 2, pageviews: 2, uniques: 2 });
    expect(report.comparison.delta).toEqual({ events: -50, pageviews: 100, uniques: 100 });

    database.close();
  });

  it("reports explicit inclusive date ranges", () => {
    const database = new MikroAnalyticsDatabase(":memory:");
    database.migrate();

    for (const daysAgo of [5, 4, 3]) {
      const date = dateDaysAgo(daysAgo);
      database.recordEvent(
        createEvent({
          date,
          path: `/range-${daysAgo}`,
          timestamp: `${date}T12:00:00.000Z`,
          uniqueKey: `current-${daysAgo}`,
        }),
        { storeRawEvent: false },
      );
    }

    for (const daysAgo of [8, 6]) {
      const date = dateDaysAgo(daysAgo);
      database.recordEvent(
        createEvent({
          date,
          timestamp: `${date}T12:00:00.000Z`,
          uniqueKey: `previous-${daysAgo}`,
        }),
        { storeRawEvent: false },
      );
    }

    const outsideDate = dateDaysAgo(0);
    database.recordEvent(
      createEvent({
        date: outsideDate,
        path: "/outside",
        timestamp: `${outsideDate}T12:00:00.000Z`,
        uniqueKey: "outside",
      }),
      { storeRawEvent: false },
    );

    const report = database.getReportForRange("site_1", dateDaysAgo(5), dateDaysAgo(3));

    expect(report.range).toEqual({ days: 3, end: dateDaysAgo(3), start: dateDaysAgo(5) });
    expect(report.series.map((point) => point.date)).toEqual([
      dateDaysAgo(5),
      dateDaysAgo(4),
      dateDaysAgo(3),
    ]);
    expect(report.totals).toEqual({ events: 0, pageviews: 3, uniques: 3 });
    expect(report.comparison.previous).toEqual({ events: 0, pageviews: 2, uniques: 2 });
    expect(report.pages.some((page) => page.name === "/outside")).toBe(false);
    expect(report.trends.find((trend) => trend.id === "pages:/outside")).toBeUndefined();
    expect(report.trends.find((trend) => trend.id === "pages:/range-5")?.values).toEqual([
      { count: 1, date: dateDaysAgo(5) },
      { count: 0, date: dateDaysAgo(4) },
      { count: 0, date: dateDaysAgo(3) },
    ]);

    database.close();
  });
});

function createEvent(overrides: Partial<SanitizedAnalyticsEvent> = {}): SanitizedAnalyticsEvent {
  const timestamp = new Date().toISOString();
  return {
    browser: "Chrome",
    campaign: {
      campaign: "Launch",
      content: "",
      medium: "email",
      source: "newsletter",
      term: "",
    },
    country: "",
    date: timestamp.slice(0, 10),
    device: "Desktop",
    eventName: "",
    host: "example.com",
    kind: "pageview",
    os: "macOS",
    path: "/pricing",
    properties: {},
    referrer: "https://example.org",
    siteId: "site_1",
    timestamp,
    ...overrides,
  };
}

function dateDaysAgo(daysAgo: number): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}
