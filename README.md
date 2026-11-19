# Hylo Monorepo

Thanks for checking out our code. The documentation below may be incomplete or incorrect. We welcome pull requests! But we're a very small team, so we can't guarantee timely responses.

:heart:, [Tibet](https://github.com/tibetsprague), [Loren](https://github.com/lorenjohnson), [Tom](https://github.com/thomasgwatson)

[![Code Climate](https://codeclimate.com/github/Hylozoic/hylo-node/badges/gpa.svg)](https://codeclimate.com/github/Hylozoic/hylo-node) [![Test Coverage](https://codeclimate.com/github/Hylozoic/hylo-node/badges/coverage.svg)](https://codeclimate.com/github/Hylozoic/hylo-node/coverage)

## Quick Start

Docker is the only requirement for the full stack. A second mode runs Postgres and Redis in Docker and Node on your machine, which reloads faster while you edit.

### Full Docker

```shell
docker compose up
```

`yarn docker:up` is the same command. The first run installs dependencies, creates `apps/backend/.env`, `apps/backend/.env.test`, and `apps/web/.env` when they are missing, generates `OIDC_KEYS`, loads the schema, and seeds a small dataset. Existing env files are not overwritten. The API (port 3001), the background worker, and the web app (port 3000) stay up and reload when you edit code.

Open http://localhost:3000 and log in as `test@hylo.com` / `hylo`.

A larger dataset (1,000 users and 5,000 posts) applies only when the database is empty:

```shell
HYLO_SEED=large docker compose up
```

To wipe the database and seed it again:

```shell
yarn docker:reset-db
HYLO_SEED=large yarn docker:reset-db
```

Running `docker compose up` again skips the seed when the database already has data.

### Postgres and Redis in Docker, Node on the host

Install Node 24 (`nvm install` from the repo root) and enable Yarn via Corepack (`corepack enable`).

```shell
yarn docker:services
yarn setup
```

Then, in two terminals:

```shell
yarn backend:dev
yarn web:dev
```

`yarn setup` is safe to re-run. It will not overwrite an existing `.env`. If that file was created for a Postgres you installed yourself, point it at the Docker database before using this stack:

```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/hylo
REDIS_URL=redis://localhost:6379
```

Backend details are in [apps/backend/README.md](./apps/backend/README.md), web details in [apps/web/README.md](./apps/web/README.md).

### Optional third-party keys

The app boots without these. Add them to the env files when you need the feature:

- **Mapbox** (`MAPBOX_TOKEN` in the backend `.env`, `VITE_MAPBOX_TOKEN` in the web `.env`): maps and location search
- **Filestack** (`VITE_FILESTACK_API_KEY`): file uploads
- **SendWithUs** (`SENDWITHUS_KEY`): outbound email
- **Stripe** (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `VITE_STRIPE_CLIENT_ID`): payments
- **Virtuoso** (`VITE_VIRTUOSO_KEY`): removes the license watermark on chat. Chat still works without it

Ask a Hylo developer for shared dev tokens.

### Ports already in use

`yarn docker:services` publishes the web, API, and inspector ports on random host ports. Nothing listens on them in that mode, and it leaves 3000 and 3001 free for `yarn web:dev` and `yarn backend:dev`. `docker compose up` publishes 3000, 3001, and 3002 directly, because the app is inside Docker then.

`HYLO_DB_PORT` changes the Postgres port on your machine (the default is 5432). Inside Docker, Postgres is still on 5432, and the generated `DATABASE_URL` uses 5432, which is what `docker compose up` needs. If you use `yarn docker:services` with a custom port, point `DATABASE_URL` at that port. Setup will not rewrite an env file that already exists.

Redis is published on 6379. Stop a local Redis first, or change that mapping in `docker-compose.yml` and `REDIS_URL` together.

### Mobile and desktop

Neither runs inside Docker. Both expect the API on port 3001 and the web app on port 3000, which this stack provides.

- Mobile: [apps/mobile-leap/README.md](./apps/mobile-leap/README.md)
- Desktop: [apps/desktop/README.md](./apps/desktop/README.md)

## Details on the setup of this Monorepo

How we got here:

1. Created bare nx monorepo:

```
npx create-nx-workspace hylo --workspaceType integrated  --preset ts --packageManager yarn --useGitHub --nxCloud skip
cd hylo
npx nx add @nx/node
npx nx add @nx/react
npx nx add @nx/react-native
git commit -a -m "Add base nx plugins"
```

2. Merged in old repos for Hylo Backend, Web, and Mobile keeping history:

Prepare individual legacy repos to be merged, and then merge into the monorepo using this sequence for each app (https://nx.dev/recipes/adopting-nx/preserving-git-histories):

```
cd <hylo-node|hylo-evo|HyloReactNative|hylo-shared>
git pull
git checkout -b monorepo-setup

# assuming this repo is checked out at ../hylo relative to the legacy repo root,
# where apps/web could be apps/<web|backend|mobile> or libs/shared
../hylo/move-mono.sh

git commit -m "Move files in preparation for monorepo migration (<backend|web|mobile|hylo-shared>)"
git push -u

# then merge each repo into the new monorepo generated above
cd ../hylo
git remote add <backend|web|mobile|shared> <repository url>
git fetch <backend|web|mobile|shared>
git merge <backend|web|mobile|shared>/monorepo-setup --allow-unrelated-histories
```

1. Tried some yarn workspaces / monorepo stuff:

* Goal: `nx run-many -t dev` to start every app in dev mode at once... This should "just work" if we add `dev` to scripts in each app's `package.json` set to do the right thing.
* Goal: `nx release prerelease --first-release --dry-run` gives us expected results... MOSTLY DOES now, however needs to configure this to what we really want.
  - Need to configure versioning for React Native such that more than just `package.json` is updated (like `react-native-version` already does, likely can still use that)
  - Are we good with moving to Conventional Commits format for all our commits (or standardizing on squash commits and always using CC for our squash commit messages)?
* Question: pnpm is somewhat the new hotness and shouldn't be difficult to switch to, also pnpm+nx is said to be a great combination. Do we switch to this?

Remaining work:
* Update CircleCI configuration for web and backend, including getting yarn berry working there
* CircleCI and Bitrise triggers, etc configuration update for new paths

----

### Linting

Since this is a monorepo, your IDE will need to be setup to make sure the linting files for each of the apps and packages is respected.

For example, for VS Code based IDEs: https://stackoverflow.com/questions/60178254/vscode-eslint-configuration-for-a-two-projects-workspace
