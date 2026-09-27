/* eslint-disable no-unused-expressions */
import setup from '../../setup'

const migration = require('../../../migrations/20260927120000_member_role_and_invite_members')

const ROLLBACK = new Error('rollback')
const OLD_ADD_MEMBERS_DESCRIPTION = 'The ability to invite and add new people to the group, and to accept or reject join requests.'

async function snapshot (trx, groupIds) {
  const memberRows = await trx('groups_roles')
    .whereIn('group_id', groupIds)
    .where({ type: 'member' })
    .orderBy('group_id')
  const memberLinks = await trx('group_roles_responsibilities')
    .whereIn('group_role_id', memberRows.map(row => row.id))
  const inviteMembers = await trx('responsibilities').where({ title: 'Invite Members', type: 'system' })
  const addMembers = await trx('responsibilities').where({ title: 'Add Members', type: 'system' }).first()
  const indexes = await trx('pg_indexes')
    .whereIn('indexname', ['groups_roles_one_member_role', 'group_roles_responsibilities_group_role_id_index'])
    .orderBy('indexname')
    .pluck('indexname')
  return {
    memberRoleGroupIds: memberRows.map(row => Number(row.group_id)),
    memberLinks: memberLinks.length,
    inviteMembers: inviteMembers.length,
    addMembersDescription: addMembers.description,
    indexes
  }
}

describe('migration 20260927120000_member_role_and_invite_members', () => {
  before(() => setup.clearDb())
  after(() => setup.clearDb())

  it('adds one unlinked Member role per top-level group, reverses cleanly and can re-run', async () => {
    const originalLog = console.log
    console.log = () => {}
    try {
      await bookshelf.knex.transaction(async trx => {
        const now = new Date()
        const insertGroup = attrs => trx('groups')
          .insert({ name: attrs.slug, access_code: attrs.slug, created_at: now, ...attrs })
          .returning('id')
          .then(([id]) => Number(id))
        const topLevel = await insertGroup({ slug: 'migr-top' })
        const inactive = await insertGroup({ slug: 'migr-inactive', active: false })
        const space = await insertGroup({ slug: 'migr-space', type: 'space', parent_id: topLevel })
        const groupIds = [topLevel, inactive, space]

        const [clashId] = await trx('responsibilities')
          .insert({ title: ' invite MEMBERS ', type: 'group', group_id: topLevel })
          .returning('id')

        // Fire deferred FK checks between steps, as separate migration runs would
        const flush = () => trx.raw('SET CONSTRAINTS ALL IMMEDIATE')

        await migration.down(trx)
        await flush()
        const down = await snapshot(trx, groupIds)
        expect(down).to.deep.equal({
          memberRoleGroupIds: [],
          memberLinks: 0,
          inviteMembers: 0,
          addMembersDescription: OLD_ADD_MEMBERS_DESCRIPTION,
          indexes: []
        })

        await migration.up(trx)
        await flush()
        const up = await snapshot(trx, groupIds)
        expect(up.memberRoleGroupIds).to.deep.equal([topLevel, inactive].sort((a, b) => a - b))
        expect(up.memberLinks).to.equal(0)
        expect(up.inviteMembers).to.equal(1)
        expect(up.addMembersDescription).to.not.equal(OLD_ADD_MEMBERS_DESCRIPTION)
        expect(up.indexes).to.deep.equal(['group_roles_responsibilities_group_role_id_index', 'groups_roles_one_member_role'])

        const clash = await trx('responsibilities').where({ id: clashId }).first()
        expect(clash.title).to.equal('invite MEMBERS (custom)')

        await migration.up(trx)
        await flush()
        expect(await snapshot(trx, groupIds)).to.deep.equal(up)
        const clashAfterRerun = await trx('responsibilities').where({ id: clashId }).first()
        expect(clashAfterRerun.title).to.equal('invite MEMBERS (custom)')

        await expect(trx('groups_roles').insert({ group_id: topLevel, name: 'Member', type: 'member', active: true }))
          .to.be.rejectedWith(/groups_roles_one_member_role/)

        throw ROLLBACK
      })
    } catch (err) {
      if (err !== ROLLBACK) throw err
    } finally {
      console.log = originalLog
    }
  })
})
