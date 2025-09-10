exports.up = function (knex) {
  return knex.schema.table('group_relationships', function (table) {
    // Add relationship type field to distinguish parent-child vs peer-to-peer
    // 0 = parent-child (default for existing relationships), 1 = peer-to-peer
    table.integer('relationship_type').defaultTo(0).notNullable()

    // Add description field for relationship context
    table.text('description').nullable()

    // Add index for efficient querying by relationship type
    table.index(['relationship_type', 'active'], 'group_relationships_type_active_index')
  })
}

exports.down = function (knex) {
  return knex.schema.table('group_relationships', function (table) {
    table.dropIndex(['relationship_type', 'active'], 'group_relationships_type_active_index')
    table.dropColumn('description')
    table.dropColumn('relationship_type')
  })
}