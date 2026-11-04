/**
 * Precomputed metric values. group_id 0 is the whole platform.
 * period is day, week, month or year, and period_start is the first UTC day
 * of that period. Recomputing a period overwrites its rows.
 */

exports.up = async function (knex) {
  if (await knex.schema.hasTable('metric_snapshots')) return
  await knex.schema.createTable('metric_snapshots', table => {
    table.bigInteger('group_id').notNullable()
    table.text('metric').notNullable()
    table.text('dimension').notNullable().defaultTo('')
    table.text('period').notNullable()
    table.date('period_start').notNullable()
    table.decimal('value', 18, 4).notNullable()
    table.timestamp('computed_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.primary(['group_id', 'metric', 'period', 'period_start', 'dimension'])
  })
}

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('metric_snapshots')
}
