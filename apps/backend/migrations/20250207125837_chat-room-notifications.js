exports.up = async function (knex) {
  await knex.schema.table('tag_follows', t => {
    t.jsonb('settings').defaultTo('{}')
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

    // Update all existing tag follows to have a new_post_count of 0 and a last_read_post_id of the highest post id in the group topic
    await knex('tag_follows')
      .update({
        new_post_count: 0,
        last_read_post_id: knex('posts')
          .join('posts_tags', 'posts.id', 'posts_tags.post_id')
          .max('posts.id')
          .whereRaw('tag_follows.tag_id = posts_tags.tag_id')
      })
}

exports.down = function (knex) {
  return knex.schema.table('tag_follows', t => {
    t.dropColumn('settings')
  })
}
