/* Seconde étape de la connexion au back-office.
 *
 * GitHub renvoie ici avec un code à usage unique. On l'échange, côté serveur
 * (le secret ne transite jamais par le navigateur), contre un jeton d'accès,
 * puis on transmet ce jeton à la fenêtre qui a ouvert la pop-up via
 * `postMessage`, dans le format exact qu'attend Decap CMS.
 */

/** Page renvoyée à la pop-up : elle parle à la fenêtre parente, puis se ferme. */
function pageReponse(charge, origine) {
  const message = `authorization:github:${charge.type}:${JSON.stringify(charge.contenu)}`;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Connexion…</title></head>
<body style="font-family:system-ui;background:#070a0f;color:#fff;display:grid;place-content:center;height:100vh;margin:0">
<p>Connexion en cours…</p>
<script>
  (function () {
    var message = ${JSON.stringify(message)};
    var cible = ${JSON.stringify(origine)};
    function envoyer(e) {
      // Le premier message reçu du parent confirme qu'il écoute ; on répond
      // alors avec le jeton. Ce va-et-vient est le protocole de Decap CMS.
      window.opener.postMessage(message, cible);
      window.removeEventListener("message", envoyer, false);
      setTimeout(function () { window.close(); }, 400);
    }
    window.addEventListener("message", envoyer, false);
    window.opener.postMessage("authorizing:github", cible);
  })();
</script>
</body></html>`;
}

export default async (request) => {
  const url = new URL(request.url);
  const origine = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const enTete = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" };
  const echec = (raison) =>
    new Response(pageReponse({ type: "error", contenu: { message: raison } }, origine), {
      status: 200,
      headers: enTete,
    });

  const cookies = request.headers.get("cookie") ?? "";
  const attendu = /(?:^|;\s*)cif_oauth_state=([^;]+)/.exec(cookies)?.[1];

  if (!code) return echec("Code d'autorisation manquant.");
  if (!state || state !== attendu) return echec("Jeton de sécurité invalide, recommencez la connexion.");

  const clientId = process.env.GITHUB_OAUTH_ID;
  const clientSecret = process.env.GITHUB_OAUTH_SECRET;
  if (!clientId || !clientSecret) return echec("Configuration OAuth incomplète côté serveur.");

  let jeton;
  try {
    const reponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: `${origine}/api/callback`,
      }),
    });
    const donnees = await reponse.json();
    if (donnees.error) return echec(donnees.error_description || donnees.error);
    jeton = donnees.access_token;
  } catch {
    return echec("GitHub est injoignable, réessayez dans un instant.");
  }

  if (!jeton) return echec("Aucun jeton reçu de GitHub.");

  return new Response(
    pageReponse({ type: "success", contenu: { token: jeton, provider: "github" } }, origine),
    {
      status: 200,
      headers: {
        ...enTete,
        // Le jeton d'état a servi : on l'efface.
        "Set-Cookie": "cif_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
      },
    },
  );
};

export const config = { path: "/api/callback" };
