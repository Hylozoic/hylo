/**
 * Stamp system roles (Coordinator, Moderator, Host) into groups_roles per group,
 * migrate all common role assignments to group_memberships_group_roles,
 * then drop common_roles tables.
 */

const SYSTEM_ROLES = [
  {
    name: 'Coordinator',
    emoji: '🪄',
    description: 'Coordinators are empowered to do everything related to group administration.',
    responsibilities: ['Administration', 'Add Members', 'Remove Members', 'Manage Content', 'Manage Tracks', 'Manage Rounds']
  },
  {
    name: 'Moderator',
    emoji: '⚖️',
    description: 'Moderators are expected to actively engage in discussion, encourage participation, and take corrective action if a member violates group agreements.',
    responsibilities: ['Manage Content', 'Remove Members']
  },
  {
    name: 'Host',
    emoji: '👋',
    description: 'Hosts are responsible for cultivating a good atmosphere by welcoming and orienting new members, embodying the group culture and agreements, and helping members connect with relevant content and people.',
    responsibilities: ['Add Members']
  }
]

async function getSystemResponsibilityIds (knex) {
  const rows = await knex('responsibilities')
    .where('type', 'system')
    .select('id', 'title')
  const byName = {}
  for (const row of rows) {
    byName[row.title] = row.id
  }
  return byName
}

async function getCommonRoleNameById (knex) {
  const rows = await knex('common_roles').select('id', 'name')
  const byId = {}
  for (const row of rows) {
    byId[row.id] = row.name
  }
  return byId
}

/**
 * Stamp Coordinator/Moderator/Host system roles for all groups in bulk.
 */
async function stampSystemRolesBulk (knex, responsibilityByName, now) {
  for (const roleDef of SYSTEM_ROLES) {
    await knex.raw(`
      INSERT INTO groups_roles (group_id, name, emoji, description, type, active, created_at, updated_at)
      SELECT g.id, ?, ?, ?, 'system', true, ?, ?
      FROM groups g
      WHERE NOT EXISTS (
        SELECT 1 FROM groups_roles gr
        WHERE gr.group_id = g.id AND gr.name = ? AND gr.type = 'system'
      )
    `, [roleDef.name, roleDef.emoji, roleDef.description, now, now, roleDef.name])

    const respIds = roleDef.responsibilities
      .map(title => responsibilityByName[title])
      .filter(Boolean)

    if (respIds.length === 0) continue

    await knex.raw(`
      INSERT INTO group_roles_responsibilities (group_role_id, responsibility_id)
      SELECT gr.id, resp.responsibility_id
      FROM groups_roles gr
      CROSS JOIN unnest(?::bigint[]) AS resp(responsibility_id)
      WHERE gr.type = 'system' AND gr.name = ?
      AND NOT EXISTS (
        SELECT 1 FROM group_roles_responsibilities grr
        WHERE grr.group_role_id = gr.id AND grr.responsibility_id = resp.responsibility_id
      )
    `, [respIds, roleDef.name])
  }
}

async function buildGroupSystemRoleMaps (knex, commonRoleNameById) {
  const systemRoles = await knex('groups_roles')
    .where({ type: 'system' })
    .whereIn('name', SYSTEM_ROLES.map(r => r.name))
    .select('id', 'group_id', 'name')

  const groupSystemRoleMaps = {}
  for (const row of systemRoles) {
    if (!groupSystemRoleMaps[row.group_id]) {
      groupSystemRoleMaps[row.group_id] = { byName: {}, byCommonId: {} }
    }
    groupSystemRoleMaps[row.group_id].byName[row.name] = row.id
  }

  for (const map of Object.values(groupSystemRoleMaps)) {
    for (const [commonRoleId, roleName] of Object.entries(commonRoleNameById)) {
      if (map.byName[roleName]) {
        map.byCommonId[commonRoleId] = map.byName[roleName]
      }
    }
  }

  return groupSystemRoleMaps
}

