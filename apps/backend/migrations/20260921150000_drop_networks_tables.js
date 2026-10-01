/**
 * Drop leftover pre-groups tables. Community/network data moved onto groups in
 * 20201215160014; nothing in apps/backend/api still reads these.
 */

exports.up = async function (knex) {
  await knex.raw('DROP TABLE IF EXISTS networks_users CASCADE')
  await knex.raw('DROP TABLE IF EXISTS networks CASCADE')
}

exports.down = async function () {
  console.error('20260921150000_drop_networks_tables down() is not supported')
}
