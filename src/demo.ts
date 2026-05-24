import { readConfig } from "./core/config.js";
import { seedDemoData } from "./demoData.js";
import { MikroAnalyticsDatabase } from "./storage/MikroAnalyticsDatabase.js";

try {
  const config = readConfig();
  const database = new MikroAnalyticsDatabase(config.databasePath);
  const result = seedDemoData(database);
  database.close();

  console.log(`Seeded MikroAnalytics demo data in ${config.databasePath}`);
  console.log(`Reset rows: ${result.rowsDeleted}`);

  for (const site of result.sites) {
    console.log(`- ${site.name} (${site.id}): ${site.pageviews} pageviews, ${site.events} events`);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to seed MikroAnalytics demo data: ${message}`);
  process.exitCode = 1;
}
