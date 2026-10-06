import setup from '../../setup'
import factories from '../../setup/factories'

/* global StripeProduct, GroupRole, MemberGroupRole */

describe('StripeProduct', () => {
  describe('generateContentAccessRecords', () => {
    let user, group, role

    before(async () => {
      user = await factories.user().save()
      group = await factories.group().save()
      await user.joinGroup(group)
      role = await GroupRole.forge({ group_id: group.id, name: 'Supporter', emoji: '💚', type: GroupRole.TYPE_CUSTOM, active: true }).save()
    })

    after(() => setup.clearDb())

    it('grants only the roles whose ids are plain decimal digits', async () => {
      const product = await StripeProduct.forge({
        group_id: group.id,
        stripe_product_id: 'prod_role_ids',
        stripe_price_id: 'price_role_ids',
        name: 'Supporter',
        price_in_cents: 500,
        currency: 'usd',
        access_grants: { groupRoleIds: [`+${role.id}`, `${role.id}x`, String(role.id)] }
      }).save()

      const records = await product.generateContentAccessRecords({ userId: user.id, sessionId: 'cs_test_role_ids' })

      expect(records.map(record => Number(record.get('group_role_id')))).to.deep.equal([Number(role.id)])
      const assignments = await MemberGroupRole.where({ user_id: user.id, group_id: group.id, group_role_id: role.id }).count()
      expect(Number(assignments)).to.equal(1)
    })
  })
})
