exports.up = async function (knex) {
  await knex.schema.table('tag_follows', t => {
    t.jsonb('settings').defaultTo(JSON.stringify({ notifications: "none" }))
  })

  const homeTag = await knex.select('id').from('tags').where('name', 'home').first()
  const homeTagId = homeTag.id

  // Turn on all post notifications for every user in all #home chats,
  // + for every tag that a user has previously used that is connected to a chat room
  await knex('tag_follows')
    .where(function() {
      this.where('tag_id', homeTagId)
        .orWhereExists(function() {
          this.select('posts_tags.id')
            .from('posts_tags')
            .join('posts', 'posts_tags.post_id', 'posts.id')
            .whereRaw('posts_tags.tag_id = tag_follows.tag_id')
            .whereRaw('posts.user_id = tag_follows.user_id')
            .join('context_widgets', function() {
              this.on('context_widgets.group_id', '=', 'tag_follows.group_id')
                .andOn('context_widgets.view_chat_id', '=', 'tag_follows.tag_id');
            });
        })
    })
    .update({ settings: { notifications: 'all' } })
}

exports.down = function (knex) {
  return knex.schema.table('tag_follows', t => {
    t.dropColumn('settings')
  })
}
