import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import {
  type CurrentUser,
  type MikroAnalyticsAuth,
  MikroAnalyticsAuthAccessDeniedError,
} from "../auth/MikroAnalyticsAuth.js";
import type { MikroAnalyticsConfig } from "../core/config.js";
import { createDailyUniqueKey } from "../core/hash.js";
import { type CollectPayload, type HeadersLike, sanitizeCollectPayload } from "../core/sanitize.js";
import { type SiteInput, toPublicSite } from "../core/sites.js";
import type { MikroAnalyticsDatabase } from "../storage/MikroAnalyticsDatabase.js";
import {
  applyCors,
  getHeader,
  HttpError,
  readJson,
  sendJson,
  sendNoContent,
  serveStatic,
} from "./httpUtils.js";
import { createOpenApiDocument } from "./openapi.js";
import { createPublicRuntimeConfig } from "./publicConfig.js";

const MAGIC_LINK_RESPONSE = "If this email can sign in, you will receive a link shortly.";

export interface AppServerOptions {
  auth: MikroAnalyticsAuth;
  config: MikroAnalyticsConfig;
  database: MikroAnalyticsDatabase;
}

interface CollectAttempt {
  accepted: boolean;
  eventName: string;
  host: string;
  kind: string;
  path: string;
  reason: string;
  siteId: string;
  timestamp: string;
}

export class AppServer {
  private readonly collectAttempts: CollectAttempt[] = [];
  private listeningPort: number;
  private server: Server | null = null;

  constructor(private readonly options: AppServerOptions) {
    this.listeningPort = options.config.port;
  }

