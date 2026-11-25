/**
 * Group Assistant (Axl): members who do not share are named by an alias ("Member 7") in what the
 * model is given, and the alias is swapped back for their name before an answer is stored for
 * the stewards (decision A-10). member_refs lists the people whose names were put back into a
 * message, [{ id, name }], so that when the thread is given to the model again those names become
 * aliases again instead of reaching it.
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('group_assistant_messages', function (table) {
    table.jsonb('member_refs').notNullable().defaultTo('[]').comment('Members whose names were put back in place of an alias: [{ id, name }]')
  })
}

exports.down = async function (knex) {
  await knex.schema.alterTable('group_assistant_messages', function (table) {
    table.dropColumn('member_refs')
  })
}
