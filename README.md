# DeskFlow

DeskFlow est une application interne de gestion des demandes d’assistance. Elle comprend une interface React/TypeScript, une API Go/Gin et une base de données PostgreSQL.

## Structure du dépôt

- `frontend/` : interface React/Vite, déployée séparément sur Vercel.
- `backend/` : API Go/Gin et migrations PostgreSQL, déployées sur Render.
- `render.yaml` : configuration Render pour l’API et sa base PostgreSQL.
- `docker-compose.yml` : lancement local de l’application complète.

## Déploiement séparé sur Render et Vercel

### API et base PostgreSQL sur Render

1. Sur Render, créez un Blueprint depuis ce dépôt et choisissez le fichier `render.yaml` à la racine.
2. Renseignez `ADMIN_EMAIL`, `ADMIN_PASSWORD` et `CORS_ALLOWED_ORIGINS` lorsque Render le demande. Choisissez un mot de passe administrateur unique d’au moins 12 caractères. Pour `CORS_ALLOWED_ORIGINS`, indiquez l’origine Vercel exacte, par exemple `https://deskflow.vercel.app` (sans chemin ni barre oblique finale). Vous pourrez la modifier après avoir créé le projet Vercel.
3. Le Blueprint crée le service web `deskflow-api` et une base PostgreSQL. Render fournit `DATABASE_URL` et `PORT`; l’API les utilise automatiquement. Attendez que le contrôle de santé `/api/v1/health` soit vert, puis copiez l’URL publique du service Render.

### Frontend sur Vercel

1. Importez le même dépôt dans Vercel et définissez **Root Directory** sur `frontend`.
2. Utilisez les paramètres Vite détectés automatiquement (`npm run build`, sortie `dist`).
3. Ajoutez la variable d’environnement `VITE_API_URL` pour les environnements de déploiement, avec l’URL Render suivie de `/api/v1`, par exemple `https://deskflow-api.onrender.com/api/v1`. La même valeur est documentée dans `frontend/.env.example`.
4. Déployez, puis vérifiez que `CORS_ALLOWED_ORIGINS` sur Render correspond exactement à l’origine de production Vercel. Ajoutez également les origines de prévisualisation uniquement si vous souhaitez autoriser ces déploiements.

Les appels du frontend vers l’API sont directs : `VITE_API_URL` doit être défini au moment du build et l’origine Vercel doit être explicitement autorisée par `CORS_ALLOWED_ORIGINS`. Les identifiants PostgreSQL, le secret JWT et les identifiants SMTP restent configurés côté Render; ne placez jamais ces secrets dans les variables `VITE_*`.

## Pourquoi `/api/v1/tickets` affiche-t-il « authorization required » ?

`/api/v1/tickets` est une route d’API, pas une page web. Elle renvoie des données JSON et nécessite une authentification. Le message `{"error":"authorization required"}` est donc attendu si la requête ne contient pas de jeton d’accès valide.

Pour afficher l’application dans un navigateur, ouvrez plutôt :

- Avec Docker Compose : `http://localhost/tickets` (ou `http://localhost:<HTTP_PORT>/tickets` si le port a été modifié).
- En développement local : `http://localhost:3000/tickets` après `npm run dev`.

Pour appeler l’API, connectez-vous d’abord avec `POST /api/v1/auth/login`, puis transmettez le jeton reçu dans l’en-tête `Authorization` avec le schéma d’authentification Bearer pour chaque requête protégée. Par exemple, `GET /api/v1/tickets` renvoie les demandes accessibles à l’utilisateur connecté.

## Déploiement avec Docker Compose

Prérequis : Docker Engine et Docker Compose .

1. Depuis le dossier racine du projet (celui qui contient ce fichier), copiez `.env.example` vers `.env` si ce dernier n’existe pas :

   ```powershell
   Copy-Item .env.example .env
   ```

2. Définissez des valeurs uniques pour `POSTGRES_PASSWORD`, `JWT_SECRET` (au moins 32 caractères), `ADMIN_EMAIL` et `ADMIN_PASSWORD` (au moins 12 caractères). Ne committez jamais le fichier `.env`.
3. Construisez et démarrez l’application :

   ```powershell
   docker compose --env-file .env up --build -d
   ```

   Exécutez cette commande depuis la racine du projet, et non depuis `backend`. Le fichier Compose et le fichier `.env` se trouvent à la racine.

4. Ouvrez `http://localhost` (ou `http://localhost:<HTTP_PORT>` si vous avez modifié le port). Connectez-vous sur `/login` avec `ADMIN_EMAIL` et `ADMIN_PASSWORD` définis dans `.env`. Le compte administrateur est créé au premier démarrage de l’API. L’inscription est disponible sur `/register`.

Si Compose indique que `POSTGRES_PASSWORD` est manquant, vérifiez que `.env` existe à la racine et que les quatre variables obligatoires ont une valeur. La route d’API `http://localhost/api/v1/auth/login` reçoit une requête POST : ce n’est pas la page de connexion du navigateur.

Le conteneur frontend sert la version de production et relaie les requêtes `/api/` vers l’API Go. PostgreSQL n’est pas exposé publiquement dans ce déploiement. Les données sont conservées dans le volume Docker `deskflow_postgres`. `docker compose down` conserve les données ; `docker compose down -v` les supprime.

Les routes web `/login`, `/register`, `/tickets`, `/my-assigned` et `/admin` sont servies par le frontend. La navigation et les boutons précédent/suivant du navigateur mettent l’URL à jour ; recharger une route continue de servir l’application frontend.

