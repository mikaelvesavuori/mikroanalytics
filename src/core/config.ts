import { MikroConf, parsers } from "mikroconf";

export type ReferrerPolicy = "none" | "origin" | "same-origin-path";

export const DEFAULT_JWT_SECRET = "change-this-secret-before-enabling-auth";

export interface MikroAnalyticsAuthConfig {
  allowedDomains: string[];
  allowedEmails: string[];
  enabled: boolean;
  jwtExpirySeconds: number;
  jwtSecret: string;
  magicLinkExpirySeconds: number;
  maxActiveSessions: number;
  refreshTokenExpirySeconds: number;
}

export interface MikroAnalyticsEmailConfig {
  debug: boolean;
  emailSubject: string;
  host: string;
  maxRetries: number;
  password: string;
  port: number;
  secure: boolean;
  user: string;
}

export interface MikroAnalyticsPrivacyConfig {
  aggregateRetentionDays: number;
  allowedSearchParams: string[];
  blockedEventProperties: string[];
  collectUniqueVisitors: boolean;
  geo: {
    countryHeader: string;
    enabled: boolean;
  };
  honorDoNotTrack: boolean;
  maxEventProperties: number;
  maxPropertyLength: number;
  rawEventRetentionHours: number;
  referrerPolicy: ReferrerPolicy;
  storeRawEvents: boolean;
  trustProxy: boolean;
  uniqueVisitorSalt: string;
}

export interface MikroAnalyticsConfig {
  adminToken: string;
  appUrl: string;
  auth: MikroAnalyticsAuthConfig;
  databasePath: string;
  email: MikroAnalyticsEmailConfig;
  host: string;
  port: number;
  privacy: MikroAnalyticsPrivacyConfig;
  staticRoot: string;
}

interface ConfigInput {
  admin?: {
    token?: string;
  };
  appUrl?: string;
  auth?: Partial<MikroAnalyticsAuthConfig>;
  databasePath?: string;
  email?: Partial<MikroAnalyticsEmailConfig>;
  host?: string;
  port?: number | string;
  privacy?: Partial<MikroAnalyticsPrivacyConfig> & {
    geo?: Partial<MikroAnalyticsPrivacyConfig["geo"]>;
  };
  staticRoot?: string;
}

export interface ReadConfigOptions {
  args?: string[];
  configPath?: string;
  env?: NodeJS.ProcessEnv;
}

const defaultBlockedEventProperties = [
  "account",
  "address",
  "auth",
  "customer",
  "email",
  "id",
  "ip",
  "jwt",
  "mail",
  "name",
  "person",
  "phone",
  "secret",
  "session",
  "token",
  "uid",
  "user",
  "userid",
];

const defaultPrivacy: MikroAnalyticsPrivacyConfig = {
  aggregateRetentionDays: 395,
  allowedSearchParams: [
    "ref",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
  ],
  blockedEventProperties: defaultBlockedEventProperties,
  collectUniqueVisitors: false,
  geo: {
    countryHeader: "cf-ipcountry",
    enabled: false,
  },
  honorDoNotTrack: true,
  maxEventProperties: 20,
  maxPropertyLength: 120,
  rawEventRetentionHours: 24,
  referrerPolicy: "origin",
  storeRawEvents: false,
  trustProxy: false,
  uniqueVisitorSalt: "",
};

const defaultInput: ConfigInput = {
  appUrl: "http://127.0.0.1:3000",
  auth: {
    allowedDomains: [],
    allowedEmails: [],
    enabled: false,
    jwtExpirySeconds: 3600,
    jwtSecret: DEFAULT_JWT_SECRET,
    magicLinkExpirySeconds: 900,
    maxActiveSessions: 3,
    refreshTokenExpirySeconds: 604800,
  },
  databasePath: "data/mikroanalytics.sqlite",
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
  port: 3000,
  staticRoot: "dist/public",
};