async function getSystemGroupRolesById (knex) {
  const hasTypeColumn = await knex.schema.hasColumn('groups_roles', 'type')
  if (!hasTypeColumn) return {}

  const rows = await knex('groups_roles')
    .where({ type: 'system' })
    .select('id', 'group_id', 'name')

  const byId = {}
  for (const row of rows) {
    byId[row.id] = row
  }
  return byId
}

function commonRoleIdForGroupRoleId (systemRoleById, commonRoleIdByName, groupRoleId) {
  const groupRole = systemRoleById[groupRoleId]
  if (!groupRole) return null
  return commonRoleIdByName[groupRole.name] || null
}

async function recreateCommonRolesTables (knex, responsibilityByName, now) {
  await knex.schema.createTable('common_roles', table => {
    table.increments().primary()
    table.text('name').notNullable()
    table.text('description')
    table.text('emoji')
    table.timestamp('created_at')
    table.timestamp('updated_at')
  })

  for (const roleDef of SYSTEM_ROLES) {
    await knex('common_roles').insert({
      name: roleDef.name,
      description: roleDef.description,
      emoji: roleDef.emoji,
      created_at: now,
      updated_at: now
    })
  }

  const commonRoles = await knex('common_roles').select('id', 'name')
  const commonRoleIdByName = {}
  for (const row of commonRoles) {
    commonRoleIdByName[row.name] = row.id
  }

  await knex.schema.createTable('common_roles_responsibilities', table => {
    table.increments().primary()
    table.bigInteger('common_role_id').references('id').inTable('common_roles')
    table.bigInteger('responsibility_id').references('id').inTable('responsibilities')
  })

  for (const roleDef of SYSTEM_ROLES) {
    const commonRoleId = commonRoleIdByName[roleDef.name]
    if (!commonRoleId) continue

    for (const title of roleDef.responsibilities) {
      const responsibilityId = responsibilityByName[title]
      if (!responsibilityId) continue

      await knex('common_roles_responsibilities').insert({
        common_role_id: commonRoleId,
        responsibility_id: responsibilityId
      })
    }
  }

  await knex.schema.createTable('group_memberships_common_roles', table => {
    table.increments().primary()
    table.bigInteger('common_role_id').references('id').inTable('common_roles')
    table.bigInteger('user_id').references('id').inTable('users')
    table.bigInteger('group_id').references('id').inTable('groups')
    table.index(['group_id', 'user_id'])
    table.index(['user_id', 'group_id'], 'group_memberships_common_roles_user_id_group_id_index')
  })

  await knex.raw(
    'alter table group_memberships_common_roles alter constraint group_memberships_common_roles_common_role_id_foreign deferrable initially deferred'
  )

  return commonRoleIdByName
}

function reverseMapRoleJson (rolesJson, systemRoleById, commonRoleIdByName) {
  if (!rolesJson) return rolesJson
  const roles = typeof rolesJson === 'string' ? JSON.parse(rolesJson) : rolesJson
  if (!Array.isArray(roles)) return rolesJson
  return roles.map(roleInfo => {
    if (roleInfo.type !== 'group') return roleInfo
    const commonRoleId = commonRoleIdForGroupRoleId(systemRoleById, commonRoleIdByName, roleInfo.id)
    if (!commonRoleId) return roleInfo
    return { type: 'common', id: commonRoleId }
  })
}

/**
 * Rewrites user_scopes rows whose scope PK changed (common_role -> group_role or reverse).
 * user_scopes has composite PK (user_id, scope) — no id column.
 */