Pour un déploiement public, terminez HTTPS sur un proxy inverse ou un répartiteur de charge de confiance, limitez le trafic entrant à ce proxy, utilisez des secrets uniques et robustes, et configurez des sauvegardes de la base de données avant d’y stocker des données réelles.

## Développement local

Démarrez PostgreSQL et l’API avec les paramètres sécurisés de `.env`, puis lancez le frontend depuis son dossier :

```sh
cd frontend
npm ci
npm run dev
```

Le serveur de développement Vite est disponible sur `http://localhost:3000` et relaie `/api/` vers `http://localhost:8081` par défaut. Définissez `API_PROXY_TARGET` si l’API est hébergée ailleurs.

Vérifications frontend :

```powershell
cd frontend
npm run lint
npm run build
```

Vérifications backend :

```powershell
cd backend
go test ./...
```

## API

Préfixe de base : `/api/v1`.

- `GET /health`
- `POST /auth/register`, `POST /auth/login`, `POST /auth/password-reset/request`, `POST /auth/password-reset/confirm`, `GET /auth/me`, `PUT /auth/me/profile`
- `GET /tickets`, `POST /tickets`, `GET /tickets/:id`
- `GET /tickets/:id/attachments/:attachmentID` (image jointe, accessible aux personnes autorisées à consulter la demande)
- `GET /tickets/sla/:category`
- `POST /tickets/:id/comments`, `POST /tickets/:id/take`, `PUT /tickets/:id/status`
- `GET /departments` (liste publique utilisée lors de l’inscription)
- `GET /admin/metrics`, `GET /admin/users`, `POST /admin/users`
- `POST /admin/departments`, `PUT /admin/departments/:name`, `DELETE /admin/departments/:name`
- `PUT /admin/users/:id/password`, `PUT /admin/users/:id/role`, `PUT /admin/users/:id/department`, `PATCH /admin/users/:id/active`
- `POST /admin/tickets/:id/assign`, `POST /admin/tickets/:id/approval`, `DELETE /admin/tickets/:id`

Toutes les routes, sauf `GET /health`, `GET /departments`, l’inscription et la connexion, nécessitent un jeton Bearer valide. La gestion des départements est réservée aux administrateurs : un département utilisé ne peut pas être supprimé, et son renommage met à jour les comptes et les demandes existants. Les rôles et les autorisations de consultation des demandes sont contrôlés par l’API, pas uniquement par le frontend.

Un utilisateur peut modifier son nom, son adresse e-mail et son matricule depuis son profil. Seuls les administrateurs peuvent consulter les détails des comptes et définir le mot de passe d’un autre utilisateur. Les mots de passe doivent contenir au moins huit caractères et leurs empreintes ne sont jamais renvoyées par l’API.

Les échéances des demandes sont calculées par l’API selon la catégorie et les règles SLA configurées : réseau (2 h), matériel/accès (8 h), logiciel (24 h) et demande générale (72 h). Le formulaire affiche au demandeur le temps maximum sous la forme « 8 heures maximum ». Les demandes d’un Chef de Service utilisent le délai urgent. Le demandeur ne peut pas choisir ni modifier la catégorie après création. Les demandes sont automatiquement affectées à un technicien disponible, en privilégiant l’échéance la plus proche ; un technicien ne peut pas prendre une deuxième demande active avant d’avoir terminé la première. Le personnel de support peut aussi affecter manuellement une demande à un technicien disponible.

Chaque ticket possède une référence courte unique au format `TCK-XXXXX`. Les anciennes références sont converties au premier démarrage de l’API. Si la résolution ne satisfait pas le demandeur, celui-ci peut relancer le même ticket depuis son détail ; la demande retourne dans la file d’attente sans qu’un nouveau ticket soit créé.

Configurez `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` et `SMTP_FROM` dans `.env` pour activer les codes de réinitialisation de mot de passe ainsi que les notifications de résolution et de rejet. Le serveur SMTP doit prendre en charge STARTTLS (ou TLS implicite sur le port 465). Les codes de réinitialisation expirent après 15 minutes, autorisent cinq tentatives et ne peuvent être demandés qu’une fois tous les 30 jours par compte.

Lorsqu’une demande est résolue ou rejetée, un message est ajouté à ses échanges dans l’application et le demandeur reçoit aussi un e-mail. L’application actualise périodiquement les demandes pour afficher une notification lorsque le demandeur est connecté. L’envoi des e-mails nécessite une configuration SMTP valide.

Définissez `TRUSTED_PROXIES` avec les plages CIDR réelles du proxy inverse ou du proxy Docker afin que les adresses client provenant des en-têtes de transfert ne soient acceptées que depuis des proxys de confiance. L’exemple Compose utilise le sous-réseau privé Docker.

Le panneau d’administration propose des filtres par département, statut, période et SLA, notamment pour repérer les demandes résolues en retard. Il affiche également, aux administrateurs uniquement, la dernière adresse IP connue de chaque compte et l’heure de sa dernière activité. Les requêtes authentifiées actualisent cette adresse IP ; l’historique des demandes conserve l’IP lors de leur création, affectation et changement de statut.

Lors de la déclaration d’une demande, l’utilisateur peut joindre jusqu’à cinq photos JPEG, PNG, GIF ou WebP, de 5 Mo maximum chacune. Les images sont stockées dans PostgreSQL et ne sont consultables que par les utilisateurs autorisés à voir la demande.

La vue générale de l’administration permet d’exporter le palmarès des techniciens au format CSV, avec le nombre de demandes résolues et actives, le respect du SLA et la disponibilité.

L’interface choisit par défaut le français ou l’anglais selon la langue du navigateur. Le sélecteur permet de changer de langue et le choix est enregistré dans le navigateur.
