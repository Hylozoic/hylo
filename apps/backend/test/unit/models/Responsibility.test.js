/* eslint-disable no-unused-expressions */
import setup from '../../setup'
import factories from '../../setup/factories'

describe('Responsibility', () => {
  let group

  before(async () => {
    await setup.clearDb()
    group = await factories.group().save()
  })

  after(async () => {
    await bookshelf.knex('responsibilities').where({ group_id: group.id }).del()
    await setup.clearDb()
  })

  describe('systemId', () => {
    it('returns the id of the platform responsibility, not a group one with the same title', async () => {
      const groupDefined = await Responsibility.forge({
        group_id: group.id,
        title: Responsibility.constants.RESP_INVITE_MEMBERS,
        type: 'group'
      }).save()

      const id = await Responsibility.systemId(Responsibility.constants.RESP_INVITE_MEMBERS)
      const row = await bookshelf.knex('responsibilities').where({ id }).first()
      expect(row.type).to.equal('system')
      expect(row.group_id).to.equal(null)
      expect(id).to.not.equal(groupDefined.id)

      await groupDefined.destroy()
    })

    it('returns null for an unknown title', async () => {
      expect(await Responsibility.systemId('Not A Responsibility')).to.be.null
    })
  })

  describe('isSystemTitle', () => {
    it('matches platform titles ignoring case and surrounding spaces', async () => {
      expect(await Responsibility.isSystemTitle('Invite Members')).to.be.true
      expect(await Responsibility.isSystemTitle('  invite MEMBERS ')).to.be.true
      expect(await Responsibility.isSystemTitle('administration')).to.be.true
    })

    it('does not match other titles', async () => {
      expect(await Responsibility.isSystemTitle('Invite Members Weekly')).to.be.false
      expect(await Responsibility.isSystemTitle('')).to.be.false
      expect(await Responsibility.isSystemTitle(null)).to.be.false
    })
  })

  describe('fetchAll', () => {
    it('lists Invite Members right after Add Members', async () => {
      const rows = await Responsibility.fetchAll({ groupId: group.id })
      const titles = rows.filter(r => r.type === 'system').map(r => r.title)
      expect(titles).to.deep.equal([
        'Administration',
        'Add Members',
        'Invite Members',
        'Remove Members',
        'Manage Content'
      ])
    })
  })
})