async function migrateUserScopesCommonToGroup (knex) {
  await knex.raw(`
    WITH mapped AS (
      SELECT
        us.user_id,
        us.scope AS old_scope,
        us.expires_at,
        us.source_kind,
        us.source_id,
        us.created_at,
        'group_role:' || split_part(us.scope, ':', 2) || ':' || gr.id AS new_scope
      FROM user_scopes us
      JOIN common_roles cr ON cr.id = split_part(us.scope, ':', 3)::bigint
      JOIN groups_roles gr ON gr.group_id = split_part(us.scope, ':', 2)::bigint
        AND gr.name = cr.name AND gr.type = 'system'
      WHERE us.scope LIKE 'common_role:%'
    ),
    deleted AS (
      DELETE FROM user_scopes us
      USING mapped m
      WHERE us.user_id = m.user_id AND us.scope = m.old_scope
    )
    INSERT INTO user_scopes (user_id, scope, expires_at, source_kind, source_id, created_at, updated_at)
    SELECT user_id, new_scope, expires_at, source_kind, source_id, created_at, NOW()
    FROM mapped
  `)
}

async function migrateUserScopesGroupToCommon (knex) {
  await knex.raw(`
    WITH mapped AS (
      SELECT
        us.user_id,
        us.scope AS old_scope,
        us.expires_at,
        us.source_kind,
        us.source_id,
        us.created_at,
        'common_role:' || split_part(us.scope, ':', 2) || ':' || cr.id AS new_scope
      FROM user_scopes us
      JOIN groups_roles gr ON gr.id = split_part(us.scope, ':', 3)::bigint AND gr.type = 'system'
      JOIN common_roles cr ON cr.name = gr.name
      WHERE us.scope LIKE 'group_role:%'
    ),
    deleted AS (
      DELETE FROM user_scopes us
      USING mapped m
      WHERE us.user_id = m.user_id AND us.scope = m.old_scope
    )
    INSERT INTO user_scopes (user_id, scope, expires_at, source_kind, source_id, created_at, updated_at)
    SELECT user_id, new_scope, expires_at, source_kind, source_id, created_at, NOW()
    FROM mapped
  `)
}

