import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "SlimFact",
  description: "Streamlined invoicing made easy.",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: "Home", link: "/" },
      { text: "Demo", link: "/demo" },
      { text: "Contact", link: "/contact" },
    ],

    socialLinks: [
      { icon: "github", link: "https://github.com/simsustech/slimfact" },
    ],
  },
});
