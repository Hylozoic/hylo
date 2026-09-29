/* eslint-disable no-unused-expressions */
import setup from '../../setup'
import { withFeatureFlag } from '../../setup/helpers'
import { isFeatureEnabled, MEMBER_INVITES } from '../../../lib/featureFlags'

const migration = require('../../../migrations/20261003000000_invite_policy_stewards_moderators_and_open_groups')
const { convertInvitePolicies, memberInvitesOn } = require('../../../migrations/scripts/convertInvitePolicies')

const ROLLBACK = new Error('rollback')
const OPEN = 2
const RESTRICTED = 1
const CLOSED = 0

describe('migration 20261003000000_invite_policy_stewards_moderators_and_open_groups', () => {
  before(() => setup.clearDb())
  after(() => setup.clearDb())

  it('reads member invitations as switched on exactly when the server does', async () => {
    const keys = ['FEATURE_FLAG_MEMBER_INVITES', 'SENTRY_ENV', 'NODE_ENV']
    const saved = keys.map(key => process.env[key])
    try {
      for (const flag of [undefined, 'on', 'off', 'true', 'false', ' On ', 'nonsense']) {
        for (const sentryEnv of [undefined, 'production', 'staging']) {
          for (const nodeEnv of ['test', 'production', 'development', undefined]) {
            const values = [flag, sentryEnv, nodeEnv]
            keys.forEach((key, i) => {
              if (values[i] === undefined) delete process.env[key]
              else process.env[key] = values[i]
            })
            expect(memberInvitesOn(), JSON.stringify(values)).to.equal(isFeatureEnabled(MEMBER_INVITES))
          }
        }
      }
    } finally {
      keys.forEach((key, i) => {
        if (saved[i] === undefined) delete process.env[key]
        else process.env[key] = saved[i]
      })
    }
  })

  it('links Member in Open groups and Moderator in Restricted and Closed groups still on stewards, only once member invitations are on, re-runs cleanly and reverses only its own links', async () => {
    await bookshelf.knex.transaction(async trx => {
      const now = new Date()
      const inviteMembersId = (await trx('responsibilities').where({ title: 'Invite Members', type: 'system' }).first('id')).id

      const insertGroup = attrs => trx('groups')
        .insert({ name: attrs.slug, access_code: attrs.slug, created_at: now, ...attrs })
        .returning('id')
        .then(([row]) => Number(row.id || row))
      const insertRole = attrs => trx('groups_roles')
        .insert({ emoji: '', active: true, created_at: now, updated_at: now, ...attrs })
        .returning('id')
        .then(([row]) => Number(row.id || row))
      const addRoles = async groupId => ({
        member: await insertRole({ group_id: groupId, name: 'Member', type: 'member' }),
        moderator: await insertRole({ group_id: groupId, name: 'Moderator', type: 'system' }),
        host: await insertRole({ group_id: groupId, name: 'Host', type: 'system' })
      })
      const link = groupRoleId => trx('group_roles_responsibilities')
        .insert({ group_role_id: groupRoleId, responsibility_id: inviteMembersId })
      const linkedRoleIds = async groupId => (await trx('group_roles_responsibilities as grr')
        .join('groups_roles as gr', 'gr.id', 'grr.group_role_id')
        .where({ 'gr.group_id': groupId, 'grr.responsibility_id': inviteMembersId })
        .orderBy('gr.id')
        .pluck('gr.id')).map(Number)

      const open = await insertGroup({ slug: 'migr-open', accessibility: OPEN })
      const openRoles = await addRoles(open)
      const restricted = await insertGroup({ slug: 'migr-restricted', accessibility: RESTRICTED })
      const restrictedRoles = await addRoles(restricted)
      const closed = await insertGroup({ slug: 'migr-closed', accessibility: CLOSED })
      const closedRoles = await addRoles(closed)

      // Already chose specific roles, or everyone: untouched
      const customised = await insertGroup({ slug: 'migr-customised', accessibility: OPEN })
      await addRoles(customised)
      const gardener = await insertRole({ group_id: customised, name: 'Gardener', type: 'custom' })
      await link(gardener)
      const everyone = await insertGroup({ slug: 'migr-everyone', accessibility: RESTRICTED })
      const everyoneRoles = await addRoles(everyone)
      await link(everyoneRoles.member)

      // An Open group created before Member roles existed
      const olderOpen = await insertGroup({ slug: 'migr-older-open', accessibility: OPEN })
      await insertRole({ group_id: olderOpen, name: 'Moderator', type: 'system' })

      // Spaces have no invite policy
      const space = await insertGroup({ slug: 'migr-space', type: 'space', parent_id: open, accessibility: OPEN })

      // With member invitations switched off, the migration only prepares the tracking table
      await withFeatureFlag('MEMBER_INVITES', 'off', () => migration.up(trx))
      expect(await trx.schema.hasTable('invite_policy_migration_links')).to.be.true
      for (const groupId of [open, restricted, closed, olderOpen, space]) {
        expect(await linkedRoleIds(groupId)).to.deep.equal([])
      }
      expect(await trx('groups_roles').where({ group_id: olderOpen, type: 'member' }).first('id')).to.not.exist

      // The script run when they are switched on does the conversion
      await convertInvitePolicies(trx)

      const olderMember = await trx('groups_roles').where({ group_id: olderOpen, type: 'member' }).first('id')
      const afterUp = {
        open: await linkedRoleIds(open),
        restricted: await linkedRoleIds(restricted),
        closed: await linkedRoleIds(closed),
        customised: await linkedRoleIds(customised),
        everyone: await linkedRoleIds(everyone),
        olderOpen: await linkedRoleIds(olderOpen),
        space: await linkedRoleIds(space)
      }
      expect(afterUp).to.deep.equal({
        open: [openRoles.member],
        restricted: [restrictedRoles.moderator],
        closed: [closedRoles.moderator],
        customised: [gardener],
        everyone: [everyoneRoles.member],
        olderOpen: [Number(olderMember.id)],
        space: []
      })

      await convertInvitePolicies(trx)
      await withFeatureFlag('MEMBER_INVITES', 'on', () => migration.up(trx))
      for (const [name, groupId] of Object.entries({ open, restricted, closed, customised, everyone, olderOpen, space })) {
        expect(await linkedRoleIds(groupId), name).to.deep.equal(afterUp[name])
      }

      await migration.down(trx)
      expect(await trx.schema.hasTable('invite_policy_migration_links')).to.be.false
      expect(await linkedRoleIds(open)).to.deep.equal([])
      expect(await linkedRoleIds(restricted)).to.deep.equal([])
      expect(await linkedRoleIds(closed)).to.deep.equal([])
      expect(await linkedRoleIds(olderOpen)).to.deep.equal([])
      expect(await linkedRoleIds(customised)).to.deep.equal([gardener])
      expect(await linkedRoleIds(everyone)).to.deep.equal([everyoneRoles.member])

      // Where member invitations are already on, the migration converts by itself
      await withFeatureFlag('MEMBER_INVITES', 'on', () => migration.up(trx))
      expect(await linkedRoleIds(open)).to.deep.equal([openRoles.member])
      expect(await linkedRoleIds(restricted)).to.deep.equal([restrictedRoles.moderator])
      await migration.down(trx)
      expect(await linkedRoleIds(open)).to.deep.equal([])

      throw ROLLBACK
    }).catch(err => {
      if (err !== ROLLBACK) throw err
    })
  })
})
