#!/bin/bash
# Hard-blocks any shell command that runs/applies/rolls back database migrations.
# The user has mandated that the agent must NEVER run migrations. This hook denies
# such commands at the beforeShellExecution stage (fail-closed).
#
# It intentionally does NOT block commands that merely *create* migration files
# (e.g. migrate-make / migrate:make), only commands that execute them.

input=$(cat)

# Prefer jq to read just the command; fall back to scanning the raw payload so the
# block still works even if jq is unavailable.
command=$(printf '%s' "$input" | jq -r '.command // empty' 2>/dev/null)
if [ -z "$command" ]; then
  command="$input"
fi

shopt -s nocasematch

# Carve-out: generating/creating a migration file is not "running" a migration.
allow_re='(migrate-make|migrate:make|make:migration|migration:generate|migrate-create|migrate:create)'

# Commands that apply or roll back migrations.
block_re='(migrate:(latest|up|down|rollback)|knex[[:space:]]+migrate|db:migrate|db:rollback|prisma[[:space:]]+migrate|sequelize[[:space:]].*db:migrate|rails[[:space:]].*db:(migrate|rollback)|alembic[[:space:]]+upgrade|alembic[[:space:]]+downgrade|updatemigrationstable|(^|[[:space:];&|(])(yarn|pnpm|(npm|npx)([[:space:]]+run)?)[[:space:]]+(migrate|migrate-up|migrate-down|rollback|update-migrations)([[:space:]]|$|[;&|]))'

if [[ "$command" =~ $block_re ]] && ! [[ "$command" =~ $allow_re ]]; then
  echo '{
    "permission": "deny",
    "user_message": "Blocked by project hook: database migration commands are disabled.",
    "agent_message": "This command was blocked by .cursor/hooks/block-migrations.sh because it appears to run, apply, or roll back database migrations. The user has explicitly disabled migration commands. Do NOT try to bypass this (e.g. by calling knex/sequelize/prisma directly, editing the DB, or renaming the command). If a migration needs to run, ask the user to run it themselves."
  }'
  exit 0
fi

echo '{ "permission": "allow" }'
exit 0