export function readConfig(options: ReadConfigOptions = {}): MikroAnalyticsConfig {
  const env = options.env ?? process.env;
  const args = options.args ?? process.argv;
  const configPath =
    options.configPath ??
    readCliValue(args, ["--config", "--config-path"]) ??
    env.MIKROANALYTICS_CONFIG_PATH ??
    "mikroanalytics.config.json";
  const rawConfig = new MikroConf({
    args,
    config: createEnvInput(env),
    configFilePath: configPath,
    options: createMikroConfOptions(),
  }).get<ConfigInput>();
  const privacy = resolvePrivacy(rawConfig.privacy ?? {}, {});

  const config: MikroAnalyticsConfig = {
    adminToken: rawConfig.admin?.token ?? "",
    appUrl: rawConfig.appUrl ?? defaultInput.appUrl!,
    auth: resolveAuth(rawConfig.auth ?? {}, {}),
    databasePath: rawConfig.databasePath ?? defaultInput.databasePath!,
    email: resolveEmail(rawConfig.email ?? {}, {}),
    host: rawConfig.host ?? defaultInput.host!,
    port: resolvePort(rawConfig.port ?? defaultInput.port!),
    privacy,
    staticRoot: rawConfig.staticRoot ?? defaultInput.staticRoot!,
  };

  validateConfig(config);
  return config;
}

function resolveAuth(
  input: Partial<MikroAnalyticsAuthConfig>,
  env: NodeJS.ProcessEnv,
): MikroAnalyticsAuthConfig {
  return {
    allowedDomains:
      readEnvList(env, ["MIKROANALYTICS_AUTH_ALLOWED_DOMAINS", "AUTH_ALLOWED_DOMAINS"]) ??
      normalizeList(input.allowedDomains),
    allowedEmails:
      readEnvList(env, ["MIKROANALYTICS_AUTH_ALLOWED_EMAILS", "AUTH_ALLOWED_EMAILS"]) ??
      normalizeList(input.allowedEmails),
    enabled: resolveBoolean(
      env.MIKROANALYTICS_AUTH_ENABLED,
      input.enabled,
      defaultInput.auth!.enabled!,
    ),
    jwtExpirySeconds: resolveNumber(
      env.MIKROANALYTICS_AUTH_JWT_EXPIRY,
      input.jwtExpirySeconds,
      defaultInput.auth!.jwtExpirySeconds!,
    ),
    jwtSecret:
      env.MIKROANALYTICS_AUTH_JWT_SECRET ??
      env.AUTH_JWT_SECRET ??
      input.jwtSecret ??
      defaultInput.auth!.jwtSecret!,
    magicLinkExpirySeconds: resolveNumber(
      env.MIKROANALYTICS_AUTH_MAGIC_LINK_EXPIRY,
      input.magicLinkExpirySeconds,
      defaultInput.auth!.magicLinkExpirySeconds!,
    ),
    maxActiveSessions: resolveNumber(
      env.MIKROANALYTICS_AUTH_MAX_SESSIONS,
      input.maxActiveSessions,
      defaultInput.auth!.maxActiveSessions!,
    ),
    refreshTokenExpirySeconds: resolveNumber(
      env.MIKROANALYTICS_AUTH_REFRESH_EXPIRY,
      input.refreshTokenExpirySeconds,
      defaultInput.auth!.refreshTokenExpirySeconds!,
    ),
  };
}

