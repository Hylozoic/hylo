/**
 * One-time fixes to notification settings (D10, D11, with D35 and D7).
 *
 * (a) Space memberships created by a steward's auto-add before its settings fix have
 *     no notification settings, so those members heard nothing, not even mentions.
 *     Each missing key is filled from the same person's parent-group membership, else
 *     'important', the daily digest, and email and push on (as Group.addMembers and
 *     addEligibleMembersToSpace now do). Only missing keys are filled.
 *
 * (b) The old emailed settings page saved "less email" choices on the user
 *     (digest_frequency weekly or never, post_notifications important or none) that
 *     nothing read. Each is copied onto that person's memberships that still hold their
 *     join defaults ('all' posts, the group's default digest, email and push on).
 *     Memberships the person changed themselves are left alone.
 *
 * (c) People whose saved choices match the old "Unsubscribe from all" (all four keys
 *     off) and who have no unsubscribe choice yet get 'all_but_direct' (everything
 *     except direct, D35), and their direct message and comment settings go back to
 *     'both'. The saved choice keeps group and digest email off, while direct
 *     messages, mentions and replies reach them again (D7). Their memberships are not
 *     rewritten, so in-app notices keep working as before.
 *
 * Every key this changes keeps its old value in notification_settings_backfill, and
 * down() puts those values back and drops that table. Rows are processed in batches,
 * each in its own transaction. Safe to run again: rows it already changed no longer
 * match. It logs only counts.
 */

const BACKUP_TABLE = 'notification_settings_backfill'
const BATCH_SIZE = 500

const NOTIFICATION_KEYS = ['postNotifications', 'digestFrequency', 'sendEmail', 'sendPushNotifications']
const FALLBACK = { postNotifications: 'important', digestFrequency: 'daily', sendEmail: true, sendPushNotifications: true }

// From least to most
const POST_LEVELS = ['none', 'important', 'all']
const DIGEST_LEVELS = ['never', 'weekly', 'daily']

const isMissing = value => value === undefined || value === null

// (a) The keys an auto-added space membership is missing, from its parent membership
function autoAddPatch (settings, parentSettings) {
  const patch = {}
  for (const key of NOTIFICATION_KEYS) {
    if (!isMissing(settings?.[key])) continue
    patch[key] = isMissing(parentSettings?.[key]) ? FALLBACK[key] : parentSettings[key]
  }
  return patch
}

// The old "Unsubscribe from all"
function isLegacyUnsubscribeAll (userSettings) {
  const s = userSettings || {}
  return s.digest_frequency === 'never' && s.post_notifications === 'none' &&
    s.dm_notifications === 'none' && s.comment_notifications === 'none'
}

// (b) What a person's saved user-level choices ask for, when they ask for less than
// the join defaults. Choices covered by an unsubscribe scope are left to it.
function lessEmailChoices (userSettings) {
  const s = userSettings || {}
  if (isLegacyUnsubscribeAll(s)) return {}
  if (s.email_unsubscribe_scope === 'all_but_direct' || s.email_unsubscribe_scope === 'everything') return {}
  const choices = {}
  if (['weekly', 'never'].includes(s.digest_frequency)) choices.digestFrequency = s.digest_frequency
  if (['important', 'none'].includes(s.post_notifications)) choices.postNotifications = s.post_notifications
  return choices
}

const isLower = (levels, value, than) => levels.indexOf(value) < levels.indexOf(than)

// (b) The patch for one membership at its join defaults
function lessEmailPatch (membershipSettings, choices) {
  const patch = {}
  if (choices.digestFrequency && isLower(DIGEST_LEVELS, choices.digestFrequency, membershipSettings.digestFrequency)) {
    patch.digestFrequency = choices.digestFrequency
  }
  if (choices.postNotifications && isLower(POST_LEVELS, choices.postNotifications, membershipSettings.postNotifications)) {
    patch.postNotifications = choices.postNotifications
  }
  return patch
}

// (c)
const LEGACY_UNSUBSCRIBE_ALL_PATCH = {
  email_unsubscribe_scope: 'all_but_direct',
  dm_notifications: 'both',
  comment_notifications: 'both'
}

// The old values of the keys a patch changes; null for a key that wasn't there
function previousValues (settings, patch) {
  const previous = {}
  for (const key of Object.keys(patch)) {
    previous[key] = isMissing(settings?.[key]) ? null : settings[key]
  }
  return previous
}

async function ensureBackupTable (knex) {
  if (await knex.schema.hasTable(BACKUP_TABLE)) return
  await knex.schema.createTable(BACKUP_TABLE, table => {
    table.string('table_name').notNullable()
    table.bigInteger('row_id').notNullable()
    table.jsonb('previous').notNullable()
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
    table.primary(['table_name', 'row_id'], `${BACKUP_TABLE}_pkey`)
  })
}

// Saves the old values, keeping the earliest one when a row is changed twice, then
// merges the patch into the row's settings
async function applyPatch (trx, tableName, row, patch) {
  await trx.raw(`
    INSERT INTO ${BACKUP_TABLE} (table_name, row_id, previous)
    VALUES (?, ?, ?::jsonb)
    ON CONFLICT (table_name, row_id)
    DO UPDATE SET previous = EXCLUDED.previous || ${BACKUP_TABLE}.previous
  `, [tableName, row.id, JSON.stringify(previousValues(row.settings, patch))])
  await trx(tableName)
    .where('id', row.id)
    .update({ settings: trx.raw('COALESCE(settings, \'{}\'::jsonb) || ?::jsonb', [JSON.stringify(patch)]) })
}

