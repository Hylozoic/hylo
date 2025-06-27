exports.up = function (knex) {
  return knex.schema.table('push_notifications', function (table) {
    // Add user_id column
    table.bigInteger('user_id').references('id').inTable('users').onDelete('CASCADE')
  }).then(function () {
    // Populate user_id from devices table
    return knex.raw(`
      UPDATE push_notifications 
      SET user_id = devices.user_id 
      FROM devices 
      WHERE push_notifications.device_id = devices.id
    `)
  })
}

exports.down = function (knex) {
  return knex.schema.table('push_notifications', function (table) {
    table.dropColumn('user_id')
  })
}