function createMikroConfOptions() {
  return [
    { defaultValue: defaultInput.appUrl, flag: "--app-url", path: "appUrl" },
    { defaultValue: defaultInput.host, flag: "--host", path: "host" },
    {
      defaultValue: defaultInput.port,
      flag: "--port",
      parser: parsers.int,
      path: "port",
    },
    { defaultValue: defaultInput.databasePath, flag: "--db", path: "databasePath" },
    { defaultValue: defaultInput.staticRoot, flag: "--static-root", path: "staticRoot" },
    { defaultValue: "", flag: "--admin-token", path: "admin.token" },
    {
      defaultValue: defaultInput.auth!.enabled,
      flag: "--auth-enabled",
      isFlag: true,
      path: "auth.enabled",
    },
    {
      defaultValue: defaultInput.auth!.allowedEmails,
      flag: "--auth-allowed-emails",
      parser: parsers.array,
      path: "auth.allowedEmails",
    },
    {
      defaultValue: defaultInput.auth!.allowedDomains,
      flag: "--auth-allowed-domains",
      parser: parsers.array,
      path: "auth.allowedDomains",
    },
    {
      defaultValue: defaultInput.auth!.jwtSecret,
      flag: "--auth-jwt-secret",
      path: "auth.jwtSecret",
    },
    {
      defaultValue: defaultInput.auth!.magicLinkExpirySeconds,
      flag: "--auth-magic-link-expiry",
      parser: parsers.int,
      path: "auth.magicLinkExpirySeconds",
    },
    {
      defaultValue: defaultInput.auth!.jwtExpirySeconds,
      flag: "--auth-jwt-expiry",
      parser: parsers.int,
      path: "auth.jwtExpirySeconds",
    },
    {
      defaultValue: defaultInput.auth!.refreshTokenExpirySeconds,
      flag: "--auth-refresh-expiry",
      parser: parsers.int,
      path: "auth.refreshTokenExpirySeconds",
    },
    {
      defaultValue: defaultInput.auth!.maxActiveSessions,
      flag: "--auth-max-sessions",
      parser: parsers.int,
      path: "auth.maxActiveSessions",
    },
    {
      defaultValue: defaultInput.email!.emailSubject,
      flag: "--email-subject",
      path: "email.emailSubject",
    },
    { defaultValue: defaultInput.email!.host, flag: "--email-host", path: "email.host" },
    { defaultValue: defaultInput.email!.user, flag: "--email-user", path: "email.user" },
    {
      defaultValue: defaultInput.email!.password,
      flag: "--email-password",
      path: "email.password",
    },
    {
      defaultValue: defaultInput.email!.port,
      flag: "--email-port",
      parser: parsers.int,
      path: "email.port",
    },
    {
      defaultValue: defaultInput.email!.secure,
      flag: "--email-secure",
      isFlag: true,
      path: "email.secure",
    },
    {
      defaultValue: defaultInput.email!.maxRetries,
      flag: "--email-max-retries",
      parser: parsers.int,
      path: "email.maxRetries",
    },
    {
      defaultValue: defaultInput.email!.debug,
      flag: "--email-debug",
      isFlag: true,
      path: "email.debug",
    },
    {
      defaultValue: defaultPrivacy.aggregateRetentionDays,
      flag: "--aggregate-retention-days",
      parser: parsers.int,
      path: "privacy.aggregateRetentionDays",
    },
    {
      defaultValue: defaultPrivacy.allowedSearchParams,
      flag: "--allowed-search-params",
      parser: parsers.array,
      path: "privacy.allowedSearchParams",
    },
    {
      defaultValue: defaultPrivacy.blockedEventProperties,
      flag: "--blocked-event-properties",
      parser: parsers.array,
      path: "privacy.blockedEventProperties",
    },
    {
      defaultValue: defaultPrivacy.collectUniqueVisitors,
      flag: "--collect-unique-visitors",
      isFlag: true,
      path: "privacy.collectUniqueVisitors",
    },
    {
      defaultValue: defaultPrivacy.honorDoNotTrack,
      path: "privacy.honorDoNotTrack",
    },
    {
      defaultValue: defaultPrivacy.maxEventProperties,
      flag: "--max-event-properties",
      parser: parsers.int,
      path: "privacy.maxEventProperties",
    },
    {
      defaultValue: defaultPrivacy.maxPropertyLength,
      flag: "--max-property-length",
      parser: parsers.int,
      path: "privacy.maxPropertyLength",
    },
    {
      defaultValue: defaultPrivacy.rawEventRetentionHours,
      flag: "--raw-event-retention-hours",
      parser: parsers.int,
      path: "privacy.rawEventRetentionHours",
    },
    {
      defaultValue: defaultPrivacy.referrerPolicy,
      flag: "--referrer-policy",
      path: "privacy.referrerPolicy",
    },
    {
      defaultValue: defaultPrivacy.storeRawEvents,
      flag: "--store-raw-events",
      isFlag: true,
      path: "privacy.storeRawEvents",
    },
    {
      defaultValue: defaultPrivacy.trustProxy,
      flag: "--trust-proxy",
      isFlag: true,
      path: "privacy.trustProxy",
    },
    {
      defaultValue: defaultPrivacy.uniqueVisitorSalt,
      flag: "--unique-salt",
      path: "privacy.uniqueVisitorSalt",
    },
    {
      defaultValue: defaultPrivacy.geo.enabled,
      flag: "--geo-enabled",
      isFlag: true,
      path: "privacy.geo.enabled",
    },
    {
      defaultValue: defaultPrivacy.geo.countryHeader,
      flag: "--geo-country-header",
      path: "privacy.geo.countryHeader",
    },
  ];
}

