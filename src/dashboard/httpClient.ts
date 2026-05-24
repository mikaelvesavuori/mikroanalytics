import type { RuntimeConfig } from "./model.js";

export function createDefaultRuntimeConfig(): RuntimeConfig {
  return {
    auth: {
      enabled: false,
      mode: "local",
      routes: {
        logout: "/api/auth/logout",
        magicLink: "/api/auth/magic-link",
        me: "/api/auth/me",
        verify: "/api/auth/verify",
      },
    },
    mode: "api",
  };
}

export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  const defaults = createDefaultRuntimeConfig();

  try {
    const response = await fetch("/config.json", { cache: "no-store" });
    if (!response.ok) {
      return defaults;
    }

    const config = await response.json();
    const authEnabled =
      typeof config.auth?.enabled === "boolean" ? config.auth.enabled : defaults.auth.enabled;

    return {
      ...defaults,
      ...config,
      auth: {
        ...defaults.auth,
        ...(isPlainObject(config.auth) ? config.auth : {}),
        enabled: authEnabled,
        mode: authEnabled ? "magic-link" : "local",
        routes: {
          ...defaults.auth.routes,
          ...(isPlainObject(config.auth?.routes) ? config.auth.routes : {}),
        },
      },
      mode: "api",
    };
  } catch {
    return defaults;
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Request failed.");
  }

  return data as T;
}

export async function apiPost<T>(path: string, data: unknown): Promise<T> {
  const response = await fetch(path, {
    body: JSON.stringify(data),
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  const payload = response.status === 204 ? {} : await response.json();

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload as T;
}

export async function apiPut<T>(path: string, data: unknown): Promise<T> {
  const response = await fetch(path, {
    body: JSON.stringify(data),
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    method: "PUT",
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload as T;
}

export async function apiDelete<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    method: "DELETE",
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
