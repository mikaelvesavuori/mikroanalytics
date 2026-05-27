import { describe, expect, it } from "vitest";

import { MikroAnalyticsAuth } from "../../src/auth/MikroAnalyticsAuth.js";
import type { MikroAnalyticsConfig } from "../../src/core/config.js";
import { AppServer } from "../../src/server/AppServer.js";
import { MikroAnalyticsDatabase } from "../../src/storage/MikroAnalyticsDatabase.js";

describe("AppServer", () => {
  it("collects events and protects reports", async () => {
    const database = new MikroAnalyticsDatabase(":memory:");
    database.migrate();
    createSite(database);
    const config = createConfig();
    const auth = new MikroAnalyticsAuth(config);
    const server = new AppServer({ auth, config, database });
    await server.start();

    try {
      const baseUrl = server.getBaseUrl();
      const collectResponse = await fetch(`${baseUrl}/api/collect`, {
        body: JSON.stringify({
          event: "signup",
          host: "example.com",
          kind: "event",
          path: "/",
          site: "site_1",
        }),
        headers: {
          "Content-Type": "application/json",
          Origin: "https://example.com",
          "User-Agent": "Mozilla/5.0 Chrome/125.0",
        },
        method: "POST",
      });

      expect(collectResponse.status).toBe(202);
      expect(collectResponse.headers.get("access-control-allow-origin")).toBe(
        "https://example.com",
      );
      expect(collectResponse.headers.get("access-control-allow-credentials")).toBe("true");
      await expect(fetch(`${baseUrl}/api/report?site=site_1`)).resolves.toHaveProperty(
        "status",
        401,
      );

      const runtimeConfigResponse = await fetch(`${baseUrl}/config.json`);
      expect(runtimeConfigResponse.status).toBe(200);
      await expect(runtimeConfigResponse.json()).resolves.toMatchObject({
        auth: {
          enabled: true,
          mode: "magic-link",
          routes: {
            logout: "/api/auth/logout",
            magicLink: "/api/auth/magic-link",
            me: "/api/auth/me",
            verify: "/api/auth/verify",
          },
        },
        mode: "api",
      });

      const reportResponse = await fetch(`${baseUrl}/api/report?site=site_1`, {
        headers: { Authorization: "Bearer secret" },
      });
      const report = await reportResponse.json();
      expect(report.totals.events).toBe(1);

      const attemptsResponse = await fetch(`${baseUrl}/api/collect-attempts?site=site_1`, {
        headers: { Authorization: "Bearer secret" },
      });
      await expect(attemptsResponse.json()).resolves.toMatchObject({
        attempts: [
          {
            accepted: true,
            eventName: "signup",
            host: "example.com",
            kind: "event",
            path: "/",
            reason: "accepted",
            siteId: "site_1",
          },
        ],
      });
    } finally {
      await server.stop();
      auth.close();
      database.close();
    }
  });

  it("returns opaque auth responses for magic-link requests", async () => {
    const database = new MikroAnalyticsDatabase(":memory:");
    database.migrate();
    const config = createConfig();
    const auth = new MikroAnalyticsAuth(config);
    const server = new AppServer({ auth, config, database });
    await server.start();

    try {
      const baseUrl = server.getBaseUrl();
      const deniedResponse = await fetch(`${baseUrl}/api/auth/magic-link`, {
        body: JSON.stringify({ email: "other@example.com" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      await expect(deniedResponse.json()).resolves.toEqual({
        message: "If this email can sign in, you will receive a link shortly.",
      });
      expect(deniedResponse.status).toBe(202);

      const allowedResponse = await fetch(`${baseUrl}/api/auth/magic-link`, {
        body: JSON.stringify({ email: "admin@example.com" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      await expect(allowedResponse.json()).resolves.toEqual({
        message: "If this email can sign in, you will receive a link shortly.",
      });
      expect(allowedResponse.status).toBe(202);
    } finally {
      await server.stop();
      auth.close();
      database.close();
    }
  });

  it("manages sites through the authenticated API", async () => {
    const database = new MikroAnalyticsDatabase(":memory:");
    database.migrate();
    const config = createConfig({ authEnabled: false });
    const auth = new MikroAnalyticsAuth(config);
    const server = new AppServer({ auth, config, database });
    await server.start();

    try {
      const baseUrl = server.getBaseUrl();
      const createResponse = await fetch(`${baseUrl}/api/sites`, {
        body: JSON.stringify({
          domains: ["https://example.com", "app.example.com"],
          id: "site_marketing",
          name: "Marketing",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      expect(createResponse.status).toBe(201);
      await expect(createResponse.json()).resolves.toMatchObject({
        site: {
          domains: ["example.com", "app.example.com"],
          id: "site_marketing",
          name: "Marketing",
        },
      });

      const updateResponse = await fetch(`${baseUrl}/api/sites/site_marketing`, {
        body: JSON.stringify({
          allowedEventProperties: ["plan"],
          domains: ["example.com", "www.example.com"],
          name: "Marketing site",
        }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });

      expect(updateResponse.status).toBe(200);
      await expect(updateResponse.json()).resolves.toMatchObject({
        site: {
          allowedEventProperties: ["plan"],
          domains: ["example.com", "www.example.com"],
          id: "site_marketing",
          name: "Marketing site",
        },
      });

      const collectResponse = await fetch(`${baseUrl}/api/collect`, {
        body: JSON.stringify({
          host: "example.com",
          kind: "pageview",
          path: "/pricing",
          site: "site_marketing",
        }),
        headers: {
          "Content-Type": "application/json",
          Origin: "https://example.com",
          "User-Agent": "Mozilla/5.0 Chrome/125.0",
        },
        method: "POST",
      });
      expect(collectResponse.status).toBe(202);

      const deleteResponse = await fetch(`${baseUrl}/api/sites/site_marketing`, {
        method: "DELETE",
      });
      expect(deleteResponse.status).toBe(200);
      await expect(deleteResponse.json()).resolves.toMatchObject({
        id: "site_marketing",
      });

      const listResponse = await fetch(`${baseUrl}/api/sites`);
      await expect(listResponse.json()).resolves.toMatchObject({ sites: [] });

      const reportResponse = await fetch(`${baseUrl}/api/report?site=site_marketing`);
      const report = await reportResponse.json();
      expect(report.totals).toEqual({ events: 0, pageviews: 0, uniques: 0 });

      const missingDeleteResponse = await fetch(`${baseUrl}/api/sites/site_marketing`, {
        method: "DELETE",
      });
      expect(missingDeleteResponse.status).toBe(404);
    } finally {
      await server.stop();
      auth.close();
      database.close();
    }
  });

  it("does not pretend to send email in local auth-disabled mode", async () => {
    const database = new MikroAnalyticsDatabase(":memory:");
    database.migrate();
    const config = createConfig({ authEnabled: false });
    const auth = new MikroAnalyticsAuth(config);
    const server = new AppServer({ auth, config, database });
    await server.start();

    try {
      const response = await fetch(`${server.getBaseUrl()}/api/auth/magic-link`, {
        body: JSON.stringify({ email: "admin@example.com" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      await expect(response.json()).resolves.toEqual({
        message: "Authentication is disabled in local mode. No email was sent.",
      });
      expect(response.status).toBe(202);
    } finally {
      await server.stop();
      auth.close();
      database.close();
    }
  });
});

function createConfig(options: { authEnabled?: boolean } = {}): MikroAnalyticsConfig {
  return {
    adminToken: "secret",
    appUrl: "http://127.0.0.1:3000",
    auth: {
      allowedDomains: [],
      allowedEmails: ["admin@example.com"],
      enabled: options.authEnabled ?? true,
      jwtExpirySeconds: 3600,
      jwtSecret: "test-secret-with-at-least-thirty-two-characters",
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
      allowedSearchParams: [],
      blockedEventProperties: ["email", "name", "token", "user"],
      collectUniqueVisitors: false,
      geo: { countryHeader: "cf-ipcountry", enabled: false },
      honorDoNotTrack: true,
      maxEventProperties: 20,
      maxPropertyLength: 120,
      rawEventRetentionHours: 24,
      referrerPolicy: "origin",
      storeRawEvents: false,
      trustProxy: false,
      uniqueVisitorSalt: "",
    },
    staticRoot: "dist/public",
  };
}

function createSite(database: MikroAnalyticsDatabase): void {
  database.createSite({
    domains: ["example.com"],
    id: "site_1",
    name: "Example",
  });
}
