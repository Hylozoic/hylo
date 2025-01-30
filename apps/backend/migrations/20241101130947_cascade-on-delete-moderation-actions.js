exports.up = function (knex) {
  console.log("Cascade on delete moderation actions")
  return knex.raw(`
    ALTER TABLE moderation_actions
    DROP CONSTRAINT moderation_actions_group_id_foreign,
    ADD CONSTRAINT moderation_actions_group_id_foreign
    FOREIGN KEY (group_id)
    REFERENCES groups(id)
    ON DELETE CASCADE;
  `)
}

exports.down = function (knex) {
  return knex.raw(`
    ALTER TABLE moderation_actions
    DROP CONSTRAINT moderation_actions_group_id_foreign,
    ADD CONSTRAINT moderation_actions_group_id_foreign
    FOREIGN KEY (group_id)
    REFERENCES groups(id);
  `)
}
