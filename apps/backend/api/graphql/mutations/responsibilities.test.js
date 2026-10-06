/* eslint-disable no-unused-expressions */
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import { withFeatureFlag } from '../../../test/setup/helpers'
import {
  addGroupResponsibility,
  addResponsibilityToRole,
  removeResponsibilityFromRole,
  updateGroupResponsibility
} from './responsibilities'

const MEMBER_ROLE_ERROR = 'The Member role cannot be edited, assigned or used as a requirement'
const RESERVED_TITLE_ERROR = 'A built-in responsibility already has this title'

describe('responsibilities mutations', () => {
  let administrator, member, group, memberRole, customRole, inviteMembersId

  before(async () => {
    administrator = await factories.user().save()
    member = await factories.user().save()
    group = await factories.group().save()
    await administrator.joinGroup(group, { assignAdministrator: true })
    await member.joinGroup(group)
    memberRole = await GroupRole.findMemberRole(group.id)
    customRole = await GroupRole.forge({ group_id: group.id, name: 'Greeter', emoji: '👋', type: GroupRole.TYPE_CUSTOM, active: true }).save()
    inviteMembersId = await Responsibility.systemId(Responsibility.constants.RESP_INVITE_MEMBERS)
  })

  after(async () => {
    await bookshelf.knex('group_roles_responsibilities')
      .whereIn('group_role_id', [memberRole.id, customRole.id])
      .del()
    await bookshelf.knex('responsibilities').where({ group_id: group.id }).del()
    await setup.clearDb()
  })

  describe('custom responsibility titles', () => {
    it('rejects the title of any built-in responsibility, ignoring case and spaces', async () => {
      for (const title of ['Invite Members', ' invite members ', 'ADMINISTRATION', 'add Members']) {
        await expect(addGroupResponsibility({ groupId: group.id, title, userId: administrator.id }))
          .to.be.rejectedWith(RESERVED_TITLE_ERROR)
      }
      const created = await Responsibility.where({ group_id: group.id }).count()
      expect(Number(created)).to.equal(0)
    })

    it('still creates responsibilities with other titles', async () => {
      const responsibility = await addGroupResponsibility({ groupId: group.id, title: 'Invite Members Weekly', userId: administrator.id })
      expect(responsibility.get('title')).to.equal('Invite Members Weekly')
    })

    it('rejects renaming a custom responsibility to a built-in title', async () => {
      const responsibility = await addGroupResponsibility({ groupId: group.id, title: 'Welcome Newcomers', userId: administrator.id })
      await expect(updateGroupResponsibility({ groupId: group.id, responsibilityId: responsibility.id, title: 'invite members', userId: administrator.id }))
        .to.be.rejectedWith(RESERVED_TITLE_ERROR)
      await responsibility.refresh()
      expect(responsibility.get('title')).to.equal('Welcome Newcomers')
    })

    it('still allows editing the description or renaming to another title', async () => {
      const responsibility = await addGroupResponsibility({ groupId: group.id, title: 'Greet People', userId: administrator.id })
      const described = await updateGroupResponsibility({ groupId: group.id, responsibilityId: responsibility.id, title: 'Greet People', description: 'Say hello', userId: administrator.id })
      expect(described.get('description')).to.equal('Say hello')
      const renamed = await updateGroupResponsibility({ groupId: group.id, responsibilityId: responsibility.id, title: 'Greet Everyone', userId: administrator.id })
      expect(renamed.get('title')).to.equal('Greet Everyone')
    })

    it('checks privileges before the title', async () => {
      await expect(addGroupResponsibility({ groupId: group.id, title: 'Invite Members', userId: member.id }))
        .to.be.rejectedWith("User doesn't have required privileges to create group responsibility")
    })
  })

  describe('the implicit Member role', () => {
    it('cannot be given a responsibility', async () => {
      await expect(addResponsibilityToRole({ groupId: group.id, roleId: memberRole.id, responsibilityId: inviteMembersId, userId: administrator.id }))
        .to.be.rejectedWith(MEMBER_ROLE_ERROR)
      const links = await GroupRoleResponsibility.where({ group_role_id: memberRole.id }).count()
      expect(Number(links)).to.equal(0)
    })

    it('cannot be given a responsibility through ids written in other forms Postgres reads as integers', async () => {
      for (const roleId of [`+${memberRole.id}`, `0x${Number(memberRole.id).toString(16)}`, `0_${memberRole.id}`]) {
        await expect(addResponsibilityToRole({ groupId: group.id, roleId, responsibilityId: inviteMembersId, userId: administrator.id }), roleId)
          .to.be.rejectedWith('Invalid role id')
      }
      const links = await GroupRoleResponsibility.where({ group_role_id: memberRole.id }).count()
      expect(Number(links)).to.equal(0)
    })

    it('cannot have a responsibility removed', async () => {
      const link = await GroupRoleResponsibility.forge({ group_role_id: memberRole.id, responsibility_id: inviteMembersId }).save()
      await expect(removeResponsibilityFromRole({ groupId: group.id, roleResponsibilityId: link.id, userId: administrator.id }))
        .to.be.rejectedWith(MEMBER_ROLE_ERROR)
      const stillLinked = await GroupRoleResponsibility.where({ id: link.id }).fetch()
      expect(stillLinked).to.exist
      await stillLinked.destroy()
    })

    it('leaves custom roles editable, including Invite Members', async () => {
      const link = await addResponsibilityToRole({ groupId: group.id, roleId: customRole.id, responsibilityId: inviteMembersId, userId: administrator.id })
      expect(Number(link.get('group_role_id'))).to.equal(customRole.id)
      await removeResponsibilityFromRole({ groupId: group.id, roleResponsibilityId: link.id, userId: administrator.id })
      const remaining = await GroupRoleResponsibility.where({ id: link.id }).fetch()
      expect(remaining).to.be.null
    })

    it('only lets Invite Members be removed from custom roles while member invitations are switched off', async () => {
      const manageContentId = await Responsibility.systemId(Responsibility.constants.RESP_MANAGE_CONTENT)
      const existing = await GroupRoleResponsibility.forge({ group_role_id: customRole.id, responsibility_id: inviteMembersId }).save()

      await withFeatureFlag('MEMBER_INVITES', 'off', async () => {
        await removeResponsibilityFromRole({ groupId: group.id, roleResponsibilityId: existing.id, userId: administrator.id })
        for (const responsibilityId of [inviteMembersId, String(inviteMembersId), `+${inviteMembersId}`, `0x${Number(inviteMembersId).toString(16)}`, ` ${inviteMembersId} `]) {
          await expect(addResponsibilityToRole({ groupId: group.id, roleId: customRole.id, responsibilityId, userId: administrator.id }))
            .to.be.rejectedWith(GroupRole.MEMBER_INVITES_UNAVAILABLE_ERROR)
        }
        const links = await GroupRoleResponsibility.where({ group_role_id: customRole.id, responsibility_id: inviteMembersId }).count()
        expect(Number(links)).to.equal(0)

        const link = await addResponsibilityToRole({ groupId: group.id, roleId: customRole.id, responsibilityId: manageContentId, userId: administrator.id })
        expect(Number(link.get('responsibility_id'))).to.equal(manageContentId)
        await removeResponsibilityFromRole({ groupId: group.id, roleResponsibilityId: link.id, userId: administrator.id })
      })
    })
  })
})
