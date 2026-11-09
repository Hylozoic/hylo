exports.up = async function (knex) {
  await knex.schema.table('posts', table => {
    table.jsonb('notice_data')
  })
  await knex.raw(`
    CREATE UNIQUE INDEX posts_notice_bucket_key
    ON posts ((notice_data->>'bucketKey'))
    WHERE notice_data->>'bucketKey' IS NOT NULL
  `)
}

exports.down = async function (knex) {
  await knex.raw('DROP INDEX IF EXISTS posts_notice_bucket_key')
  await knex.schema.table('posts', table => {
    table.dropColumn('notice_data')
  })
}
