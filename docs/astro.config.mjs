// @ts-check
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://mikrosuite.com",
  base: "/analytics/docs",
  integrations: [
    starlight({
      title: "MikroAnalytics Docs",
      description:
        "Private, self-hosted web and product analytics for teams that want useful signals without visitor profiling.",
      favicon: "/favicon.svg",
      customCss: ["./src/styles/custom.css"],
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/mikaelvesavuori/mikroanalytics",
        },
      ],
      sidebar: [
        {
          label: "Getting Started",
          items: [
            { label: "What is MikroAnalytics?", link: "/getting-started/intro" },
            { label: "Installation", link: "/getting-started/installation" },
          ],
        },
        {
          label: "Guides",
          items: [
            { label: "Configuration", link: "/guides/configuration" },
            { label: "Tracking", link: "/guides/tracking" },
            { label: "Privacy Model", link: "/guides/privacy-model" },
            { label: "Authentication", link: "/guides/authentication" },
            { label: "Deployment", link: "/guides/deployment" },
          ],
        },
        {
          label: "Reference",
          items: [
            { label: "Comparison", link: "/reference/comparison" },
            { label: "Configuration", link: "/reference/configuration" },
            { label: "API Reference", link: "/reference/api" },
            { label: "Architecture", link: "/reference/architecture" },
          ],
        },
      ],
    }),
  ],
});
