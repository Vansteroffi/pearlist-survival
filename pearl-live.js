/* Pearlist — couche de données du site vitrine.
 *
 * Lit `data.json`, un fichier LOCAL généré au moment du build par `build.mjs`
 * (qui interroge une seule fois le miroir public de Pearl App et rapatrie les
 * images dans ./images/).
 *
 * Conséquence recherchée : un visiteur ne déclenche aucune requête vers
 * Firebase ni Cloudinary. Le coût d'hébergement ne dépend donc pas du nombre de
 * visites — seule la bande passante Netlify est sollicitée.
 *
 * Si `data.json` est absent ou illisible, chaque lecture renvoie une liste vide
 * et les pages affichent leurs états « rien à afficher » au lieu de casser.
 */
window.PearlLive = (function () {
  "use strict";

  var DATA_URL = "data.json";

  var MONTHS = ["JANV.", "FÉVR.", "MARS", "AVR.", "MAI", "JUIN",
                "JUIL.", "AOÛT", "SEPT.", "OCT.", "NOV.", "DÉC."];
  var WEEKDAYS = ["DIM.", "LUN.", "MAR.", "MER.", "JEU.", "VEN.", "SAM."];

  /* ---------------------------------------------------------------- Lecture */

  var _donnees = null; // promesse mise en cache : un seul chargement par page

  function chargerTout() {
    if (!_donnees) {
      _donnees = fetch(DATA_URL)
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        })
        .catch(function (err) {
          console.warn("[Pearlist] data.json illisible :", err.message);
          return {};
        });
    }
    return _donnees;
  }

  function fetchCollection(name) {
    return chargerTout().then(function (d) {
      return Array.isArray(d[name]) ? d[name] : [];
    });
  }

  /** load(["events","news"]) → Promise<{ events: [...], news: [...] }> */
  function load(names) {
    return chargerTout().then(function (d) {
      var out = {};
      names.forEach(function (name) {
        out[name] = Array.isArray(d[name]) ? d[name] : [];
      });
      return out;
    });
  }

  /* ------------------------------------------------------- Dates & horaires */

  /** Même règle que l'application : seul un `startAt` numérique fait foi. */
  function hasRealDate(ev) {
    return ev && typeof ev.startAt === "number";
  }

  /** "24 SEPT. 2026" */
  function shortDate(ts) {
    if (typeof ts !== "number") return "";
    var d = new Date(ts);
    return d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
  }

  /** "JEU. 24 SEPT. 2026 · 19H" */
  function longDate(ts) {
    if (typeof ts !== "number") return "";
    var d = new Date(ts);
    return WEEKDAYS[d.getDay()] + " " + shortDate(ts) + " · " + hour(ts).toUpperCase();
  }

  /** "19h" / "19h30" */
  function hour(ts) {
    if (typeof ts !== "number") return "";
    var d = new Date(ts);
    var m = d.getMinutes();
    return d.getHours() + "h" + (m ? String(m).padStart(2, "0") : "");
  }

  /** Pastille date des cartes Événements. */
  function dateBadge(ev) {
    if (!hasRealDate(ev)) return { day: "", month: "", year: "" };
    var d = new Date(ev.startAt);
    return {
      day: String(d.getDate()).padStart(2, "0"),
      month: MONTHS[d.getMonth()],
      year: String(d.getFullYear()),
    };
  }

  /* --------------------------------------------------------- Tri des events */

  /** Chronologique ; les events sans date réelle finissent en queue. */
  function sortEvents(list) {
    return list.slice().sort(function (a, b) {
      var aHas = hasRealDate(a), bHas = hasRealDate(b);
      if (aHas && bHas) return a.startAt - b.startAt;
      if (aHas) return -1;
      if (bHas) return 1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }

  /**
   * Sépare « à venir » et « archives ».
   * Un événement sans `startAt` est un vestige d'avant le sélecteur de date :
   * il part en archives, car afficher par erreur une soirée passée comme
   * « à venir » ferait se déplacer des étudiants pour rien.
   */
  function splitEvents(list) {
    var now = Date.now();
    var upcoming = [], pastDated = [], undated = [];

    sortEvents(list).forEach(function (ev) {
      if (!hasRealDate(ev)) undated.push(ev);
      else if (ev.startAt >= now) upcoming.push(ev);
      else pastDated.push(ev);
    });

    pastDated.reverse(); // archives : la plus récente en premier
    // Les events sans date passent en dernier : sans horodatage, on ne peut pas
    // prétendre qu'ils sont récents.
    return { upcoming: upcoming, past: pastDated.concat(undated) };
  }

  function nextEvent(list) {
    return splitEvents(list).upcoming[0] || null;
  }

  /* ------------------------------------------------------------- Formatage  */

  /** "GRATUIT", sinon le tarif saisi, sinon rien. */
  function priceLabel(ev) {
    if (ev.isFree) return "GRATUIT";
    return ev.price ? String(ev.price) : "";
  }

  /** Repli d'affichage pour les events sans date réelle. */
  function scheduleLabel(ev) {
    if (hasRealDate(ev)) {
      return ev.timeLabel ? hour(ev.startAt) + " · " + ev.timeLabel : hour(ev.startAt);
    }
    return [ev.dateLabel, ev.timeLabel].filter(Boolean).join(" · ");
  }

  /** "Café Central" → "CC" (2 lettres max). */
  function initials(name) {
    if (!name) return "?";
    return String(name).trim().split(/\s+/).slice(0, 2)
      .map(function (w) { return w.charAt(0).toUpperCase(); }).join("");
  }

  /** Résumé court pour les cartes. */
  function excerpt(text, max) {
    if (!text) return "";
    var clean = String(text).replace(/\s+/g, " ").trim();
    var limit = max || 140;
    if (clean.length <= limit) return clean;
    var cut = clean.slice(0, limit);
    var lastSpace = cut.lastIndexOf(" ");
    return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut) + "…";
  }

  /** Découpe un texte libre en paragraphes pour la lecture d'un article. */
  function paragraphs(text) {
    if (!text) return [];
    return String(text).split(/\n\s*\n|\n/).map(function (p) { return p.trim(); })
      .filter(Boolean);
  }

  /**
   * Style de fond d'une vignette : la vraie image si elle existe, sinon les
   * rayures de remplissage déjà utilisées dans la maquette.
   */
  function cover(url, stripe) {
    var fallback = stripe ||
      "repeating-linear-gradient(45deg, #232323 0 12px, #1E1E1E 12px 24px)";
    if (!url) return { background: fallback };
    return {
      backgroundImage: "url(" + url + ")",
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundColor: "#1E1E1E",
    };
  }

  return {
    load: load,
    fetchCollection: fetchCollection,
    hasRealDate: hasRealDate,
    shortDate: shortDate,
    longDate: longDate,
    hour: hour,
    dateBadge: dateBadge,
    sortEvents: sortEvents,
    splitEvents: splitEvents,
    nextEvent: nextEvent,
    priceLabel: priceLabel,
    scheduleLabel: scheduleLabel,
    initials: initials,
    excerpt: excerpt,
    paragraphs: paragraphs,
    cover: cover,
  };
})();
