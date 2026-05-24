import type { IncomingMessage } from "node:http";
import type { EmailProvider, StorageProvider } from "mikroauth";
import { InMemoryEmailProvider, MikroAuth, MikroMailProvider } from "mikroauth";
import type { MikroAnalyticsConfig } from "../core/config.js";
import { SqliteAuthStorageProvider } from "./SqliteAuthStorageProvider.js";

export interface CurrentUser {
  email: string;
  role: string;
}

export class MikroAnalyticsAuthAccessDeniedError extends Error {
  constructor(_email: string) {
    super("Access denied.");
    this.name = "MikroAnalyticsAuthAccessDeniedError";
  }
}

interface MikroAnalyticsAuthDependencies {
  emailProvider?: EmailProvider;
  storageProvider?: StorageProvider;
}

export class MikroAnalyticsAuth {
  private readonly auth: MikroAuth;
  private readonly config: MikroAnalyticsConfig;
  private readonly enabled: boolean;
  private readonly ownsStorageProvider: boolean;
  private readonly storageProvider: StorageProvider;

  constructor(config: MikroAnalyticsConfig, dependencies: MikroAnalyticsAuthDependencies = {}) {
    this.config = config;
    this.enabled = config.auth.enabled;
    this.ownsStorageProvider = !dependencies.storageProvider;
    this.storageProvider =
      dependencies.storageProvider ?? new SqliteAuthStorageProvider(config.databasePath);

    this.auth = new MikroAuth(
      {
        auth: {
          appUrl: config.appUrl,
          debug: false,
          jwtExpirySeconds: config.auth.jwtExpirySeconds,
          jwtSecret: config.auth.jwtSecret,
          magicLinkExpirySeconds: config.auth.magicLinkExpirySeconds,
          maxActiveSessions: config.auth.maxActiveSessions,
          refreshTokenExpirySeconds: config.auth.refreshTokenExpirySeconds,
          templates: createEmailTemplates(),
        },
        email: {
          debug: config.email.debug,
          emailSubject: config.email.emailSubject,
          host: config.email.host,
          maxRetries: config.email.maxRetries,
          password: config.email.password,
          port: config.email.port,
          secure: config.email.secure,
          user: config.email.user || "mikroanalytics@localhost",
        },
      },
      dependencies.emailProvider ?? createEmailProvider(config),
      this.storageProvider,
    );
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async requestMagicLink(email: string, appUrl: string): Promise<void> {
    if (!this.isEmailAllowed(email)) {
      throw new MikroAnalyticsAuthAccessDeniedError(email);
    }

    await this.auth.createMagicLink({
      appUrl,
      email: normalizeEmail(email),
      subject: this.config.email.emailSubject,
    });
  }

  verifyMagicLink(email: string, token: string) {
    if (!this.isEmailAllowed(email)) {
      throw new MikroAnalyticsAuthAccessDeniedError(email);
    }

    return this.auth.verifyToken({ email: normalizeEmail(email), token });
  }

  requireUser(request: IncomingMessage): CurrentUser | null {
    if (!this.enabled) {
      return { email: "local@mikroanalytics", role: "Admin" };
    }

    const token = getCookieValue(request, "mikroanalytics_access_token");
    if (!token) {
      return null;
    }

    try {
      const payload = this.auth.verify(token);
      return {
        email: payload.email ?? payload.sub,
        role: payload.role ?? "User",
      };
    } catch {
      return null;
    }
  }

  isEmailAllowed(email: string): boolean {
    const normalizedEmail = normalizeEmail(email);
    const domain = normalizedEmail.split("@")[1] ?? "";
    const allowedEmails = this.config.auth.allowedEmails.map(normalizeEmail);
    const allowedDomains = this.config.auth.allowedDomains.map(normalizeDomain);

    if (allowedEmails.length === 0 && allowedDomains.length === 0) {
      return true;
    }

    return allowedEmails.includes(normalizedEmail) || allowedDomains.includes(domain);
  }

  close(): void {
    if (!this.ownsStorageProvider) {
      return;
    }

    if ("close" in this.storageProvider && typeof this.storageProvider.close === "function") {
      this.storageProvider.close();
    }

    if ("destroy" in this.storageProvider && typeof this.storageProvider.destroy === "function") {
      this.storageProvider.destroy();
    }
  }
}

function getCookieValue(request: IncomingMessage, name: string): string | null {
  const cookieHeader = request.headers.cookie;
  const source = Array.isArray(cookieHeader) ? cookieHeader.join("; ") : cookieHeader;

  if (!source) {
    return null;
  }

  for (const cookie of source.split(";")) {
    const [cookieName, ...valueParts] = cookie.trim().split("=");

    if (cookieName === name) {
      return decodeURIComponent(valueParts.join("="));
    }
  }

  return null;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^@/, "");
}

function createEmailProvider(config: MikroAnalyticsConfig): EmailProvider {
  if (config.email.host && config.email.user && config.email.password) {
    return new MikroMailProvider({
      debug: config.email.debug,
      host: config.email.host,
      maxRetries: config.email.maxRetries,
      password: config.email.password,
      port: config.email.port,
      secure: config.email.secure,
      user: config.email.user,
    });
  }

  return new InMemoryEmailProvider({ logToConsole: !config.auth.enabled });
}

function createEmailTemplates() {
  return {
    htmlVersion: (magicLink: string, expiryMinutes: number) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign in to MikroAnalytics</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 2rem;">
    <h1 style="font-size: 1.5rem; font-weight: 600; margin: 0 0 1rem 0; color: #202020;">Sign in to MikroAnalytics</h1>
    <p style="font-size: 0.9rem; line-height: 1.5; margin: 0 0 1.5rem 0; color: #646464;">Click the button below to sign in to your account.</p>
    <a href="${escapeHtml(magicLink)}" style="display: inline-block; padding: 0.75rem 1.5rem; background-color: #3e63dd; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 0.9rem; font-weight: 500;">Sign in</a>
    <p style="font-size: 0.8rem; line-height: 1.5; margin: 1.5rem 0 0 0; color: #8d8d8d;">This link expires in ${expiryMinutes} minutes and can only be used once. If you didn't request this, please ignore this email.</p>
  </div>
</body>
</html>
    `,
    textVersion: (magicLink: string, expiryMinutes: number) =>
      `Sign in to MikroAnalytics: ${magicLink}\nThis link expires in ${expiryMinutes} minutes and can only be used once.\nIf you didn't request this, please ignore this email.`,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