  async start(): Promise<void> {
    this.server = createServer((request, response) => {
      void this.handleRequest(request, response);
    });

    await new Promise<void>((resolveStart, rejectStart) => {
      this.server?.once("error", rejectStart);
      this.server?.listen(this.options.config.port, this.options.config.host, () => {
        const address = this.server?.address();
        if (address && typeof address === "object") {
          this.listeningPort = address.port;
        }
        resolveStart();
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    await new Promise<void>((resolveStop, rejectStop) => {
      this.server?.close((error) => (error ? rejectStop(error) : resolveStop()));
      this.server?.closeIdleConnections();
    });
    this.server = null;
  }

  getBaseUrl(): string {
    return `http://${this.options.config.host}:${this.listeningPort}`;
  }

  private async handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    applyCors(request, response);

    if (request.method === "OPTIONS") {
      sendNoContent(response);
      return;
    }

    if (!request.url || !request.method) {
      sendJson(response, 400, { error: "Invalid request." });
      return;
    }

    const url = new URL(request.url, this.getBaseUrl());

    try {
      if (await this.handleApi(request, response, url)) {
        return;
      }

      if (
        request.method === "GET" &&
        serveStatic(this.options.config.staticRoot, url.pathname, response)
      ) {
        return;
      }

      if (request.method === "GET" && !url.pathname.startsWith("/api/")) {
        const served = serveStatic(this.options.config.staticRoot, "/", response);
        if (served) {
          return;
        }
      }

      sendJson(response, 404, { error: "Not found." });
    } catch (error) {
      if (error instanceof HttpError) {
        sendJson(response, error.statusCode, { error: error.message });
        return;
      }

      sendJson(response, 500, {
        error: error instanceof Error ? error.message : "Unexpected server error.",
      });
    }
  }

  private async handleApi(
    request: IncomingMessage,
    response: ServerResponse,
    url: URL,
  ): Promise<boolean> {
    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, {
        service: "mikroanalytics",
        status: "healthy",
        timestamp: new Date().toISOString(),
      });
      return true;
    }

    if (request.method === "GET" && url.pathname === "/openapi.json") {
      sendJson(response, 200, createOpenApiDocument());
      return true;
    }

    if (request.method === "GET" && url.pathname === "/config.json") {
      sendJson(response, 200, createPublicRuntimeConfig(this.options.auth.isEnabled()));
      return true;
    }

    if (request.method === "POST" && url.pathname === "/api/collect") {
      await this.collect(request, response);
      return true;
    }

    if (await this.handleAuthRoutes(request, response, url)) {
      return true;
    }

    if (request.method === "GET" && url.pathname === "/api/sites") {
      if (!this.requireDashboardAccess(request, response)) return true;
      sendJson(response, 200, {
        privacy: this.createPrivacyReport(),
        sites: this.options.database
          .listSites()
          .map((site) => toPublicSite(site, this.options.config.appUrl)),
      });
      return true;
    }

    if (request.method === "POST" && url.pathname === "/api/sites") {
      if (!this.requireDashboardAccess(request, response)) return true;
      const site = this.createSite(await readJson<SiteInput>(request));
      sendJson(response, 201, { site: toPublicSite(site, this.options.config.appUrl) });
      return true;
    }

    const siteRouteMatch = url.pathname.match(/^\/api\/sites\/([^/]+)$/);
    if (request.method === "PUT" && siteRouteMatch) {
      if (!this.requireDashboardAccess(request, response)) return true;
      const site = this.updateSite(
        decodeURIComponent(siteRouteMatch[1] ?? ""),
        await readJson<SiteInput>(request),
      );
      sendJson(response, 200, { site: toPublicSite(site, this.options.config.appUrl) });
      return true;
    }

    if (request.method === "DELETE" && siteRouteMatch) {
      if (!this.requireDashboardAccess(request, response)) return true;
      const result = this.deleteSite(decodeURIComponent(siteRouteMatch[1] ?? ""));
      sendJson(response, 200, result);
      return true;
    }

    if (request.method === "GET" && url.pathname === "/api/collect-attempts") {
      if (!this.requireDashboardAccess(request, response)) return true;
      sendJson(response, 200, {
        attempts: this.getCollectAttempts(url.searchParams.get("site") ?? ""),
      });
      return true;
    }

    if (request.method === "GET" && url.pathname === "/api/report") {
      if (!this.requireDashboardAccess(request, response)) return true;
      const siteId = url.searchParams.get("site") ?? this.options.database.listSites()[0]?.id ?? "";
      const startDate = url.searchParams.get("start");
      const endDate = url.searchParams.get("end");
      const report =
        startDate && endDate
          ? this.options.database.getReportForRange(siteId, startDate, endDate)
          : this.options.database.getReport(siteId, Number(url.searchParams.get("days") ?? "30"));
      sendJson(response, 200, report);
      return true;
    }

    if (request.method === "POST" && url.pathname === "/api/cleanup") {
      if (!this.requireDashboardAccess(request, response)) return true;
      sendJson(
        response,
        200,
        this.options.database.cleanup({
          aggregateRetentionDays: this.options.config.privacy.aggregateRetentionDays,
          rawEventRetentionHours: this.options.config.privacy.rawEventRetentionHours,
        }),
      );
      return true;
    }

    return false;
  }

  private async handleAuthRoutes(
    request: IncomingMessage,
    response: ServerResponse,
    url: URL,
  ): Promise<boolean> {
    if (request.method === "GET" && url.pathname === "/api/auth/me") {
      const user = this.options.auth.requireUser(request);
      if (!user) {
        sendJson(response, 401, {
          authEnabled: this.options.auth.isEnabled(),
          authenticated: false,
        });
        return true;
      }

      sendJson(response, 200, {
        authEnabled: this.options.auth.isEnabled(),
        authenticated: true,
        user,
      });
      return true;
    }

    if (request.method === "POST" && url.pathname === "/api/auth/magic-link") {
      if (!this.options.auth.isEnabled()) {
        sendJson(response, 202, {
          message: "Authentication is disabled in local mode. No email was sent.",
        });
        return true;
      }

      const input = await readJson<{ email?: string }>(request);
      const email = input.email?.trim() ?? "";

      if (!email) {
        sendJson(response, 400, { error: "Email is required." });
        return true;
      }

      try {
        await this.options.auth.requestMagicLink(email, this.options.config.appUrl);
      } catch (error) {
        if (error instanceof MikroAnalyticsAuthAccessDeniedError) {
          sendJson(response, 202, { message: MAGIC_LINK_RESPONSE });
          return true;
        }

        console.error("Failed to request magic link:", error);
      }
      sendJson(response, 202, { message: MAGIC_LINK_RESPONSE });
      return true;
    }

    if (request.method === "POST" && url.pathname === "/api/auth/verify") {
      const input = await readJson<{ email?: string; token?: string }>(request);
      const email = input.email?.trim() ?? "";
      const token = input.token?.trim() ?? "";

      if (!email || !token) {
        sendJson(response, 400, { error: "Email and token are required." });
        return true;
      }

      let credentials: Awaited<ReturnType<MikroAnalyticsAuth["verifyMagicLink"]>>;
      try {
        credentials = await this.options.auth.verifyMagicLink(email, token);
      } catch (error) {
        if (error instanceof MikroAnalyticsAuthAccessDeniedError) {
          throw new HttpError(401, "Invalid or expired sign-in link.");
        }

        throw error;
      }
      sendJson(
        response,
        200,
        {
          authenticated: true,
          expiresIn: credentials.exp,
          tokenType: credentials.tokenType,
        },
        {
          "Set-Cookie": createAuthCookie(credentials.accessToken, this.options.config),
        },
      );
      return true;
    }

    if (request.method === "POST" && url.pathname === "/api/auth/logout") {
      response.writeHead(204, {
        "Set-Cookie": createExpiredAuthCookie(this.options.config),
      });
      response.end();
      return true;
    }

    return false;
  }

  private requireDashboardAccess(
    request: IncomingMessage,
    response: ServerResponse,
  ): CurrentUser | null {
    const user = this.options.auth.requireUser(request);
    if (user) {
      return user;
    }

    if (hasBearerToken(request, this.options.config.adminToken)) {
      return { email: "api-token@mikroanalytics", role: "Admin" };
    }

    sendJson(response, 401, { error: "Authentication is required." });
    return null;
  }

  private createSite(input: SiteInput) {
    try {
      return this.options.database.createSite(input);
    } catch (error) {
      throw new HttpError(400, siteErrorMessage(error));
    }
  }

  private updateSite(id: string, input: SiteInput) {
    try {
      const site = this.options.database.updateSite(id, input);
      if (!site) {
        throw new HttpError(404, "Site was not found.");
      }

      return site;
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new HttpError(400, siteErrorMessage(error));
    }
  }

  private deleteSite(id: string) {
    const site = this.options.database.getSite(id);
    if (!site) {
      throw new HttpError(404, "Site was not found.");
    }

    const rowsDeleted = this.options.database.deleteSites([id]);
    this.removeCollectAttempts(id);

    return {
      id,
      rowsDeleted,
    };
  }

  private async collect(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const payload = await readJson<CollectPayload>(request);
    const metadata = this.createRequestMetadata(request, payload);
    const site = this.options.database.getSite(payload.site ?? "");
    if (!site) {
      this.recordCollectAttempt(payload, metadata, false, "unknown_site");
      sendJson(response, 202, { accepted: false, reason: "unknown_site" });
      return;
    }

    const uniqueKey = this.options.config.privacy.collectUniqueVisitors
      ? createDailyUniqueKey({
          date: new Date().toISOString().slice(0, 10),
          ipAddress: this.getRequestIp(request),
          siteId: site.id,
          uniqueVisitorSalt: this.options.config.privacy.uniqueVisitorSalt,
          userAgent: metadata.userAgent,
        })
      : undefined;

    const result = sanitizeCollectPayload(this.options.config, site, payload, metadata, uniqueKey);
    if (result.ignored) {
      this.recordCollectAttempt(payload, metadata, false, result.reason);
      sendJson(response, 202, { accepted: false, reason: result.reason });
      return;
    }

    if (result.site.ingestToken) {
      const providedToken = getHeader(request, "x-mikroanalytics-token");
      if (providedToken !== result.site.ingestToken) {
        this.recordCollectAttempt(payload, metadata, false, "ingest_token_required");
        sendJson(response, 202, { accepted: false, reason: "ingest_token_required" });
        return;
      }
    }

    this.options.database.recordEvent(result.event, {
      storeRawEvent: this.options.config.privacy.storeRawEvents,
    });
    this.recordCollectAttempt(payload, metadata, true, "accepted");
    sendJson(response, 202, { accepted: true });
  }

  private createRequestMetadata(
    request: IncomingMessage,
    payload: CollectPayload,
  ): {
    headers: HeadersLike;
    originHost: string;
    remoteAddress: string;
    userAgent: string;
  } {
    const origin = getHeader(request, "origin") || getHeader(request, "referer");
    const originHost = origin ? safeHost(origin) : (payload.host ?? "");

    return {
      headers: {
        get: (name: string) => getHeader(request, name) || null,
      },
      originHost,
      remoteAddress: this.getRequestIp(request),
      userAgent: getHeader(request, "user-agent"),
    };
  }

  private getRequestIp(request: IncomingMessage): string {
    if (this.options.config.privacy.trustProxy) {
      const forwarded = getHeader(request, "x-forwarded-for").split(",")[0]?.trim();
      const cfConnectingIp = getHeader(request, "cf-connecting-ip").trim();
      if (forwarded) return forwarded;
      if (cfConnectingIp) return cfConnectingIp;
    }

    return request.socket.remoteAddress ?? "";
  }

  private createPrivacyReport() {
    const privacy = this.options.config.privacy;
    return {
      aggregateRetentionDays: privacy.aggregateRetentionDays,
      collectUniqueVisitors: privacy.collectUniqueVisitors,
      dashboardPath: "/",
      dataModel: privacy.storeRawEvents
        ? "aggregate metrics with short raw debug events"
        : "aggregate metrics only",
      honorDoNotTrack: privacy.honorDoNotTrack,
      rawEventRetentionHours: privacy.storeRawEvents ? privacy.rawEventRetentionHours : 0,
      referrerPolicy: privacy.referrerPolicy,
      storeRawEvents: privacy.storeRawEvents,
      uniqueVisitorNote: privacy.collectUniqueVisitors
        ? "Daily unique estimates use a site-scoped rotating hash. Raw IP and raw user-agent are not stored."
        : "Daily unique estimates are disabled.",
    };
  }

  private recordCollectAttempt(
    payload: CollectPayload,
    metadata: { originHost: string },
    accepted: boolean,
    reason: string,
  ): void {
    this.collectAttempts.unshift({
      accepted,
      eventName: cleanText(payload.event ?? "", 80),
      host: cleanText(payload.host ?? metadata.originHost, 180).toLowerCase(),
      kind: cleanText(payload.kind ?? payload.type ?? (payload.event ? "event" : "pageview"), 24),
      path: cleanPath(payload.path ?? payload.url ?? "/"),
      reason,
      siteId: cleanText(payload.site ?? "", 80),
      timestamp: new Date().toISOString(),
    });

    this.collectAttempts.splice(50);
  }

  private getCollectAttempts(siteId: string): CollectAttempt[] {
    return this.collectAttempts
      .filter((attempt) => !siteId || attempt.siteId === siteId)
      .slice(0, 10);
  }

  private removeCollectAttempts(siteId: string): void {
    for (let index = this.collectAttempts.length - 1; index >= 0; index -= 1) {
      if (this.collectAttempts[index]?.siteId === siteId) {
        this.collectAttempts.splice(index, 1);
      }
    }
  }
}

function hasBearerToken(request: IncomingMessage, expectedToken: string): boolean {
  if (!expectedToken) {
    return false;
  }

  return getHeader(request, "authorization") === `Bearer ${expectedToken}`;
}

function siteErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Site could not be saved.";
  if (message.includes("UNIQUE")) {
    return "Site ID already exists.";
  }

  return message;
}

function createAuthCookie(accessToken: string, config: MikroAnalyticsConfig): string {
  return [
    `mikroanalytics_access_token=${encodeURIComponent(accessToken)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${config.auth.jwtExpirySeconds}`,
    isSecureAppUrl(config.appUrl) ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

function createExpiredAuthCookie(config: MikroAnalyticsConfig): string {
  return [
    "mikroanalytics_access_token=",
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    isSecureAppUrl(config.appUrl) ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

function isSecureAppUrl(appUrl: string): boolean {
  try {
    return new URL(appUrl).protocol === "https:";
  } catch {
    return false;
  }
}

function safeHost(value: string): string {
  try {
    return new URL(value).hostname;
  } catch {
    return value;
  }
}

function cleanText(value: string, maxLength: number): string {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function cleanPath(value: string): string {
  const text = cleanText(value, 180);
  try {
    return new URL(text, "https://example.local").pathname || "/";
  } catch {
    return text.split(/[?#]/)[0]?.slice(0, 180) || "/";
  }
}
