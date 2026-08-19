/* Informations d'entreprise réutilisées partout (pied de page, contact,
 * données structurées). Un seul endroit à corriger le jour où une ligne
 * change. */
export const site = {
  nom: "Coach in France",
  baseline: "Organisme de formation & CFA spécialisé dans le sport",
  url: "https://www.coachinfrance.fr",
  adresse: {
    rue: "21 rue Maréchal Foch",
    codePostal: "56000",
    ville: "Vannes",
    pays: "France",
  },
  email: "contact@coachinfrance.fr",
  emailDirection: "laurent@coachinfrance.fr",
  telephone: "", // À COMPLÉTER : numéro affiché sur le site actuel.
  reseaux: {
    instagram: "https://www.instagram.com/coachinfrance/",
    linkedin: "https://fr.linkedin.com/company/coach-in-france",
  },
  qualiopi:
    "Actions de formation par apprentissage, bilans de compétences, VAE et actions de formation",
} as const;

export const nav = [
  { libelle: "Formations", href: "/formations" },
  { libelle: "Le centre", href: "/le-centre" },
  { libelle: "Actualités", href: "/actualites" },
  { libelle: "Interviews", href: "/interviews" },
  { libelle: "Partenaires", href: "/partenaires" },
] as const;
