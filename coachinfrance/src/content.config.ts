/* Schéma des contenus administrables depuis /admin.
 *
 * Chaque collection correspond à une rubrique du back-office. Les champs
 * décrits ici sont exactement ceux du formulaire de public/admin/config.yml :
 * si l'un des deux change, l'autre doit suivre, sinon le build échoue — ce qui
 * est voulu : mieux vaut un build rouge qu'une page cassée en ligne. */
import { defineCollection, z } from "astro:content";
import { glob, file } from "astro/loaders";

/** Une image gérée par le CMS est déposée dans /public/uploads. */
const image = z.string();

const actualites = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/actualites" }),
  schema: z.object({
    titre: z.string(),
    date: z.coerce.date(),
    chapo: z.string(),
    couverture: image.optional(),
    alt: z.string().optional(),
    categorie: z.string().default("Actualité"),
    epingle: z.boolean().default(false),
    brouillon: z.boolean().default(false),
  }),
});

const interviews = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/interviews" }),
  schema: z.object({
    nom: z.string(),
    role: z.string(),
    date: z.coerce.date(),
    citation: z.string(),
    portrait: image.optional(),
    alt: z.string().optional(),
    club: z.string().optional(),
    formation: z.string().optional(),
    brouillon: z.boolean().default(false),
  }),
});

const formations = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/formations" }),
  schema: z.object({
    titre: z.string(),
    accroche: z.string(),
    niveau: z.string().optional(),
    duree: z.string().optional(),
    rythme: z.string().optional(),
    lieu: z.string().default("Vannes (56)"),
    prerequis: z.string().optional(),
    tarif: z.string().optional(),
    visuel: image.optional(),
    alt: z.string().optional(),
    ordre: z.number().default(50),
    objectifs: z.array(z.string()).default([]),
    debouches: z.array(z.string()).default([]),
    // Indicateurs de résultats : obligatoires pour un organisme Qualiopi.
    indicateurs: z
      .array(z.object({ libelle: z.string(), valeur: z.string() }))
      .default([]),
    sessions: z
      .array(z.object({ debut: z.string(), places: z.string().optional() }))
      .default([]),
    brouillon: z.boolean().default(false),
  }),
});

const partenaires = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/partenaires" }),
  schema: z.object({
    nom: z.string(),
    logo: image.optional(),
    lien: z.string().optional(),
    categorie: z.string().default("Club"),
    ordre: z.number().default(50),
  }),
});

export const collections = { actualites, interviews, formations, partenaires };