function createEnvInput(env: NodeJS.ProcessEnv): ConfigInput {
  const input: ConfigInput = {};

  setValue(input, "admin.token", readEnv(env, ["MIKROANALYTICS_ADMIN_TOKEN", "ADMIN_TOKEN"]));
  setValue(input, "appUrl", readEnv(env, ["MIKROANALYTICS_APP_URL", "APP_URL"]));
  setValue(
    input,
    "databasePath",
    readEnv(env, ["MIKROANALYTICS_DATABASE_PATH", "MIKROANALYTICS_DB_PATH"]),
  );
  setValue(input, "host", readEnv(env, ["HOST", "MIKROANALYTICS_HOST"]));
  setValue(input, "port", readEnvNumber(env, ["MIKROANALYTICS_PORT", "PORT"]));
  setValue(input, "staticRoot", readEnv(env, ["MIKROANALYTICS_STATIC_ROOT"]));

  setValue(input, "auth.enabled", readEnvBoolean(env, ["MIKROANALYTICS_AUTH_ENABLED"]));
  setValue(
    input,
    "auth.allowedDomains",
    readEnvList(env, ["MIKROANALYTICS_AUTH_ALLOWED_DOMAINS", "AUTH_ALLOWED_DOMAINS"]),
  );
  setValue(
    input,
    "auth.allowedEmails",
    readEnvList(env, ["MIKROANALYTICS_AUTH_ALLOWED_EMAILS", "AUTH_ALLOWED_EMAILS"]),
  );
  setValue(
    input,
    "auth.jwtExpirySeconds",
    readEnvNumber(env, ["MIKROANALYTICS_AUTH_JWT_EXPIRY", "AUTH_JWT_EXPIRY"]),
  );
  setValue(
    input,
    "auth.jwtSecret",
    readEnv(env, ["MIKROANALYTICS_AUTH_JWT_SECRET", "AUTH_JWT_SECRET"]),
  );
  setValue(
    input,
    "auth.magicLinkExpirySeconds",
    readEnvNumber(env, ["MIKROANALYTICS_AUTH_MAGIC_LINK_EXPIRY", "AUTH_LINK_EXPIRY"]),
  );
  setValue(
    input,
    "auth.maxActiveSessions",
    readEnvNumber(env, ["MIKROANALYTICS_AUTH_MAX_SESSIONS", "AUTH_MAX_SESSIONS"]),
  );
  setValue(
    input,
    "auth.refreshTokenExpirySeconds",
    readEnvNumber(env, ["MIKROANALYTICS_AUTH_REFRESH_EXPIRY", "AUTH_REFRESH_EXPIRY"]),
  );

  setValue(
    input,
    "email.debug",
    readEnvBoolean(env, ["MIKROANALYTICS_EMAIL_DEBUG", "EMAIL_DEBUG"]),
  );
  setValue(
    input,
    "email.emailSubject",
    readEnv(env, ["MIKROANALYTICS_EMAIL_SUBJECT", "EMAIL_SUBJECT"]),
  );
  setValue(input, "email.host", readEnv(env, ["MIKROANALYTICS_EMAIL_HOST", "EMAIL_HOST"]));
  setValue(
    input,
    "email.maxRetries",
    readEnvNumber(env, ["MIKROANALYTICS_EMAIL_MAX_RETRIES", "EMAIL_MAX_RETRIES"]),
  );
  setValue(
    input,
    "email.password",
    readEnv(env, ["MIKROANALYTICS_EMAIL_PASSWORD", "EMAIL_PASSWORD"]),
  );
  setValue(input, "email.port", readEnvNumber(env, ["MIKROANALYTICS_EMAIL_PORT", "EMAIL_PORT"]));
  setValue(
    input,
    "email.secure",
    readEnvBoolean(env, ["MIKROANALYTICS_EMAIL_SECURE", "EMAIL_SECURE"]),
  );
  setValue(input, "email.user", readEnv(env, ["MIKROANALYTICS_EMAIL_USER", "EMAIL_USER"]));

  setValue(
    input,
    "privacy.aggregateRetentionDays",
    readEnvNumber(env, ["MIKROANALYTICS_AGGREGATE_RETENTION_DAYS"]),
  );
  setValue(
    input,
    "privacy.collectUniqueVisitors",
    readEnvBoolean(env, ["MIKROANALYTICS_COLLECT_UNIQUE_VISITORS"]),
  );
  setValue(input, "privacy.geo.countryHeader", readEnv(env, ["MIKROANALYTICS_GEO_COUNTRY_HEADER"]));
  setValue(input, "privacy.geo.enabled", readEnvBoolean(env, ["MIKROANALYTICS_GEO_ENABLED"]));
  setValue(input, "privacy.honorDoNotTrack", readEnvBoolean(env, ["MIKROANALYTICS_HONOR_DNT"]));
  setValue(
    input,
    "privacy.rawEventRetentionHours",
    readEnvNumber(env, ["MIKROANALYTICS_RAW_EVENT_RETENTION_HOURS"]),
  );
  setValue(
    input,
    "privacy.storeRawEvents",
    readEnvBoolean(env, ["MIKROANALYTICS_STORE_RAW_EVENTS"]),
  );
  setValue(input, "privacy.trustProxy", readEnvBoolean(env, ["MIKROANALYTICS_TRUST_PROXY"]));
  setValue(input, "privacy.uniqueVisitorSalt", readEnv(env, ["MIKROANALYTICS_UNIQUE_SALT"]));

  return input;
}

