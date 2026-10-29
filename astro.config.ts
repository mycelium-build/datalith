import starlight from "@astrojs/starlight"
import { defineConfig } from "astro/config"

import { themeInitScript } from "./scripts/theme-init.ts"

// https://astro.build/config
export default defineConfig({
    site: "https://mycelium-build.github.io",
    base: process.env.SITE_BASE ?? "/",
    integrations: [
        starlight({
            title: "Datalith",
            // Starlight applies Astro's base to this path.
            favicon: "/datalith.png",
            social: [
                {
                    icon: "github",
                    label: "GitHub",
                    href: "https://github.com/mycelium-build/datalith-app",
                },
            ],
            customCss: [
                "./src/styles/base.css",
                "./src/styles/themes.css",
                "./src/styles/markdown.css",
                "./src/styles/starlight.css",
            ],
            routeMiddleware: "./src/docs-route-data.ts",
            components: {
                MobileMenuFooter: "./src/components/DocsMobileMenuFooter.astro",
                SiteTitle: "./src/components/DocsSiteTitle.astro",
                ThemeSelect: "./src/components/StarlightThemeSelect.astro",
            },
            head: [
                {
                    tag: "script",
                    content: themeInitScript,
                },
            ],
            sidebar: [
                {
                    label: "Datalith documentation",
                    items: [{ autogenerate: { directory: "vault" } }],
                },
                {
                    label: "Preview documentation",
                    items: [{ autogenerate: { directory: "preview/vault" } }],
                },
            ],
        }),
    ],
})
