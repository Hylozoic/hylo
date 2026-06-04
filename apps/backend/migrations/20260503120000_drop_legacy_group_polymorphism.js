exports.up = async function (knex) {
  await knex.raw('DROP TABLE IF EXISTS communities CASCADE')
  await knex.raw('DROP TABLE IF EXISTS communities_users CASCADE')
  await knex.raw('DROP TABLE IF EXISTS follows CASCADE')
  await knex.raw('DROP TABLE IF EXISTS networks_posts CASCADE')

  // Replace legacy groups_posts id sequence name, then drop it.
  await knex.raw('CREATE SEQUENCE IF NOT EXISTS groups_posts_id_seq')
  // OWNED BY requires the sequence and table to have the same owner
  await knex.raw(`
    DO $$
    BEGIN
      EXECUTE format(
        'ALTER SEQUENCE groups_posts_id_seq OWNER TO %I',
        (SELECT tableowner FROM pg_tables WHERE schemaname = 'public' AND tablename = 'groups_posts')
      );
    END $$;
  `)
  await knex.raw('SELECT setval(\'groups_posts_id_seq\', (SELECT COALESCE(MAX(id), 0) FROM groups_posts))')
  await knex.raw('ALTER SEQUENCE groups_posts_id_seq OWNED BY groups_posts.id')
  await knex.raw('ALTER TABLE groups_posts ALTER COLUMN id SET DEFAULT nextval(\'groups_posts_id_seq\')')
  await knex.raw('DROP SEQUENCE IF EXISTS post_community_id_seq CASCADE')

  await knex.raw('ALTER TABLE activities DROP CONSTRAINT IF EXISTS activity_community_id_foreign')
  await knex.raw('ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_community_id_foreign')
  await knex.raw('ALTER TABLE activities DROP COLUMN IF EXISTS community_id CASCADE')

  await knex.raw('ALTER TABLE tag_follows DROP COLUMN IF EXISTS community_id CASCADE')

  await knex.raw('ALTER TABLE groups_posts DROP COLUMN IF EXISTS community_id CASCADE')
  await knex.raw('ALTER TABLE group_invites DROP COLUMN IF EXISTS community_id CASCADE')
  await knex.raw('ALTER TABLE groups_tags DROP COLUMN IF EXISTS community_id CASCADE')
  await knex.raw('ALTER TABLE join_requests DROP COLUMN IF EXISTS community_id CASCADE')

  await knex.raw('ALTER TABLE group_memberships DROP COLUMN IF EXISTS group_data_type CASCADE')

  await knex.raw('ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_group_data_id_group_data_type_unique')
  await knex.raw('ALTER TABLE groups DROP COLUMN IF EXISTS group_data_id CASCADE')
  await knex.raw('ALTER TABLE groups DROP COLUMN IF EXISTS group_data_type CASCADE')

  await knex.raw('UPDATE groups SET name = \'NoName\' WHERE name IS NULL OR trim(name) = \'\'')
  await knex.raw('UPDATE groups SET slug = \'no-slug\' || id::text WHERE slug IS NULL OR trim(slug) = \'\'')

  await knex.raw('ALTER TABLE groups ALTER COLUMN name SET NOT NULL')
  await knex.raw('ALTER TABLE groups ALTER COLUMN slug SET NOT NULL')
}

exports.down = async function () {
  console.error('20260503120000_drop_legacy_group_polymorphism down() is not supported')
}

// Without this, PostgreSQL can error on ALTER ... SET NOT NULL after UPDATE groups
// ("pending trigger events") because deferred triggers / same-txn effects are still open.
exports.config = { transaction: false }
