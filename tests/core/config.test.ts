import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { readConfig } from "../../src/core/config.js";

let tempDirectories: string[] = [];

afterEach(() => {
  for (const directory of tempDirectories) {
    rmSync(directory, { force: true, recursive: true });
  }
  tempDirectories = [];
});

describe("readConfig", () => {
  it("reads MikroConf JSON as the primary configuration source", () => {
    const configPath = writeConfig({
      admin: { token: "from-file" },
      appUrl: "https://analytics.example.com",
      host: "0.0.0.0",
      port: 4500,
    });

    const config = readConfig({ args: ["node"], configPath, env: {} });

    expect(config.adminToken).toBe("from-file");
    expect(config.appUrl).toBe("https://analytics.example.com");
    expect(config.host).toBe("0.0.0.0");
    expect(config.port).toBe(4500);
    expect("sites" in config).toBe(false);
  });

  it("allows environment variables to override deployment-sensitive values", () => {
    const configPath = writeConfig({
      admin: { token: "from-file" },
      appUrl: "https://file.example.com",
      port: 4500,
    });

    const config = readConfig({
      args: ["node"],
      configPath,
      env: {
        MIKROANALYTICS_ADMIN_TOKEN: "from-env",
        MIKROANALYTICS_APP_URL: "https://env.example.com",
        MIKROANALYTICS_PORT: "4600",
      },
    });

    expect(config.adminToken).toBe("from-env");
    expect(config.appUrl).toBe("https://env.example.com");
    expect(config.port).toBe(4600);
  });

  it("uses MIKROANALYTICS_PORT before the generic PORT fallback", () => {
    const config = readConfig({
      args: ["node"],
      configPath: writeConfig({}),
      env: {
        MIKROANALYTICS_PORT: "4600",
        PORT: "3000",
      },
    });

    expect(config.port).toBe(4600);
  });

  it("allows CLI flags to choose and override a config file", () => {
    const configPath = writeConfig({
      admin: { token: "from-file" },
      appUrl: "https://file.example.com",
      port: 4500,
    });

    const config = readConfig({
      args: [
        "node",
        "server",
        "--config",
        configPath,
        "--admin-token",
        "from-cli",
        "--port",
        "4700",
      ],
      env: {
        MIKROANALYTICS_ADMIN_TOKEN: "from-env",
      },
    });

    expect(config.adminToken).toBe("from-cli");
    expect(config.appUrl).toBe("https://file.example.com");
    expect(config.port).toBe(4700);
  });
});

function writeConfig(config: Record<string, unknown>) {
  const directory = mkdtempSync(join(tmpdir(), "mikroanalytics-config-"));
  tempDirectories.push(directory);

  const configPath = join(directory, "mikroanalytics.config.json");
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  return configPath;
}
