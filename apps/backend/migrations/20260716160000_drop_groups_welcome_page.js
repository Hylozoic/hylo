/**
 * Move groups.welcome_page content onto welcome-type GroupViews, then drop the column.
 *
 * For each group with non-empty welcome_page:
 *  - If a welcome GroupView exists with empty page_content → copy content in
 *  - If no welcome GroupView exists → create a hidden one (order = null)
 *
 * Then drops groups.welcome_page. Idempotent if the column is already gone.
 */

exports.up = async function (knex) {
  const hasColumn = await knex.schema.hasColumn('groups', 'welcome_page')
  if (!hasColumn) {
    console.log('[up] groups.welcome_page already dropped — nothing to do')
    return
  }

  console.log('[up] migrating groups.welcome_page → welcome GroupView.page_content…')
  const groups = await knex('groups')
    .whereNotNull('welcome_page')
    .whereRaw("trim(welcome_page) != ''")
    .select('id', 'welcome_page')

  const now = new Date()
  let updated = 0
  let created = 0

  for (const group of groups) {
    const welcomeView = await knex('group_views')
      .where({ group_id: group.id, type: 'welcome' })
      .first()

    if (welcomeView) {
      if (!welcomeView.page_content || String(welcomeView.page_content).trim() === '') {
        await knex('group_views')
          .where({ id: welcomeView.id })
          .update({ page_content: group.welcome_page, updated_at: now })
        updated++
      }
    } else {
      // Hidden from the menu (order = null) so content is preserved without cluttering navigation.
      await knex('group_views').insert({
        group_id: group.id,
        type: 'welcome',
        name: 'view-welcome',
        order: null,
        page_content: group.welcome_page,
        created_at: now,
        updated_at: now
      })
      created++
    }
  }

  console.log(`[up]   updated ${updated} welcome views, created ${created} hidden welcome views`)

  console.log('[up] dropping groups.welcome_page…')
  await knex.schema.table('groups', table => {
    table.dropColumn('welcome_page')
  })
  console.log('[up] done.')
}

exports.down = async function (knex) {
  const hasColumn = await knex.schema.hasColumn('groups', 'welcome_page')
  if (!hasColumn) {
    await knex.schema.table('groups', table => {
      table.text('welcome_page')
    })
  }

  console.log('[down] restoring groups.welcome_page from welcome GroupView.page_content…')
  const views = await knex('group_views')
    .where({ type: 'welcome' })
    .whereNotNull('page_content')
    .whereRaw("trim(page_content) != ''")
    .select('group_id', 'page_content')

  let restored = 0
  for (const view of views) {
    const affected = await knex('groups')
      .where({ id: view.group_id })
      .where(function () {
        this.whereNull('welcome_page').orWhereRaw("trim(coalesce(welcome_page, '')) = ''")
      })
      .update({ welcome_page: view.page_content })
    restored += affected
  }
  console.log(`[down]   restored welcome_page on ${restored} groups`)
}

// Without this, migrate:latest wraps the whole spaces batch in one transaction.
// Phase 1 DML on groups (and deferred FKs from group_views inserts in this file)
// then leave pending trigger events, so DROP COLUMN fails with:
//   cannot ALTER TABLE "groups" because it has pending trigger events
// Same pattern as 20260503120000_drop_legacy_group_polymorphism.js.
exports.config = { transaction: false }
