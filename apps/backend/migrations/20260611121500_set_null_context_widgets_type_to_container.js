/**
 * Set explicit type 'container' for custom menu containers that were saved with
 * type null (web used to send type null for non-chat creates). Aligns DB with
 * createContextWidget and isSystemWidget semantics.
 */
exports.up = async function (knex) {
  await knex.raw(`
    UPDATE context_widgets
    SET type = 'container', updated_at = NOW()
    WHERE (type IS NULL OR type = '')
      AND (view IS NULL OR view = '')
      AND view_group_id IS NULL
      AND view_post_id IS NULL
      AND custom_view_id IS NULL
      AND view_user_id IS NULL
      AND view_chat_id IS NULL
      AND view_track_id IS NULL
      AND view_funding_round_id IS NULL
  `)
}

exports.down = async function () {
  // Cannot safely revert type without knowing prior values
}
