/**
 * Phase 4 — Paid / Paywalled Spaces:
 * Migrate track.access_controlled → space group.paywall, and remint offering
 * access_grants.trackIds → the track's space group_id in groupIds.
 *
 * Also remints active content_access track rows into group-scoped access and
 * ensures space membership for purchasers who already had track access.
 */

exports.up = async function (knex) {
  const hasAccessControlled = await knex.schema.hasColumn('tracks', 'access_controlled')
  if (!hasAccessControlled) return

  // 1) Mark track spaces as paid when the track was access-controlled
  await knex.raw(`
    UPDATE groups AS g
    SET
      paywall = true,
      visibility = 1,
      accessibility = 1
    FROM tracks AS t
    WHERE t.access_controlled = true
      AND t.group_id IS NOT NULL
      AND g.id = t.group_id
      AND g.type = 'space'
  `)

  // 2) Remint stripe_products.access_grants.trackIds → groupIds (space group)
  const products = await knex('stripe_products')
    .select('id', 'access_grants', 'track_id')

  for (const product of products) {
    let grants = product.access_grants
    if (typeof grants === 'string') {
      try {
        grants = JSON.parse(grants)
      } catch (e) {
        continue
      }
    }
    if (!grants || typeof grants !== 'object') grants = {}

    const trackIds = Array.isArray(grants.trackIds) ? grants.trackIds : []
    const legacyTrackId = product.track_id != null ? [product.track_id] : []
    const allTrackIds = [...new Set([...trackIds, ...legacyTrackId].map(id => parseInt(id, 10)).filter(id => !isNaN(id) && id > 0))]

    if (allTrackIds.length === 0 && !product.track_id) continue

    const tracks = allTrackIds.length > 0
      ? await knex('tracks').select('id', 'group_id').whereIn('id', allTrackIds)
      : []

    const groupIds = Array.isArray(grants.groupIds)
      ? grants.groupIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id) && id > 0)
      : []

    for (const track of tracks) {
      const spaceId = track.group_id != null ? parseInt(track.group_id, 10) : null
      if (spaceId && !groupIds.includes(spaceId)) groupIds.push(spaceId)
    }

    const nextGrants = { ...grants }
    if (groupIds.length > 0) nextGrants.groupIds = groupIds
    delete nextGrants.trackIds

    await knex('stripe_products')
      .where({ id: product.id })
      .update({
        access_grants: JSON.stringify(nextGrants),
        track_id: null
      })
  }

  // 3) Remint active content_access with track_id → group_id = track.group_id when missing
  await knex.raw(`
    UPDATE content_access AS ca
    SET group_id = t.group_id
    FROM tracks AS t
    WHERE ca.track_id = t.id
      AND ca.group_id IS NULL
      AND t.group_id IS NOT NULL
      AND ca.status = 'active'
  `)

  // Ensure space membership for users with active track content_access
  await knex.raw(`
    INSERT INTO group_memberships (group_id, user_id, active, created_at, updated_at, settings)
    SELECT DISTINCT t.group_id, ca.user_id, true, NOW(), NOW(), '{}'::jsonb
    FROM content_access AS ca
    INNER JOIN tracks AS t ON t.id = ca.track_id
    WHERE ca.status = 'active'
      AND t.group_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM group_memberships gm
        WHERE gm.group_id = t.group_id
          AND gm.user_id = ca.user_id
          AND gm.active = true
      )
  `)

  // 4) Clear track access_controlled flag (column drop may follow in spaces cleanup)
  await knex('tracks').where({ access_controlled: true }).update({ access_controlled: false })
}

exports.down = async function (knex) {
  // Irreversible data migration — paywall/groupIds remain; do not restore trackIds
}