async function updateContentAccessTriggersWithoutCommonRole (knex) {
  await knex.raw(`
    CREATE OR REPLACE FUNCTION compute_user_scopes_from_content_access()
    RETURNS TRIGGER AS $$
    DECLARE
      scope_string TEXT;
      scope_group_id BIGINT;
    BEGIN
      IF NEW.status = 'active' THEN
        IF NEW.track_id IS NOT NULL THEN
          scope_string := 'track:' || NEW.track_id;
          INSERT INTO user_scopes (user_id, scope, expires_at, source_kind, source_id, created_at, updated_at)
          VALUES (NEW.user_id, scope_string, NEW.expires_at, 'grant', NEW.id, NOW(), NOW())
          ON CONFLICT (user_id, scope)
          DO UPDATE SET
            expires_at = CASE
              WHEN user_scopes.expires_at IS NULL OR NEW.expires_at IS NULL THEN NULL
              WHEN NEW.expires_at > user_scopes.expires_at THEN NEW.expires_at
              ELSE user_scopes.expires_at
            END,
            updated_at = NOW();
        END IF;

        IF NEW.group_role_id IS NOT NULL THEN
          scope_group_id := COALESCE(NEW.group_id, NEW.granted_by_group_id);
          IF scope_group_id IS NULL THEN
            RAISE WARNING 'Cannot create group role scope: missing group_id and granted_by_group_id for content_access %', NEW.id;
          ELSE
            scope_string := 'group_role:' || scope_group_id || ':' || NEW.group_role_id;
            INSERT INTO user_scopes (user_id, scope, expires_at, source_kind, source_id, created_at, updated_at)
            VALUES (NEW.user_id, scope_string, NEW.expires_at, 'grant', NEW.id, NOW(), NOW())
            ON CONFLICT (user_id, scope)
            DO UPDATE SET
              expires_at = CASE
                WHEN user_scopes.expires_at IS NULL OR NEW.expires_at IS NULL THEN NULL
                WHEN NEW.expires_at > user_scopes.expires_at THEN NEW.expires_at
                ELSE user_scopes.expires_at
              END,
              updated_at = NOW();
          END IF;
        END IF;

        IF NEW.track_id IS NULL AND NEW.group_role_id IS NULL AND NEW.granted_by_group_id IS NOT NULL THEN
          scope_string := 'group:' || NEW.granted_by_group_id;
          INSERT INTO user_scopes (user_id, scope, expires_at, source_kind, source_id, created_at, updated_at)
          VALUES (NEW.user_id, scope_string, NEW.expires_at, 'grant', NEW.id, NOW(), NOW())
          ON CONFLICT (user_id, scope)
          DO UPDATE SET
            expires_at = CASE
              WHEN user_scopes.expires_at IS NULL OR NEW.expires_at IS NULL THEN NULL
              WHEN NEW.expires_at > user_scopes.expires_at THEN NEW.expires_at
              ELSE user_scopes.expires_at
            END,
            updated_at = NOW();
        END IF;
      ELSE
        IF NEW.track_id IS NOT NULL THEN
          scope_string := 'track:' || NEW.track_id;
          DELETE FROM user_scopes
          WHERE user_id = NEW.user_id AND scope = scope_string AND source_kind = 'grant' AND source_id = NEW.id;
        END IF;

        IF NEW.group_role_id IS NOT NULL THEN
          scope_group_id := COALESCE(NEW.group_id, NEW.granted_by_group_id);
          IF scope_group_id IS NOT NULL THEN
            scope_string := 'group_role:' || scope_group_id || ':' || NEW.group_role_id;
            DELETE FROM user_scopes
            WHERE user_id = NEW.user_id AND scope = scope_string AND source_kind = 'grant' AND source_id = NEW.id;
          END IF;
        END IF;

        IF NEW.track_id IS NULL AND NEW.group_role_id IS NULL AND NEW.granted_by_group_id IS NOT NULL THEN
          scope_string := 'group:' || NEW.granted_by_group_id;
          DELETE FROM user_scopes
          WHERE user_id = NEW.user_id AND scope = scope_string AND source_kind = 'grant' AND source_id = NEW.id;
        END IF;
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `)

  await knex.raw(`
    CREATE OR REPLACE FUNCTION sync_content_access_expires_at()
    RETURNS TRIGGER AS $$
    DECLARE
      latest_expires_at TIMESTAMP WITH TIME ZONE;
    BEGIN
      IF NEW.track_id IS NOT NULL THEN
        UPDATE tracks_users
        SET access_granted = true, updated_at = NOW()
        WHERE user_id = NEW.user_id AND track_id = NEW.track_id;
      END IF;

      IF NEW.group_role_id IS NOT NULL THEN
        SELECT MAX(expires_at) INTO latest_expires_at
        FROM content_access
        WHERE user_id = NEW.user_id
          AND group_role_id = NEW.group_role_id
          AND granted_by_group_id = NEW.granted_by_group_id
          AND status = 'active';
        UPDATE group_memberships_group_roles
        SET expires_at = latest_expires_at, updated_at = NOW()
        WHERE user_id = NEW.user_id
          AND group_id = NEW.granted_by_group_id
          AND group_role_id = NEW.group_role_id;
        UPDATE group_memberships
        SET expires_at = latest_expires_at, updated_at = NOW()
        WHERE user_id = NEW.user_id
          AND group_id = NEW.granted_by_group_id;
      END IF;

      IF NEW.track_id IS NULL AND NEW.group_role_id IS NULL THEN
        SELECT MAX(expires_at) INTO latest_expires_at
        FROM content_access
        WHERE user_id = NEW.user_id
          AND granted_by_group_id = NEW.granted_by_group_id
          AND track_id IS NULL
          AND group_role_id IS NULL
          AND status = 'active';
        UPDATE group_memberships
        SET expires_at = latest_expires_at, updated_at = NOW()
        WHERE user_id = NEW.user_id
          AND group_id = NEW.granted_by_group_id;
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `)

  await knex.raw(`
    CREATE OR REPLACE FUNCTION clear_content_access_expires_at()
    RETURNS TRIGGER AS $$
    DECLARE
      latest_expires_at TIMESTAMP WITH TIME ZONE;
    BEGIN
      IF NEW.track_id IS NOT NULL THEN
        UPDATE tracks_users
        SET access_granted = false, updated_at = NOW()
        WHERE user_id = NEW.user_id AND track_id = NEW.track_id;
      END IF;

      IF NEW.group_role_id IS NOT NULL THEN
        SELECT MAX(expires_at) INTO latest_expires_at
        FROM content_access
        WHERE user_id = NEW.user_id
          AND group_role_id = NEW.group_role_id
          AND granted_by_group_id = NEW.granted_by_group_id
          AND status = 'active'
          AND id != NEW.id;
        UPDATE group_memberships_group_roles
        SET expires_at = latest_expires_at, updated_at = NOW()
        WHERE user_id = NEW.user_id
          AND group_id = NEW.granted_by_group_id
          AND group_role_id = NEW.group_role_id;
        UPDATE group_memberships
        SET expires_at = latest_expires_at, updated_at = NOW()
        WHERE user_id = NEW.user_id
          AND group_id = NEW.granted_by_group_id;
      END IF;

      IF NEW.track_id IS NULL AND NEW.group_role_id IS NULL THEN
        SELECT MAX(expires_at) INTO latest_expires_at
        FROM content_access
        WHERE user_id = NEW.user_id
          AND granted_by_group_id = NEW.granted_by_group_id
          AND track_id IS NULL
          AND group_role_id IS NULL
          AND status = 'active'
          AND id != NEW.id;
        UPDATE group_memberships
        SET expires_at = latest_expires_at, updated_at = NOW()
        WHERE user_id = NEW.user_id
          AND group_id = NEW.granted_by_group_id;
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `)
}

