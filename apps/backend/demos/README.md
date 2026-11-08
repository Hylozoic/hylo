# Demo groups

Demo groups are JSON specs plus one builder. The AI writes the spec. The builder loads it into whatever database you point it at. It does not send email or push, and generated neighbors cannot sign in.

Specs live in `demos/specs/`. River City and Hudson Valley are the two that exist now.

## Where a demo should live

- **Local** is where you write and preview a demo.
- **Staging** is the default place to invite a partner. Nothing there touches real users.
- **Production** is for a demo people should keep using with their real accounts. Pass `--allow-prod` only after the command has printed the database host you expect. Demo groups are hidden from search. Partners get in through the invite link the build prints.

Run the command on the server (`heroku run`, or the staging equivalent) so database credentials stay there.

## Commands

From `apps/backend`:

```bash
yarn demo validate river-city
yarn demo resolve-images demos/specs/river-city.json
yarn demo build river-city
yarn demo build river-city --invite partner@example.com
yarn demo delete river-city
```

`NODE_ENV=production` refuses to write unless you add `--allow-prod`. The command prints the database host before it writes.

The first build on a database creates a few indexes (post reads, notification activity ids) so deleting the previous copy does not scan those tables once per row. Building an existing slug deletes that demo and rebuilds it. Memberships of real people who were invited are kept. Generated `@demo.invalid` users are replaced. Dates are relative to the morning you run the build, so a refresh the day of a meeting looks current.

Log in as the real user named in the spec (`tibet@terran.io` for the two current demos). Other neighbors have random passwords and addresses like `rosa.hudson-valley@demo.invalid`. Mail to `@demo.invalid` is dropped. Each demo has its own addresses, so two demos can exist in one database.

## Writing a demo with AI

1. Ask your agent to draft a new spec from an existing one. For example: "make a demo for X, based on demos/specs/hudson-valley.json, adapted to Y."
2. Photo URLs can be left blank and replaced with a search phrase under `imageQueries`. Run `yarn demo resolve-images <file>` locally. That needs `UNSPLASH_ACCESS_KEY` and `PEXELS_API_KEY` in `apps/backend/.env`. The URLs are written into the spec, so staging and production do not need those keys.
3. `yarn demo validate <file>` checks that every author, commenter, mention, and space exists, that `spaces` is an array, and that token allocations add up.
4. `yarn demo build <file>` against the local database, then look at the group in the browser.
5. Commit the spec. Build it on staging. Build it on production only when someone should keep using it.

A spec has `version`, `slug`, `tz`, `place`, `people`, `group`, `spaces`, `posts`, `chats`, `threads`, and optional `funding`, `welcomeTrack`, and `peer`. Set `group.visibility` to `"public"` only when the demo should appear in search. The default is `"hidden"`.

Do not put demo content in a migration. Migrations run on every environment, on every deploy, and are hard to undo.
