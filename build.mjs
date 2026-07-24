/* Pearlist — build du site vitrine.
 *
 * Objectif : qu'un visiteur ne déclenche AUCUNE requête vers Firebase ou
 * Cloudinary. Tout est rapatrié ici, au moment du build :
 *   1. lecture du miroir public de Pearl App (une seule fois)
 *   2. téléchargement des images référencées vers ./images/
 *   3. écriture de ./data.json avec des chemins locaux
 *
 * Le coût d'hébergement devient donc indépendant du nombre de visiteurs.
 *
 * Les images ne sont PAS committées : elles sont récupérées à chaque build et
 * ne vivent que dans l'artefact déployé, pour ne pas alourdir le dépôt Git.
 *
 * Tolérance aux pannes : si une image ne peut pas être téléchargée, on
 * conserve son URL distante pour cette image-là plutôt que de casser le build.
 * Si le miroir est injoignable, le build échoue explicitement — mieux vaut
 * garder en ligne la version précédente qu'un site vide.
 *
 * Node 18+ requis (fetch natif). Aucune dépendance externe.
 */
import { mkdir, writeFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const DB_URL =
  process.env.PEARL_DB_URL ||
  "https://pearl-app-1ffc3-default-rtdb.europe-west1.firebasedatabase.app";

const COLLECTIONS = ["events", "news", "partners", "associations"];

/** Champs contenant une URL d'image, par collection. */
const IMAGE_FIELDS = {
  events: ["posterUrl"],
  news: ["imageUrl"],
  partners: ["imageUrl"],
  associations: ["logoUrl"],
};

const OUT_DIR = path.resolve("images");
const DATA_FILE = path.resolve("data.json");

const stats = { images: 0, echecs: 0, octets: 0 };

/** Lecture d'une collection du miroir public. */
async function fetchCollection(name) {
  const res = await fetch(`${DB_URL}/public/${name}.json`);
  if (!res.ok) throw new Error(`${name} : HTTP ${res.status}`);
  const raw = await res.json();
  if (!raw || typeof raw !== "object") return [];
  return Object.keys(raw).map((id) => ({ ...raw[id], id }));
}

/** Extension déduite du type MIME, sinon de l'URL. */
function extensionPour(contentType, url) {
  const parType = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/avif": ".avif",
    "image/gif": ".gif",
    "image/svg+xml": ".svg",
  }[(contentType || "").split(";")[0].trim()];
  if (parType) return parType;
  const m = /\.(jpe?g|png|webp|avif|gif|svg)(?:$|\?)/i.exec(url);
  return m ? `.${m[1].toLowerCase().replace("jpeg", "jpg")}` : ".jpg";
}

/**
 * Télécharge une image et renvoie son chemin local.
 * En cas d'échec, renvoie l'URL d'origine : une image servie à distance vaut
 * mieux qu'une image manquante.
 */
async function rapatrierImage(url) {
  if (!url || typeof url !== "string" || !/^https?:\/\//i.test(url)) return url;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const buffer = Buffer.from(await res.arrayBuffer());
    const nom =
      createHash("sha1").update(url).digest("hex").slice(0, 16) +
      extensionPour(res.headers.get("content-type"), url);

    await writeFile(path.join(OUT_DIR, nom), buffer);
    stats.images++;
    stats.octets += buffer.length;
    return `images/${nom}`;
  } catch (err) {
    stats.echecs++;
    console.warn(`  ⚠ image non rapatriée (${err.message}) : ${url.slice(0, 70)}`);
    return url; // repli : on garde l'URL distante pour cette image
  }
}

/* ------------------------------------------------ Dépendances tierces --- */

const VENDOR_DIR = path.resolve("vendor");
const FONTS_DIR = path.resolve("fonts");

/** React/ReactDOM : sans ça, `support.js` les charge depuis unpkg.com à chaque
 *  visite — et le site entier tombe si unpkg est indisponible. */
const VENDOR_FILES = [
  ["react.production.min.js", "https://unpkg.com/react@18.3.1/umd/react.production.min.js"],
  ["react-dom.production.min.js", "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"],
];

const FONTS_CSS_URL =
  "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@500;700;800" +
  "&family=Instrument+Sans:wght@400;500;600&display=swap";

async function rapatrierVendor() {
  await mkdir(VENDOR_DIR, { recursive: true });
  for (const [nom, url] of VENDOR_FILES) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${nom} : HTTP ${res.status}`);
    const code = Buffer.from(await res.arrayBuffer());
    await writeFile(path.join(VENDOR_DIR, nom), code);
    console.log(`  ${nom.padEnd(30)} ${(code.length / 1024).toFixed(0)} Ko`);
  }
}

/**
 * Auto-hébergement des polices : évite un appel à Google à chaque visite
 * (transmission de l'IP du visiteur — la politique de confidentialité annonce
 * qu'aucun tiers ne piste les visiteurs, autant que ce soit vrai).
 */
async function rapatrierPolices() {
  await mkdir(FONTS_DIR, { recursive: true });

  // L'User-Agent conditionne le format renvoyé : sans lui, Google sert du TTF.
  const res = await fetch(FONTS_CSS_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });
  if (!res.ok) throw new Error(`polices : HTTP ${res.status}`);
  let css = await res.text();

  const urls = [...new Set([...css.matchAll(/url\((https:\/\/[^)]+)\)/g)].map((m) => m[1]))];
  let total = 0;

  for (const url of urls) {
    const f = await fetch(url);
    if (!f.ok) throw new Error(`police ${url} : HTTP ${f.status}`);
    const buf = Buffer.from(await f.arrayBuffer());
    const nom = createHash("sha1").update(url).digest("hex").slice(0, 12) +
      (url.includes(".woff2") ? ".woff2" : ".woff");
    await writeFile(path.join(FONTS_DIR, nom), buf);
    css = css.split(url).join(`fonts/${nom}`);
    total += buf.length;
  }

  await writeFile(path.resolve("fonts.css"), css, "utf8");
  console.log(`  polices                        ${urls.length} fichier(s), ${(total / 1024).toFixed(0)} Ko`);
}

async function main() {
  console.log(`Miroir public : ${DB_URL}/public`);

  // Repartir d'un dossier propre : les images supprimées côté app ne doivent
  // pas survivre indéfiniment dans les déploiements suivants.
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  const data = {};

  for (const collection of COLLECTIONS) {
    const items = await fetchCollection(collection);
    const champs = IMAGE_FIELDS[collection] || [];

    for (const item of items) {
      for (const champ of champs) {
        if (item[champ]) item[champ] = await rapatrierImage(item[champ]);
      }
    }

    data[collection] = items;
    console.log(`  ${collection.padEnd(13)} ${items.length} entrée(s)`);
  }

  data.generatedAt = Date.now();
  await writeFile(DATA_FILE, JSON.stringify(data), "utf8");

  const mo = (stats.octets / 1048576).toFixed(2);
  console.log(
    `\ndata.json écrit — ${stats.images} image(s) rapatriée(s) (${mo} Mo)` +
      (stats.echecs ? `, ${stats.echecs} échec(s) laissé(s) en distant` : ""),
  );

  console.log("\nDépendances tierces rapatriées :");
  await rapatrierVendor();
  await rapatrierPolices();
  console.log("\nAucune requête externe au runtime.");
}

main().catch((err) => {
  // Échec franc : Netlify conserve alors le déploiement précédent en ligne.
  console.error("\nBuild interrompu :", err.message);
  process.exit(1);
});
