# Coach in France — site & back-office

Site vitrine de Coach in France (organisme de formation et CFA spécialisé dans
le sport, Vannes) avec un espace d'administration permettant à l'équipe de
publier elle-même actualités, interviews, fiches formation et partenaires.

**Coût d'hébergement : 0 €.** Le site est entièrement statique : chaque page est
un fichier HTML généré à l'avance. Il n'y a ni base de données, ni serveur à
maintenir, ni abonnement mensuel.

---

## 1. Ce que contient le projet

| Dossier | Rôle |
|---|---|
| `src/pages/` | Les pages du site |
| `src/components/` | Les briques réutilisées (cartes, en-têtes, pied de page) |
| `src/content/` | **Les contenus rédigés depuis le back-office** (un fichier = un article) |
| `src/styles/global.css` | Couleurs, typographies, espacements — toute l'identité visuelle |
| `public/admin/` | L'espace d'administration |
| `public/uploads/` | Les images déposées depuis l'administration |
| `netlify/functions/` | La connexion sécurisée du back-office à GitHub |

---

## 2. Mise en ligne (à faire une seule fois)

### a. Créer le dépôt

Le code doit vivre dans un dépôt GitHub, par exemple `Vansteroffi/coachinfrance`.

### b. Brancher Netlify

1. Créer un compte gratuit sur [netlify.com](https://www.netlify.com).
2. **Add new site → Import an existing project → GitHub**, choisir le dépôt.
3. Netlify lit `netlify.toml` : la commande de build et le dossier à publier
   sont déjà configurés, il n'y a rien à saisir.
4. Noter l'adresse attribuée, du type `coachinfrance.netlify.app`.

### c. Créer l'application GitHub qui autorise la connexion au back-office

1. Sur GitHub : **Settings → Developer settings → OAuth Apps → New OAuth App**.
2. Remplir :
   - *Application name* : `Coach in France — administration`
   - *Homepage URL* : l'adresse Netlify notée plus haut
   - *Authorization callback URL* : cette même adresse suivie de `/api/callback`
3. Générer un *client secret* et garder les deux valeurs sous la main.
4. Dans Netlify : **Site settings → Environment variables**, ajouter :
   - `GITHUB_OAUTH_ID` = le Client ID
   - `GITHUB_OAUTH_SECRET` = le Client secret
5. Relancer un déploiement (**Deploys → Trigger deploy**).

### d. Ajuster deux lignes de configuration

Dans `public/admin/config.yml` :

```yaml
repo: Vansteroffi/coachinfrance          # le vrai nom du dépôt
base_url: https://coachinfrance.netlify.app  # la vraie adresse du site
```

### e. Brancher le nom de domaine

Dans Netlify : **Domain management → Add a domain**, saisir `coachinfrance.fr`,
puis suivre les instructions pour pointer le domaine vers Netlify. Le
certificat HTTPS est délivré automatiquement et gratuitement.

> ⚠️ Tant que le nouveau site n'est pas validé, ne pas basculer le domaine :
> le site actuel doit rester en ligne.

---

## 3. Publier un contenu (pour l'équipe)

1. Aller sur `https://www.coachinfrance.fr/admin`.
2. Cliquer sur **Login with GitHub** et se connecter avec un compte GitHub
   ayant accès au dépôt.
3. Choisir une rubrique — Actualités, Interviews, Formations, Partenaires —
   puis **New**.
4. Remplir le formulaire. Chaque champ porte une explication sous son libellé.
5. **Save** enregistre un brouillon, **Publish** met en ligne.
6. La mise en ligne prend environ une minute : le site se reconstruit tout seul.

Deux façons de garder un contenu invisible :

- la case **Brouillon** dans le formulaire — le contenu existe mais ne sort pas ;
- le statut *Draft / In review* du flux éditorial, en haut de l'écran.

### Ajouter une personne à l'administration

Il suffit de lui donner accès au dépôt GitHub :
**Settings → Collaborators → Add people**. Aucun mot de passe à gérer de notre
côté.

---

## 4. Les demandes du formulaire de contact

Elles arrivent via **Netlify Forms** :
**Netlify → Forms → candidature**. Pour recevoir une alerte par e-mail à chaque
envoi : **Forms → Settings and usage → Form notifications → Add notification →
Email notification**.

Le formulaire est protégé par un champ piège invisible qui filtre l'essentiel
du spam automatisé.

---

## 5. Travailler sur le site (développement)

```bash
npm install     # une seule fois
npm run dev     # site sur http://localhost:4321
npm run build   # génère le site final dans dist/
```

Pour tester le back-office en local sans toucher au dépôt distant :

```bash
npx decap-server   # dans un second terminal
npm run dev        # puis ouvrir http://localhost:4321/admin
```

---

## 6. Ce qui reste à compléter

Le contenu de l'ancien site n'a pas pu être récupéré automatiquement. Cherchez
la mention **`À COMPLÉTER`** dans le projet pour trouver tout ce qui attend une
information réelle :

```bash
grep -rn "À COMPLÉTER" src netlify.toml
```

Principaux points en attente :

- [ ] Textes réels et photos des cinq fiches formation
- [ ] Indicateurs de résultats Qualiopi (taux de réussite, d'insertion, de rupture)
- [ ] Numéros légaux : SIRET, RCS, TVA, déclaration d'activité, certificat Qualiopi
- [ ] Numéro de téléphone du centre (`src/lib/site.ts`)
- [ ] Contenu réel des CGV (le PDF existe déjà sur l'ancien site)
- [ ] Coordonnées du référent handicap
- [ ] Logos des clubs partenaires
- [ ] Liste complète des anciennes adresses `.php` à rediriger (`netlify.toml`)
- [ ] Image de partage `public/og-default.jpg` (1200 × 630 px)