exports.up = async function (knex) {
  const hasCommonRoles = await knex.schema.hasTable('common_roles')
  if (!hasCommonRoles) return

  const hasTypeColumn = await knex.schema.hasColumn('groups_roles', 'type')
  if (!hasTypeColumn) {
    await knex.schema.alterTable('groups_roles', table => {
      table.string('type').notNullable().defaultTo('custom')
    })
  }

  const responsibilityByName = await getSystemResponsibilityIds(knex)
  const commonRoleNameById = await getCommonRoleNameById(knex)
  const now = new Date()

  await stampSystemRolesBulk(knex, responsibilityByName, now)
  const groupSystemRoleMaps = await buildGroupSystemRoleMaps(knex, commonRoleNameById)

  // Migrate group_memberships_common_roles -> group_memberships_group_roles
  await knex.raw(`
    INSERT INTO group_memberships_group_roles (user_id, group_id, group_role_id, active, created_at, updated_at)
    SELECT gmcr.user_id, gmcr.group_id, gr.id, true, ?, ?
    FROM group_memberships_common_roles gmcr
    JOIN common_roles cr ON cr.id = gmcr.common_role_id
    JOIN groups_roles gr ON gr.group_id = gmcr.group_id AND gr.name = cr.name AND gr.type = 'system'
    WHERE NOT EXISTS (
      SELECT 1 FROM group_memberships_group_roles existing
      WHERE existing.user_id = gmcr.user_id
        AND existing.group_id = gmcr.group_id
        AND existing.group_role_id = gr.id
    )
  `, [now, now])

  // Migrate content_access.common_role_id -> group_role_id
  const hasContentAccessCommonRole = await knex.schema.hasColumn('content_access', 'common_role_id')
  if (hasContentAccessCommonRole) {
    await knex.raw(`
      UPDATE content_access ca
      SET group_role_id = gr.id
      FROM common_roles cr, groups_roles gr
      WHERE ca.common_role_id = cr.id
        AND ca.common_role_id IS NOT NULL
        AND gr.group_id = COALESCE(ca.granted_by_group_id, ca.group_id)
        AND gr.name = cr.name
        AND gr.type = 'system'
    `)
  }

  // Migrate group_invites.common_role_id -> group_role_id
  const hasInviteCommonRole = await knex.schema.hasColumn('group_invites', 'common_role_id')
  if (hasInviteCommonRole) {
    await knex.raw(`
      UPDATE group_invites gi
      SET group_role_id = gr.id, common_role_id = NULL
      FROM common_roles cr, groups_roles gr
      WHERE gi.common_role_id = cr.id
        AND gi.common_role_id IS NOT NULL
        AND gr.group_id = gi.group_id
        AND gr.name = cr.name
        AND gr.type = 'system'
    `)
  }

  // Migrate tracks with completion_role_type = 'common'
  const hasTrackCompletionType = await knex.schema.hasColumn('tracks', 'completion_role_type')
  if (hasTrackCompletionType) {
    await knex.raw(`
      UPDATE tracks t
      SET completion_role_id = gr.id, completion_role_type = 'group'
      FROM groups_tracks gt
      JOIN groups_roles gr ON gr.group_id = gt.group_id AND gr.type = 'system'
      JOIN common_roles cr ON cr.name = gr.name
      WHERE gt.track_id = t.id
        AND t.completion_role_type = 'common'
        AND t.completion_role_id IS NOT NULL
        AND cr.id = t.completion_role_id
    `)
  }

  // Migrate funding_rounds submitter_roles / voter_roles JSON (small table — keep in JS)
  const fundingRounds = await knex('funding_rounds').select('id', 'group_id', 'submitter_roles', 'voter_roles')

  const mapRoleJson = (rolesJson, groupId) => {
    if (!rolesJson) return rolesJson
    const roles = typeof rolesJson === 'string' ? JSON.parse(rolesJson) : rolesJson
    if (!Array.isArray(roles)) return rolesJson
    return roles.map(roleInfo => {
      if (roleInfo.type !== 'common') return roleInfo
      const groupRoleId = groupSystemRoleMaps[groupId]?.byCommonId[roleInfo.id]
      if (!groupRoleId) return roleInfo
      return { type: 'group', id: groupRoleId }
    })
  }

  for (const round of fundingRounds) {
    const updates = {}
    const mappedSubmitters = mapRoleJson(round.submitter_roles, round.group_id)
    const mappedVoters = mapRoleJson(round.voter_roles, round.group_id)
    if (mappedSubmitters) updates.submitter_roles = JSON.stringify(mappedSubmitters)
    if (mappedVoters) updates.voter_roles = JSON.stringify(mappedVoters)
    if (Object.keys(updates).length > 0) {
      await knex('funding_rounds').where({ id: round.id }).update(updates)
    }
  }

  // Migrate user_scopes common_role -> group_role
  const hasUserScopes = await knex.schema.hasTable('user_scopes')
  if (hasUserScopes) {
    await migrateUserScopesCommonToGroup(knex)
  }

  // Drop common_role_id from content_access trigger functions before dropping the column
  if (hasContentAccessCommonRole) {
    await updateContentAccessTriggersWithoutCommonRole(knex)
  }

  // Drop common_role_id columns
  if (hasContentAccessCommonRole) {
    await knex.schema.alterTable('content_access', table => {
      table.dropIndex(['common_role_id'])
      table.dropForeign(['common_role_id'])
      table.dropColumn('common_role_id')
    })
  }

  if (hasInviteCommonRole) {
    await knex.schema.alterTable('group_invites', table => {
      table.dropForeign(['common_role_id'])
      table.dropColumn('common_role_id')
    })
  }

  await knex.schema.dropTableIfExists('group_memberships_common_roles')
  await knex.schema.dropTableIfExists('common_roles_responsibilities')
  await knex.schema.dropTableIfExists('common_roles')
}

