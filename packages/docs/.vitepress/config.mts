import { defineConfig } from "vitepress";

export default defineConfig({
  title: "SlimFact",
  head: [
    ["link", { rel: "icon", href: "/favicon.ico" }],
    ["meta", { property: "og:title", content: "SlimFact — Streamlined invoicing made easy" }],
    [
      "meta",
      {
        property: "og:description",
        content:
          "Open-source, API-first invoicing engine. Self-host for free or Cloud at €15/month.",
      },
    ],
    ["meta", { property: "og:image", content: "/logo.svg" }],
  ],
  description: "Streamlined invoicing made easy.",

  locales: {
    root: {
      label: "English",
      lang: "en-US",
      themeConfig: {
        logo: "/logo.svg",
        nav: [
          { text: "Home", link: "/" },
          { text: "Pricing", link: "/pricing" },
          { text: "Why SlimFact", link: "/comparison" },
          { text: "Guide", link: "/guide/" },
          { text: "Features", link: "/features" },
          { text: "Contact", link: "/contact" },
          {
            text: "More",
            items: [
              { text: "Invoice Lifecycle", link: "/flow" },
              { text: "Benchmark", link: "/benchmark" },
            ],
          },
        ],
        sidebar: {
          "/guide/": [
            {
              text: "User Guide",
              items: [
                { text: "Overview", link: "/guide/" },
                { text: "Customer Guide", link: "/guide/customer" },
                { text: "Administrator Guide", link: "/guide/administrator" },
                { text: "Invoice Lifecycle", link: "/flow" },
              ],
            },
          ],
        },
        footer: {
          message: 'Copyright © simsustech 2023-present · <a href="/privacy">Privacy Policy</a>',
          copyright: "ELv2 License",
        },
      },
    },
    nl: {
      label: "Nederlands",
      lang: "nl-NL",
      themeConfig: {
        logo: "/logo.svg",
        nav: [
          { text: "Home", link: "/nl/" },
          { text: "Prijzen", link: "/nl/pricing" },
          { text: "Waarom SlimFact", link: "/nl/comparison" },
          { text: "Handleiding", link: "/nl/guide/" },
          { text: "Functionaliteiten", link: "/nl/features" },
          { text: "Contact", link: "/nl/contact" },
          {
            text: "Meer",
            items: [
              { text: "Factuur Lifecycle", link: "/nl/flow" },
              { text: "Benchmark", link: "/nl/benchmark" },
            ],
          },
        ],
        sidebar: {
          "/nl/guide/": [
            {
              text: "Handleiding",
              items: [
                { text: "Overzicht", link: "/nl/guide/" },
                { text: "Klantenhandleiding", link: "/nl/guide/customer" },
                { text: "Beheerdershandleiding", link: "/nl/guide/administrator" },
                { text: "Invoice Lifecycle", link: "/nl/flow" },
              ],
            },
          ],
        },
        footer: {
          message: 'Copyright © simsustech 2023-heden · <a href="/nl/privacy">Privacybeleid</a>',
          copyright: "ELv2 Licentie",
        },
      },
    },
  },

  themeConfig: {
    socialLinks: [{ icon: "github", link: "https://github.com/simsustech/slimfact" }],
  },
});