// (a)
async function backfillAutoAddedSpaceMembers (knex) {
  let lastId = 0
  let changed = 0
  for (;;) {
    const { rows } = await knex.raw(`
      SELECT gm.id, gm.settings, p.settings AS parent_settings
      FROM group_memberships gm
      JOIN groups s ON s.id = gm.group_id AND s.type = 'space'
      LEFT JOIN group_memberships p ON p.group_id = s.parent_id AND p.user_id = gm.user_id
      WHERE gm.id > ?
        AND (
          gm.settings ->> 'joinSource' = 'auto_add'
          OR (gm.settings ->> 'postNotifications' IS NULL AND s.settings -> 'auto_add_members' = 'true'::jsonb)
        )
        AND (
          gm.settings ->> 'postNotifications' IS NULL
          OR gm.settings ->> 'digestFrequency' IS NULL
          OR gm.settings ->> 'sendEmail' IS NULL
          OR gm.settings ->> 'sendPushNotifications' IS NULL
        )
      ORDER BY gm.id
      LIMIT ?
    `, [lastId, BATCH_SIZE])
    if (rows.length === 0) break
    lastId = rows[rows.length - 1].id
    await knex.transaction(async trx => {
      for (const row of rows) {
        const patch = autoAddPatch(row.settings, row.parent_settings)
        if (Object.keys(patch).length === 0) continue
        await applyPatch(trx, 'group_memberships', row, patch)
        changed += 1
      }
    })
  }
  return changed
}

// (b) and (c)
async function backfillSavedChoices (knex) {
  let lastId = 0
  let users = 0
  let memberships = 0
  for (;;) {
    const { rows } = await knex.raw(`
      SELECT id, settings
      FROM users
      WHERE id > ?
        AND (
          settings ->> 'digest_frequency' IN ('weekly', 'never')
          OR settings ->> 'post_notifications' IN ('important', 'none')
        )
      ORDER BY id
      LIMIT ?
    `, [lastId, BATCH_SIZE])
    if (rows.length === 0) break
    lastId = rows[rows.length - 1].id

    const choicesByUser = {}
    const legacy = []
    for (const row of rows) {
      if (isLegacyUnsubscribeAll(row.settings)) {
        if (isMissing(row.settings.email_unsubscribe_scope)) legacy.push(row)
        continue
      }
      const choices = lessEmailChoices(row.settings)
      if (Object.keys(choices).length > 0) choicesByUser[String(row.id)] = choices
    }

    const userIds = Object.keys(choicesByUser)
    const atJoinDefaults = userIds.length === 0
      ? []
      : (await knex.raw(`
        SELECT gm.id, gm.user_id, gm.settings
        FROM group_memberships gm
        JOIN groups g ON g.id = gm.group_id
        WHERE gm.user_id IN (${userIds.map(() => '?').join(', ')})
          AND gm.settings ->> 'postNotifications' = 'all'
          AND gm.settings ->> 'digestFrequency' =
            CASE WHEN g.settings ->> 'default_digest_frequency' = 'weekly' THEN 'weekly' ELSE 'daily' END
          AND gm.settings -> 'sendEmail' = 'true'::jsonb
          AND gm.settings -> 'sendPushNotifications' = 'true'::jsonb
        ORDER BY gm.id
      `, userIds)).rows

    await knex.transaction(async trx => {
      for (const row of legacy) {
        await applyPatch(trx, 'users', row, LEGACY_UNSUBSCRIBE_ALL_PATCH)
        users += 1
      }
      for (const row of atJoinDefaults) {
        const patch = lessEmailPatch(row.settings, choicesByUser[String(row.user_id)])
        if (Object.keys(patch).length === 0) continue
        await applyPatch(trx, 'group_memberships', row, patch)
        memberships += 1
      }
    })
  }
  return { users, memberships }
}

async function up (knex) {
  await ensureBackupTable(knex)
  const autoAdded = await backfillAutoAddedSpaceMembers(knex)
  const saved = await backfillSavedChoices(knex)
  if (process.env.NODE_ENV !== 'test') {
    console.log(`Notification settings backfill: ${autoAdded} auto-added space memberships, ${saved.memberships} memberships from saved choices, ${saved.users} people moved to 'everything except direct'`)
  }
}

async function down (knex) {
  if (!(await knex.schema.hasTable(BACKUP_TABLE))) return
  let last = { table_name: '', row_id: 0 }
  for (;;) {
    const rows = await knex(BACKUP_TABLE)
      .whereRaw('(table_name, row_id) > (?, ?)', [last.table_name, last.row_id])
      .orderBy(['table_name', 'row_id'])
      .limit(BATCH_SIZE)
    if (rows.length === 0) break
    last = rows[rows.length - 1]
    await knex.transaction(async trx => {
      for (const row of rows) {
        const previous = row.previous || {}
        const removed = Object.keys(previous).filter(key => previous[key] === null)
        const restored = Object.keys(previous)
          .filter(key => previous[key] !== null)
          .reduce((acc, key) => ({ ...acc, [key]: previous[key] }), {})
        await trx(row.table_name)
          .where('id', row.row_id)
          .update({ settings: trx.raw('(COALESCE(settings, \'{}\'::jsonb) - ?::text[]) || ?::jsonb', [removed, JSON.stringify(restored)]) })
      }
    })
  }
  await knex.schema.dropTableIfExists(BACKUP_TABLE)
}

exports.config = { transaction: false }
exports.up = up
exports.down = down
// For tests
exports.autoAddPatch = autoAddPatch
exports.lessEmailChoices = lessEmailChoices
exports.lessEmailPatch = lessEmailPatch
exports.isLegacyUnsubscribeAll = isLegacyUnsubscribeAll
