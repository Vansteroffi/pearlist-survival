const formateurDate = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export const dateLongue = (d: Date) => formateurDate.format(d);
export const dateIso = (d: Date) => d.toISOString().slice(0, 10);

/** Les brouillons ne sortent jamais en production, mais restent visibles en
 * développement pour que la relecture soit possible avant publication. */
export const estPublie = (entree: { data: { brouillon?: boolean } }) =>
  import.meta.env.DEV || !entree.data.brouillon;

export const parDateDecroissante = (
  a: { data: { date: Date } },
  b: { data: { date: Date } },
) => b.data.date.valueOf() - a.data.date.valueOf();