exports.down = async function (knex) {
  const hasCommonRoles = await knex.schema.hasTable('common_roles')
  if (hasCommonRoles) return

  const systemRoleById = await getSystemGroupRolesById(knex)
  const systemRoleIds = Object.keys(systemRoleById).map(Number)
  if (systemRoleIds.length === 0) return

  const responsibilityByName = await getSystemResponsibilityIds(knex)
  const now = new Date()
  const commonRoleIdByName = await recreateCommonRolesTables(knex, responsibilityByName, now)

  // Restore content_access.common_role_id for system group role grants
  const hasContentAccessCommonRole = await knex.schema.hasColumn('content_access', 'common_role_id')
  if (!hasContentAccessCommonRole) {
    await knex.schema.alterTable('content_access', table => {
      table.integer('common_role_id').unsigned().references('id').inTable('common_roles').nullable()
      table.index(['common_role_id'])
    })

    await knex.raw(`
      UPDATE content_access ca
      SET common_role_id = cr.id, group_role_id = NULL
      FROM groups_roles gr, common_roles cr
      WHERE ca.group_role_id = gr.id
        AND gr.type = 'system'
        AND cr.name = gr.name
    `)
  }

  // Restore group_invites.common_role_id for system group role invites
  const hasInviteCommonRole = await knex.schema.hasColumn('group_invites', 'common_role_id')
  if (!hasInviteCommonRole) {
    await knex.schema.alterTable('group_invites', table => {
      table.bigInteger('common_role_id').references('id').inTable('common_roles')
    })

    await knex.raw(`
      UPDATE group_invites gi
      SET common_role_id = cr.id, group_role_id = NULL
      FROM groups_roles gr, common_roles cr
      WHERE gi.group_role_id = gr.id
        AND gr.type = 'system'
        AND cr.name = gr.name
    `)
  }

  // Restore tracks completion_role_type = 'common' for system group roles
  const hasTrackCompletionType = await knex.schema.hasColumn('tracks', 'completion_role_type')
  if (hasTrackCompletionType) {
    await knex.raw(`
      UPDATE tracks t
      SET completion_role_id = cr.id, completion_role_type = 'common'
      FROM groups_roles gr, common_roles cr
      WHERE t.completion_role_id = gr.id
        AND gr.type = 'system'
        AND cr.name = gr.name
    `)
  }

  // Reverse funding_rounds submitter_roles / voter_roles JSON
  const fundingRounds = await knex('funding_rounds').select('id', 'submitter_roles', 'voter_roles')
  for (const round of fundingRounds) {
    const updates = {}
    const mappedSubmitters = reverseMapRoleJson(round.submitter_roles, systemRoleById, commonRoleIdByName)
    const mappedVoters = reverseMapRoleJson(round.voter_roles, systemRoleById, commonRoleIdByName)
    if (mappedSubmitters) updates.submitter_roles = JSON.stringify(mappedSubmitters)
    if (mappedVoters) updates.voter_roles = JSON.stringify(mappedVoters)
    if (Object.keys(updates).length > 0) {
      await knex('funding_rounds').where({ id: round.id }).update(updates)
    }
  }

  // Reverse user_scopes group_role -> common_role for system roles
  const hasUserScopes = await knex.schema.hasTable('user_scopes')
  if (hasUserScopes) {
    await migrateUserScopesGroupToCommon(knex)
  }

  // Migrate system group role assignments back to group_memberships_common_roles
  await knex.raw(`
    INSERT INTO group_memberships_common_roles (user_id, group_id, common_role_id)
    SELECT mgr.user_id, mgr.group_id, cr.id
    FROM group_memberships_group_roles mgr
    JOIN groups_roles gr ON gr.id = mgr.group_role_id AND gr.type = 'system'
    JOIN common_roles cr ON cr.name = gr.name
    WHERE NOT EXISTS (
      SELECT 1 FROM group_memberships_common_roles existing
      WHERE existing.user_id = mgr.user_id
        AND existing.group_id = mgr.group_id
        AND existing.common_role_id = cr.id
    )
  `)

  await knex('group_memberships_group_roles')
    .whereIn('group_role_id', systemRoleIds)
    .delete()

  await knex('group_roles_responsibilities')
    .whereIn('group_role_id', systemRoleIds)
    .delete()

  await knex('groups_roles')
    .whereIn('id', systemRoleIds)
    .delete()
}
