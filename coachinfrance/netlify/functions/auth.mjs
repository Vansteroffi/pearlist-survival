/* Première étape de la connexion au back-office.
 *
 * Decap CMS ouvre cette adresse dans une fenêtre pop-up ; on renvoie
 * l'utilisateur vers GitHub, qui lui demandera d'autoriser l'application. Le
 * `state` est un jeton aléatoire déposé en cookie : au retour, on vérifie qu'il
 * correspond, ce qui empêche un site tiers de déclencher la connexion à notre
 * place (CSRF).
 *
 * Variables d'environnement attendues (Netlify → Site settings → Environment) :
 *   GITHUB_OAUTH_ID     — Client ID de l'application OAuth GitHub
 *   GITHUB_OAUTH_SECRET — Client secret de cette même application
 */
export default async (request) => {
  const clientId = process.env.GITHUB_OAUTH_ID;
  if (!clientId) {
    return new Response(
      "Configuration incomplète : la variable GITHUB_OAUTH_ID est absente.",
      { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }

  const origine = new URL(request.url).origin;
  const state = crypto.randomUUID();

  const destination = new URL("https://github.com/login/oauth/authorize");
  destination.searchParams.set("client_id", clientId);
  destination.searchParams.set("redirect_uri", `${origine}/api/callback`);
  // `repo` est le périmètre minimal permettant d'écrire dans un dépôt privé.
  destination.searchParams.set("scope", "repo,user");
  destination.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: destination.toString(),
      "Set-Cookie": `cif_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
      "Cache-Control": "no-store",
    },
  });
};

export const config = { path: "/api/auth" };
