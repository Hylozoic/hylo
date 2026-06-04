exports.up = async function (knex) {
  await knex.schema.table('groups', function (table) {
    table.boolean('stripe_sales_paused').notNullable().defaultTo(false)
      .comment('When true, checkout session creation for this group is blocked by Hylo')
    table.timestamp('stripe_sales_paused_at', { useTz: true }).nullable()
    table.text('stripe_sales_paused_reason').nullable()
  })
}

exports.down = async function (knex) {
  await knex.schema.table('groups', function (table) {
    table.dropColumn('stripe_sales_paused')
    table.dropColumn('stripe_sales_paused_at')
    table.dropColumn('stripe_sales_paused_reason')
  })
}
