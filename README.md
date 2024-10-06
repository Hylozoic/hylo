# Hylo Monorepo

**THIS REPOS IN ITS CURRENT STATE WAS THE RESULT OF THESE COMMANDS:**

1. Created bare nx monorepo:

```
npx create-nx-workspace hylo --workspaceType integrated  --preset ts --packageManager yarn --useGitHub --nxCloud skip
cd hylo
npx nx add @nx/node
npx nx add @nx/react
npx nx add @nx/react-native
git commit -a -m "Add base nx plugins"
```

2. Merged in Hylo API, Web, and Mobile keeping history:

Prepare individual legacy repos to be merged, and then merge into the monorepo using this sequence for each app (https://nx.dev/recipes/adopting-nx/preserving-git-histories):

```
cd <hylo-node|hylo-evo|HyloReactNative|hylo-shared>
git pull
git checkout -b monorepo-setup

# assuming this repo is checked out at ../hylo relative to the legacy repo root,
# where apps/web could be apps/<web|api|mobile> or libs/shared
../hylo/move-mono.sh

git commit -m "Move files in preparation for monorepo migration (<api|web|mobile|hylo-shared>)"
git push -u

# then merge each repo into the new monorepo generated above
cd ../hylo
git remote add <api|web|mobile|shared> <repository url>
git fetch <api|web|mobile|shared>
git merge <api|web|mobile|shared>/monorepo-setup --allow-unrelated-histories
```

1. Tried some yarn workspaces / monorepo stuff:

* Goal: `nx run-many -t dev` to start every app in dev mode at once... This should "just work" if we add `dev` to scripts in each app's `package.json` set to do the right thing.
* Goal: `nx release prerelease --first-release --dry-run` gives us expected results... MOSTLY DOES now, however needs to configure this to what we really want.
  - Need to configure versioning for React Native such that more than just `package.json` is updated (like `react-native-version` already does, likely can still use that)
  - Are we good with moving to Conventional Commits format for all our commits (or standardizing on squash commits and always using CC for our squash commit messages)?
* Question: pnpm is somewhat the new hotness and shouldn't be difficult to switch to, also pnpm+nx is said to be a great combination. Do we switch to this?

Remaining work:
* Get apps/api (hylo-node) working in a modules environment as it is a blended CommonJS and ESM project currently
* Get apps/mobile issues resolved around babel parsing emoji data, etc
* CircleCI configuration to work with yarn berry, and new directory structure
* CircleCI and Bitrise triggers, etc configuration update for new paths

----
*nx-generated README follows*# Hylo

<a alt="Nx logo" href="https://nx.dev" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png" width="45"></a>

✨ Your new, shiny [Nx workspace](https://nx.dev) is ready ✨.

[Learn more about this workspace setup and its capabilities](https://nx.dev/nx-api/js?utm_source=nx_project&amp;utm_medium=readme&amp;utm_campaign=nx_projects) or run `npx nx graph` to visually explore what was created. Now, let's get you up to speed!

## Run tasks

To run tasks with Nx use:

```sh
npx nx <target> <project-name>
```

For example:

```sh
npx nx build myproject
```

These targets are either [inferred automatically](https://nx.dev/concepts/inferred-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) or defined in the `project.json` or `package.json` files.

[More about running tasks in the docs &raquo;](https://nx.dev/features/run-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Versioning and releasing

To version and release the library use

```
npx nx release
```

Pass `--dry-run` to see what would happen without actually releasing the library.

[Learn more about Nx release &raquo;](hhttps://nx.dev/features/manage-releases?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Add new projects

While you could add new projects to your workspace manually, you might want to leverage [Nx plugins](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) and their [code generation](https://nx.dev/features/generate-code?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) feature.

To install a new plugin you can use the `nx add` command. Here's an example of adding the React plugin:
```sh
npx nx add @nx/react
```

Use the plugin's generator to create new projects. For example, to create a new React app or library:

```sh
# Genenerate an app
npx nx g @nx/react:app demo

# Generate a library
npx nx g @nx/react:lib some-lib
```

You can use `npx nx list` to get a list of installed plugins. Then, run `npx nx list <plugin-name>` to learn about more specific capabilities of a particular plugin. Alternatively, [install Nx Console](https://nx.dev/getting-started/editor-setup?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) to browse plugins and generators in your IDE.

[Learn more about Nx plugins &raquo;](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) | [Browse the plugin registry &raquo;](https://nx.dev/plugin-registry?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Set up CI!

### Step 1

To connect to Nx Cloud, run the following command:

```sh
npx nx connect
```

Connecting to Nx Cloud ensures a [fast and scalable CI](https://nx.dev/ci/intro/why-nx-cloud?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) pipeline. It includes features such as:

- [Remote caching](https://nx.dev/ci/features/remote-cache?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Task distribution across multiple machines](https://nx.dev/ci/features/distribute-task-execution?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Automated e2e test splitting](https://nx.dev/ci/features/split-e2e-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Task flakiness detection and rerunning](https://nx.dev/ci/features/flaky-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

### Step 2

Use the following command to configure a CI workflow for your workspace:

```sh
npx nx g ci-workflow
```

[Learn more about Nx on CI](https://nx.dev/ci/intro/ci-with-nx#ready-get-started-with-your-provider?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Install Nx Console

Nx Console is an editor extension that enriches your developer experience. It lets you run tasks, generate code, and improves code autocompletion in your IDE. It is available for VSCode and IntelliJ.

[Install Nx Console &raquo;](https://nx.dev/getting-started/editor-setup?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Useful links

Learn more:

- [Learn more about this workspace setup](https://nx.dev/nx-api/js?utm_source=nx_project&amp;utm_medium=readme&amp;utm_campaign=nx_projects)
- [Learn about Nx on CI](https://nx.dev/ci/intro/ci-with-nx?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Releasing Packages with Nx release](https://nx.dev/features/manage-releases?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [What are Nx plugins?](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

And join the Nx community:
- [Discord](https://go.nx.dev/community)
- [Follow us on X](https://twitter.com/nxdevtools) or [LinkedIn](https://www.linkedin.com/company/nrwl)
- [Our Youtube channel](https://www.youtube.com/@nxdevtools)
- [Our blog](https://nx.dev/blog?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
