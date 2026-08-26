/**
 * Per-view post pinning. Replaces groups_posts.pinned_at.
 *
 * Copies existing group-scoped pins onto each group's all + chat views (and the
 * matching type view), capped at 3 most-recent pins per view, then drops the
 * old column.
 */

const POST_TYPE_TO_TYPED_VIEW = {
  discussion: 'discussions',
  event: 'events',
  offer: 'requests-and-offers',
  request: 'requests-and-offers',
  resource: 'resources',
  proposal: 'proposals',
  project: 'projects'
}

const ALWAYS_TARGET_TYPES = ['all', 'chat']
const MAX_PINS_PER_VIEW = 3

exports.up = async function up (knex) {
  await knex.schema.createTable('group_view_pins', table => {
    table.bigIncrements('id').primary()
    table.bigInteger('view_id').notNullable().references('id').inTable('group_views').onDelete('CASCADE')
    table.bigInteger('post_id').notNullable().references('id').inTable('posts').onDelete('CASCADE')
    table.timestamp('pinned_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.unique(['view_id', 'post_id'])
  })
  await knex.raw('alter table group_view_pins alter constraint group_view_pins_view_id_foreign deferrable initially deferred')
  await knex.raw('alter table group_view_pins alter constraint group_view_pins_post_id_foreign deferrable initially deferred')
  await knex.schema.raw('CREATE INDEX idx_group_view_pins_post_id ON group_view_pins(post_id)')

  const hasPinnedAt = await knex.schema.hasColumn('groups_posts', 'pinned_at')
  if (hasPinnedAt) {
    const pins = await knex('groups_posts')
      .whereNotNull('pinned_at')
      .select('group_id', 'post_id', 'pinned_at')
      .orderBy('pinned_at', 'desc')

    if (pins.length > 0) {
      const postIds = [...new Set(pins.map(p => p.post_id))]
      const posts = await knex('posts').whereIn('id', postIds).select('id', 'type')
      const typeByPostId = Object.fromEntries(posts.map(p => [String(p.id), p.type]))

      const groupIds = [...new Set(pins.map(p => p.group_id))]
      const targetTypes = [...ALWAYS_TARGET_TYPES, ...Object.values(POST_TYPE_TO_TYPED_VIEW)]
      const views = await knex('group_views')
        .whereIn('group_id', groupIds)
        .whereIn('type', targetTypes)
        .select('id', 'group_id', 'type')

      const viewByGroupType = {}
      for (const view of views) {
        viewByGroupType[`${view.group_id}:${view.type}`] = view
      }

      const rowsByViewId = {}
      for (const pin of pins) {
        const targets = [...ALWAYS_TARGET_TYPES]
        const typed = POST_TYPE_TO_TYPED_VIEW[typeByPostId[String(pin.post_id)]]
        if (typed) targets.push(typed)
        for (const type of targets) {
          const view = viewByGroupType[`${pin.group_id}:${type}`]
          if (!view) continue
          if (!rowsByViewId[view.id]) rowsByViewId[view.id] = []
          rowsByViewId[view.id].push({
            view_id: view.id,
            post_id: pin.post_id,
            pinned_at: pin.pinned_at
          })
        }
      }

      const toInsert = []
      for (const rows of Object.values(rowsByViewId)) {
        const unique = []
        const seen = new Set()
        for (const row of rows) {
          const key = String(row.post_id)
          if (seen.has(key)) continue
          seen.add(key)
          unique.push(row)
        }
        unique.sort((a, b) => new Date(b.pinned_at) - new Date(a.pinned_at))
        toInsert.push(...unique.slice(0, MAX_PINS_PER_VIEW))
      }

      if (toInsert.length > 0) {
        await knex('group_view_pins').insert(toInsert)
      }
    }

    await knex.schema.table('groups_posts', table => {
      table.dropColumn('pinned_at')
    })
  }
}

exports.down = async function down (knex) {
  const hasPinnedAt = await knex.schema.hasColumn('groups_posts', 'pinned_at')
  if (!hasPinnedAt) {
    await knex.schema.table('groups_posts', table => {
      table.timestamp('pinned_at')
    })
  }

  // Best-effort: restore pins from the all view only (lossy).
  const pins = await knex('group_view_pins')
    .join('group_views', 'group_views.id', 'group_view_pins.view_id')
    .where('group_views.type', 'all')
    .select('group_views.group_id', 'group_view_pins.post_id', 'group_view_pins.pinned_at')

  for (const pin of pins) {
    await knex('groups_posts')
      .where({ group_id: pin.group_id, post_id: pin.post_id })
      .update({ pinned_at: pin.pinned_at })
  }

  await knex.schema.dropTableIfExists('group_view_pins')
}
