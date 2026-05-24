import { describe, expect, it } from "vitest";

import { buildDashboardUrl, readDashboardUrlState } from "../../src/dashboard/urlState.js";

describe("dashboard URL state", () => {
  it("reads site, period, selected range, and legacy metric parameters", () => {
    expect(
      readDashboardUrlState(
        "https://analytics.example.com/?site=demo&days=30&start=2026-05-01&end=2026-05-10&trend=totals%3Apageviews&metrics=browsers%3ASafari",
      ),
    ).toEqual({
      days: "30",
      range: { end: "2026-05-10", start: "2026-05-01" },
      siteId: "demo",
      trendIds: ["totals:pageviews", "browsers:Safari"],
    });
  });

  it("writes preset-period dashboard URLs and removes transient auth state", () => {
    expect(
      buildDashboardUrl(
        {
          days: "180",
          range: null,
          siteId: "demo_busy",
          trendIds: ["totals:pageviews", "events:Signup"],
        },
        "https://analytics.example.com/?token=abc&email=a%40b.test&view=sites&metrics=old&start=2026-05-01#top",
      ),
    ).toBe(
      "https://analytics.example.com/?days=180&site=demo_busy&trend=totals%3Apageviews&trend=events%3ASignup#top",
    );
  });

  it("writes selected-range dashboard URLs", () => {
    expect(
      buildDashboardUrl(
        {
          days: "30",
          range: { end: "2026-05-10", start: "2026-05-01" },
          siteId: "",
          trendIds: [],
        },
        "https://analytics.example.com/?site=demo&days=30",
      ),
    ).toBe("https://analytics.example.com/?start=2026-05-01&end=2026-05-10");
  });
});
