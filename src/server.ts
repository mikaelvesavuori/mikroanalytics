import { MikroAnalyticsAuth } from "./auth/MikroAnalyticsAuth.js";
import { readConfig } from "./core/config.js";
import { AppServer } from "./server/AppServer.js";
import { MikroAnalyticsDatabase } from "./storage/MikroAnalyticsDatabase.js";

const config = readConfig();
const database = new MikroAnalyticsDatabase(config.databasePath);
database.migrate();

const auth = new MikroAnalyticsAuth(config);
const server = new AppServer({ auth, config, database });

try {
  await server.start();
} catch (error) {
  auth.close();
  database.close();

  if ((error as NodeJS.ErrnoException).code === "EADDRINUSE") {
    console.error(
      `MikroAnalytics could not start because ${config.host}:${config.port} is already in use.`,
    );
    process.exit(1);
  }

  throw error;
}

console.log(`MikroAnalytics is running at ${server.getBaseUrl()}`);

if (config.auth.enabled) {
  console.log(
    `MikroAnalytics auth is enabled. Magic links use SMTP ${config.email.host}:${config.email.port} (${config.email.secure ? "secure" : "starttls/plain"}).`,
  );
} else {
  console.log("MikroAnalytics auth is disabled for local mode. No magic-link emails are sent.");
}

if (!config.adminToken || config.adminToken === "change-me") {
  console.warn(
    "Set MIKROANALYTICS_ADMIN_TOKEN before running MikroAnalytics outside local development.",
  );
}

async function shutdown(exitCode: number) {
  try {
    await server.stop();
  } catch (error) {
    console.error("MikroAnalytics did not shut down cleanly.", error);
    exitCode = 1;
  } finally {
    auth.close();
    database.close();
    process.exit(exitCode);
  }
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void shutdown(0);
  });
}
