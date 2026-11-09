/**
 * No-op. Originally seeded common view types (discussions, events, map, …)
 * with order = null for More Views. Views are now binary (in the menu or
 * deleted) and those types are added from Add View instead.
 *
 * Left in place so databases that already recorded this filename (staging) do
 * not try to re-run a different migration, and so production never inserts
 * rows that 20260817140000_drop_off_menu_views would immediately delete.
 */

exports.up = async function up (knex) {}

exports.down = async function down (knex) {}
