# Hylo Monorepo

Thanks for checking out our code. The documentation below may be incomplete or incorrect. We welcome pull requests! But we're a very small team, so we can't guarantee timely responses.

:heart:, [Tibet](https://github.com/tibetsprague), [Loren](https://github.com/lorenjohnson), [Tom](https://github.com/thomasgwatson)

[![Code Climate](https://codeclimate.com/github/Hylozoic/hylo-node/badges/gpa.svg)](https://codeclimate.com/github/Hylozoic/hylo-node) [![Test Coverage](https://codeclimate.com/github/Hylozoic/hylo-node/badges/coverage.svg)](https://codeclimate.com/github/Hylozoic/hylo-node/coverage)

## Quick Start

1. Use nvm to install the correct version of node. Once installed you can just do `nvm install` to ensure the correct version is installed and then `nvm use`

2. Install yarn and foreman

```shell
npm install -g yarn foreman
```

3. Install dependencies

```shell
yarn install
```

4. Build shared packages

```shell
yarn build-packages
```

5. Backend specific setup [here](./apps/backend/README.md)

6. Web/frontend specific setup [here](./apps/web/README.md)

7. Once the back-end and front-end are setup you can run the app locally with:
Terminal 1:
```shell
yarn backend:dev
```

Terminal 2:
```shell
yarn web:dev
```

8. Mobile specific setup [here](./apps/mobile/README.md)

9. Desktop specific setup [here](./apps/desktop/README.md)

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

2. Merged in Hylo Backend, Web, and Mobile keeping history:

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
