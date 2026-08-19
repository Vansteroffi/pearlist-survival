// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

/* Le site est entièrement statique : chaque page est un fichier HTML généré au
 * build. Aucun serveur à maintenir, aucune base de données à payer — c'est ce
 * qui permet un hébergement gratuit et un site qui reste rapide. */
export default defineConfig({
  site: "https://www.coachinfrance.fr",
  trailingSlash: "never",
  integrations: [sitemap()],
  build: { format: "file" },
  image: { responsiveStyles: true },
});
