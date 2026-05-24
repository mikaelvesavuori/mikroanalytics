import { describe, expect, it } from "vitest";

import type { MikroAnalyticsConfig } from "../../src/core/config.js";
import { sanitizeCollectPayload, sanitizeProperties } from "../../src/core/sanitize.js";
import type { MikroAnalyticsSite } from "../../src/core/sites.js";

const config: MikroAnalyticsConfig = {
  adminToken: "secret",
  appUrl: "http://127.0.0.1:3000",
  auth: {
    allowedDomains: [],
    allowedEmails: [],
    enabled: false,
    jwtExpirySeconds: 3600,
    jwtSecret: "change-this-secret-before-enabling-auth",
    magicLinkExpirySeconds: 900,
    maxActiveSessions: 3,
    refreshTokenExpirySeconds: 604800,
  },
  databasePath: ":memory:",
  email: {
    debug: false,
    emailSubject: "Sign in to MikroAnalytics",
    host: "",
    maxRetries: 2,
    password: "",
    port: 587,
    secure: false,
    user: "",
  },
  host: "127.0.0.1",
  port: 0,
  privacy: {
    aggregateRetentionDays: 395,
    allowedSearchParams: ["utm_source"],
    blockedEventProperties: ["email", "name", "token", "user"],
    collectUniqueVisitors: false,
    geo: { countryHeader: "cf-ipcountry", enabled: true },
    honorDoNotTrack: true,
    maxEventProperties: 20,
    maxPropertyLength: 80,
    rawEventRetentionHours: 24,
    referrerPolicy: "origin",
    storeRawEvents: false,
    trustProxy: false,
    uniqueVisitorSalt: "",
  },
  staticRoot: "dist/public",
};

const site: MikroAnalyticsSite = {
  allowedEventProperties: [],
  domains: ["example.com"],
  id: "site_1",
  ingestToken: "",
  name: "Example",
};

describe("sanitizeCollectPayload", () => {
  it("stores only safe aggregate dimensions", () => {
    const result = sanitizeCollectPayload(
      config,
      site,
      {
        campaign: { utm_campaign: "Launch!", utm_medium: "email", utm_source: "newsletter" },
        path: "/pricing?email=person@example.com#section",
        properties: { email: "person@example.com", plan: "Team", seats: 12 },
        referrer: "https://google.com/search?q=mikro",
        site: "site_1",
      },
      {
        headers: new Headers({ "cf-ipcountry": "SE" }),
        originHost: "example.com",
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125.0",
      },
    );

    expect(result.ignored).toBe(false);
    if (result.ignored) return;
    expect(result.event.path).toBe("/pricing");
    expect(result.event.referrer).toBe("https://google.com");
    expect(result.event.country).toBe("SE");
    expect(result.event.browser).toBe("Chrome");
    expect(result.event.properties).toEqual({ plan: "Team", seats: 12 });
  });

  it("honors privacy signals", () => {
    const result = sanitizeCollectPayload(
      config,
      site,
      { path: "/", site: "site_1" },
      {
        headers: new Headers({ dnt: "1" }),
        originHost: "example.com",
        userAgent: "",
      },
    );

    expect(result).toEqual({ ignored: true, reason: "privacy_signal" });
  });
});

describe("sanitizeProperties", () => {
  it("honors site-level property allowlists", () => {
    const siteWithAllowlist = { ...site, allowedEventProperties: ["plan"] };

    expect(
      sanitizeProperties(
        { cta: "hero", plan: "team", user: "123" },
        siteWithAllowlist,
        config.privacy,
      ),
    ).toEqual({ plan: "team" });
  });
});
