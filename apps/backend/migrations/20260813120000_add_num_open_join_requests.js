/**
 * Cache pending join-request counts on groups so the context menu can badge
 * "Join Requests" without counting join_requests on every group fetch.
 */
exports.up = async function (knex) {
  await knex.schema.table('groups', table => {
    table.integer('num_open_join_requests').notNullable().defaultTo(0)
  })

  await knex.raw(`
    UPDATE groups SET num_open_join_requests = (
      SELECT count(*) FROM join_requests
      WHERE join_requests.group_id = groups.id
        AND join_requests.status = 0
    )
  `)
}

exports.down = async function (knex) {
  await knex.schema.table('groups', table => {
    table.dropColumn('num_open_join_requests')
  })
}
