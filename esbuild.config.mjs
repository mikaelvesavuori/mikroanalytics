import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { build } from "esbuild";
import { minify } from "html-minifier-terser";
import { transform } from "lightningcss";

const distDir = "dist";
const publicDir = join(distDir, "public");
const serverDir = join(distDir, "server");
const packageVersion = JSON.parse(readFileSync("package.json", "utf8")).version;

rmSync(distDir, { force: true, recursive: true });
mkdirSync(publicDir, { recursive: true });
mkdirSync(serverDir, { recursive: true });

cpSync("src/public", publicDir, { recursive: true });

await build({
  banner: {
    js: `/* MikroAnalytics API v${packageVersion} | ${new Date().toISOString()} */`,
  },
  bundle: true,
  entryPoints: ["src/server.ts"],
  external: ["node:*"],
  format: "esm",
  logLevel: "info",
  mainFields: ["module", "main"],
  minify: true,
  outfile: join(serverDir, "server.mjs"),
  platform: "node",
  sourcemap: false,
  target: "node25",
  treeShaking: true,
});

await build({
  banner: {
    js: `/* MikroAnalytics demo seed v${packageVersion} | ${new Date().toISOString()} */`,
  },
  bundle: true,
  entryPoints: ["src/demo.ts"],
  external: ["node:*"],
  format: "esm",
  logLevel: "info",
  mainFields: ["module", "main"],
  minify: true,
  outfile: join(serverDir, "demo.mjs"),
  platform: "node",
  sourcemap: false,
  target: "node25",
  treeShaking: true,
});

await build({
  banner: {
    js: `/* MikroAnalytics tracker v${packageVersion} */`,
  },
  bundle: true,
  entryPoints: ["src/tracker/mikro.ts"],
  format: "iife",
  globalName: "MikroAnalyticsTracker",
  logLevel: "info",
  minify: true,
  outfile: join(publicDir, "m.js"),
  platform: "browser",
  sourcemap: false,
  target: ["chrome109", "safari16", "edge109", "firefox109"],
  treeShaking: true,
});

await build({
  banner: {
    js: `/* MikroAnalytics dashboard v${packageVersion} | ${new Date().toISOString()} */`,
  },
  bundle: true,
  entryPoints: ["src/dashboard/dashboard.ts"],
  format: "esm",
  logLevel: "info",
  minify: true,
  outfile: join(publicDir, "dashboard.js"),
  platform: "browser",
  sourcemap: false,
  target: ["chrome109", "safari16", "edge109", "firefox109"],
  treeShaking: true,
});

const css = transform({
  code: Buffer.from(readFileSync("src/dashboard/styles.css")),
  filename: "styles.css",
  minify: true,
  sourceMap: false,
}).code;
writeFileSync(join(publicDir, "styles.css"), css);

const html = await minify(readFileSync("src/dashboard/index.html", "utf8"), {
  collapseWhitespace: true,
  minifyCSS: true,
  minifyJS: true,
  removeComments: true,
  removeOptionalTags: true,
  removeRedundantAttributes: true,
  useShortDoctype: true,
});
writeFileSync(join(publicDir, "index.html"), html);

cpSync("mikroanalytics.config.json.example", join(distDir, "mikroanalytics.config.json.example"));

console.log("MikroAnalytics build complete.");
