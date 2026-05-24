import { describe, expect, it } from "vitest";
import { seedDemoData } from "../src/demoData.js";
import { MikroAnalyticsDatabase } from "../src/storage/MikroAnalyticsDatabase.js";

describe("demo data", () => {
  it("creates busy, medium, and sparse analytics cases", () => {
    const database = new MikroAnalyticsDatabase(":memory:");
    const today = new Date();

    try {
      const first = seedDemoData(database, { today });

      expect(first.sites.map((site) => site.id)).toEqual([
        "demo_busy",
        "demo_medium",
        "demo_sparse",
      ]);

      const busy = database.getReport("demo_busy", 30);
      const medium = database.getReport("demo_medium", 30);
      const sparse = database.getReport("demo_sparse", 30);

      expect(busy.totals.pageviews).toBeGreaterThan(medium.totals.pageviews);
      expect(medium.totals.pageviews).toBeGreaterThan(sparse.totals.pageviews);
      expect(sparse.totals.pageviews).toBeGreaterThan(0);
      expect(busy.totals.events).toBeGreaterThan(medium.totals.events);
      expect(busy.pages.length).toBeGreaterThan(5);
      expect(busy.events.length).toBeGreaterThan(3);
      expect(busy.campaigns.length).toBeGreaterThan(0);
      expect(busy.referrers.length).toBeGreaterThan(0);

      const busyTotals = busy.totals;
      const second = seedDemoData(database, { today });

      expect(second.rowsDeleted).toBeGreaterThan(0);
      expect(database.getReport("demo_busy", 30).totals).toEqual(busyTotals);
    } finally {
      database.close();
    }
  }, 15_000);
});
