exports.up = function (knex) {
  // Move digest frequency and post notifications from user settings to per group membership settings
  // TODO: remove them from the user settings
  return knex.raw(`
    UPDATE group_memberships
    SET settings = jsonb_set(
      jsonb_set(
        group_memberships.settings,
        '{digestFrequency}',
        COALESCE(to_jsonb(users.settings->>'digest_frequency'), '"daily"'),
        true
      ),
      '{postNotifications}',
      COALESCE(to_jsonb(users.settings->>'post_notifications'), '"all"'),
      true
    )::jsonb
    FROM users
    WHERE users.id = group_memberships.user_id
  `)
}

exports.down = function (knex) {
  return knex('group_memberships')
    .update('settings', knex.raw(`
      settings - 'digestFrequency' - 'postNotifications'
    `))
}
