/**
 * Index on posts.created_at, which the "Recently active" Group Explorer sort
 * uses to count each group's posts in the last 30 days.
 *
 * Taken from the growth-audit migration 20261004000000_group_explorer_review,
 * which creates the same index with IF NOT EXISTS, so running both is safe.
 * The index is built concurrently, so this runs outside a transaction.
 */

exports.config = { transaction: false }

exports.up = async function (knex) {
  await knex.raw('CREATE INDEX CONCURRENTLY IF NOT EXISTS posts_created_at_index ON posts (created_at)')
}

exports.down = async function (knex) {
  await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS posts_created_at_index')
}