function resolveEmail(
  input: Partial<MikroAnalyticsEmailConfig>,
  env: NodeJS.ProcessEnv,
): MikroAnalyticsEmailConfig {
  return {
    debug: resolveBoolean(env.MIKROANALYTICS_EMAIL_DEBUG, input.debug, defaultInput.email!.debug!),
    emailSubject:
      env.MIKROANALYTICS_EMAIL_SUBJECT ??
      env.EMAIL_SUBJECT ??
      input.emailSubject ??
      defaultInput.email!.emailSubject!,
    host:
      env.MIKROANALYTICS_EMAIL_HOST ?? env.EMAIL_HOST ?? input.host ?? defaultInput.email!.host!,
    maxRetries: resolveNumber(
      env.MIKROANALYTICS_EMAIL_MAX_RETRIES,
      input.maxRetries,
      defaultInput.email!.maxRetries!,
    ),
    password:
      env.MIKROANALYTICS_EMAIL_PASSWORD ??
      env.EMAIL_PASSWORD ??
      input.password ??
      defaultInput.email!.password!,
    port: resolveNumber(env.MIKROANALYTICS_EMAIL_PORT, input.port, defaultInput.email!.port!),
    secure: resolveBoolean(
      env.MIKROANALYTICS_EMAIL_SECURE,
      input.secure,
      defaultInput.email!.secure!,
    ),
    user:
      env.MIKROANALYTICS_EMAIL_USER ?? env.EMAIL_USER ?? input.user ?? defaultInput.email!.user!,
  };
}

function resolvePrivacy(
  input: ConfigInput["privacy"],
  env: NodeJS.ProcessEnv,
): MikroAnalyticsPrivacyConfig {
  return {
    ...defaultPrivacy,
    ...input,
    aggregateRetentionDays: resolveNumber(
      env.MIKROANALYTICS_AGGREGATE_RETENTION_DAYS,
      input?.aggregateRetentionDays,
      defaultPrivacy.aggregateRetentionDays,
    ),
    collectUniqueVisitors: resolveBoolean(
      env.MIKROANALYTICS_COLLECT_UNIQUE_VISITORS,
      input?.collectUniqueVisitors,
      defaultPrivacy.collectUniqueVisitors,
    ),
    geo: {
      countryHeader:
        env.MIKROANALYTICS_GEO_COUNTRY_HEADER ??
        input?.geo?.countryHeader ??
        defaultPrivacy.geo.countryHeader,
      enabled: resolveBoolean(
        env.MIKROANALYTICS_GEO_ENABLED,
        input?.geo?.enabled,
        defaultPrivacy.geo.enabled,
      ),
    },
    honorDoNotTrack: resolveBoolean(
      env.MIKROANALYTICS_HONOR_DNT,
      input?.honorDoNotTrack,
      defaultPrivacy.honorDoNotTrack,
    ),
    rawEventRetentionHours: resolveNumber(
      env.MIKROANALYTICS_RAW_EVENT_RETENTION_HOURS,
      input?.rawEventRetentionHours,
      defaultPrivacy.rawEventRetentionHours,
    ),
    storeRawEvents: resolveBoolean(
      env.MIKROANALYTICS_STORE_RAW_EVENTS,
      input?.storeRawEvents,
      defaultPrivacy.storeRawEvents,
    ),
    trustProxy: resolveBoolean(
      env.MIKROANALYTICS_TRUST_PROXY,
      input?.trustProxy,
      defaultPrivacy.trustProxy,
    ),
    uniqueVisitorSalt: env.MIKROANALYTICS_UNIQUE_SALT ?? input?.uniqueVisitorSalt ?? "",
  };
}

