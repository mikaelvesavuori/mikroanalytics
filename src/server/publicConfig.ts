export interface MikroAnalyticsPublicRuntimeConfig {
  auth: {
    enabled: boolean;
    mode: "local" | "magic-link";
    routes: {
      logout: string;
      magicLink: string;
      me: string;
      verify: string;
    };
  };
  mode: "api";
}

export function createPublicRuntimeConfig(authEnabled: boolean): MikroAnalyticsPublicRuntimeConfig {
  return {
    auth: {
      enabled: authEnabled,
      mode: authEnabled ? "magic-link" : "local",
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
