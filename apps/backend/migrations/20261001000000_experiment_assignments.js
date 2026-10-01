/**
 * First-party experiment assignments (S31, see lib/experiments.js): one row per
 * experiment and subject, recording the variant the subject was first given.
 */

exports.up = async function (knex) {
  if (await knex.schema.hasTable('experiment_assignments')) return
  await knex.schema.createTable('experiment_assignments', table => {
    table.bigIncrements('id')
    table.string('experiment').notNullable()
    table.string('subject_type').notNullable()
    table.bigInteger('subject_id').notNullable()
    table.string('variant').notNullable()
    table.timestamp('assigned_at').notNullable().defaultTo(knex.fn.now())
    table.unique(['experiment', 'subject_type', 'subject_id'], 'experiment_assignments_subject_unique')
    table.index(['experiment', 'variant'])
  })
}

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('experiment_assignments')
}