function validateConfig(config: MikroAnalyticsConfig): void {
  if (!isValidUrl(config.appUrl)) {
    throw new Error("appUrl must be a valid URL.");
  }

  if (config.privacy.collectUniqueVisitors && !config.privacy.uniqueVisitorSalt) {
    throw new Error(
      "Set MIKROANALYTICS_UNIQUE_SALT or privacy.uniqueVisitorSalt before enabling unique visitor estimation.",
    );
  }

  if (!config.auth.enabled) {
    return;
  }

  if (config.auth.jwtSecret === DEFAULT_JWT_SECRET || config.auth.jwtSecret.length < 32) {
    throw new Error("auth.jwtSecret must be changed and contain at least 32 characters.");
  }

  if (config.auth.allowedEmails.length === 0 && config.auth.allowedDomains.length === 0) {
    throw new Error("auth.allowedEmails or auth.allowedDomains must include at least one entry.");
  }

  for (const email of config.auth.allowedEmails) {
    if (!isValidEmail(email)) {
      throw new Error(`auth.allowedEmails contains an invalid email: ${email}.`);
    }
  }

  for (const domain of config.auth.allowedDomains) {
    if (!isValidDomain(domain)) {
      throw new Error(`auth.allowedDomains contains an invalid domain: ${domain}.`);
    }
  }

  if (!config.email.emailSubject.trim()) {
    throw new Error("email.emailSubject is required when auth is enabled.");
  }

  if (!config.email.host || !config.email.user || !config.email.password) {
    throw new Error(
      "email.host, email.user, and email.password are required when auth is enabled.",
    );
  }
}

function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 100);
}

function resolveBoolean(
  envValue: string | undefined,
  configValue: boolean | undefined,
  defaultValue: boolean,
): boolean {
  if (["1", "true", "yes", "on"].includes(envValue?.toLowerCase() ?? "")) return true;
  if (["0", "false", "no", "off"].includes(envValue?.toLowerCase() ?? "")) return false;
  return configValue ?? defaultValue;
}

function resolveNumber(
  envValue: string | undefined,
  configValue: number | undefined,
  defaultValue: number,
): number {
  const candidate = envValue ?? configValue;
  const parsed = Number(candidate);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : defaultValue;
}

function resolvePort(value: string | number): number {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 ? port : 3000;
}

function readCliValue(args: string[], flags: string[]): string | undefined {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg) {
      continue;
    }

    for (const flag of flags) {
      if (arg === flag) {
        return args[index + 1];
      }

      if (arg.startsWith(`${flag}=`)) {
        return arg.slice(flag.length + 1);
      }
    }
  }

  return undefined;
}

function readEnv(env: NodeJS.ProcessEnv, names: string[]): string | undefined {
  for (const name of names) {
    const value = env[name];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return undefined;
}

function readEnvBoolean(env: NodeJS.ProcessEnv, names: string[]): boolean | undefined {
  const value = readEnv(env, names)?.toLowerCase();

  if (!value) {
    return undefined;
  }

  if (["1", "true", "yes", "on"].includes(value)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(value)) {
    return false;
  }

  return undefined;
}

function readEnvList(env: NodeJS.ProcessEnv, names: string[]): string[] | undefined {
  for (const name of names) {
    const value = env[name];
    if (typeof value !== "string" || !value.trim()) {
      continue;
    }

    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return undefined;
}

function readEnvNumber(env: NodeJS.ProcessEnv, names: string[]): number | undefined {
  const value = readEnv(env, names);
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function setValue(target: ConfigInput, path: string, value: unknown): void {
  if (value === undefined) {
    return;
  }

  const parts = path.split(".");
  let cursor = target as Record<string, unknown>;
  for (const part of parts.slice(0, -1)) {
    const current = cursor[part];
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      cursor[part] = {};
    }
    cursor = cursor[part] as Record<string, unknown>;
  }

  const key = parts.at(-1);
  if (key) {
    cursor[key] = value;
  }
}

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidDomain(value: string): boolean {
  return /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value.replace(/^@/, ""));
}
