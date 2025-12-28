/* eslint-disable no-unused-expressions */
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import { checkContentAccess } from './contentAccess'
const { expect } = require('chai')

/* global ContentAccess, GroupMembership, StripeProduct */

describe('Content Access Queries', () => {
  let user, adminUser, group, product

  before(async () => {
    // Create test entities
    user = await factories.user().save()
    adminUser = await factories.user().save()
    group = await factories.group().save()
    product = await StripeProduct.forge({
      group_id: group.id,
      stripe_product_id: 'prod_test_query_123',
      stripe_price_id: 'price_test_query_123',
      name: 'Test Product for Query',
      description: 'Test Description',
      price_in_cents: 1000,
      currency: 'usd',
      publish_status: 'published'
    }).save()

    // Add admin user as group administrator
    await adminUser.joinGroup(group, { role: GroupMembership.Role.MODERATOR })
    // Add regular user as group member
    await user.joinGroup(group)
  })

  after(() => setup.clearDb())

  describe('checkContentAccess', () => {
    beforeEach(async () => {
      // Create an active access record
      await ContentAccess.create({
        user_id: user.id,
        granted_by_group_id: group.id,
        product_id: product.id,
        access_type: 'admin_grant',
        status: 'active',
        metadata: { reason: 'Test access' }
      })
    })

    it('returns access information for user with access', async () => {
      const result = await checkContentAccess(user.id, {
        userId: user.id,
        grantedByGroupId: group.id,
        productId: product.id
      })

      expect(result.hasAccess).to.be.true
      expect(result.accessType).to.equal('admin_grant')
      expect(result.grantedAt).to.exist
    })

    it('returns no access for user without access', async () => {
      const otherUser = await factories.user().save()

      const result = await checkContentAccess(otherUser.id, {
        userId: otherUser.id,
        grantedByGroupId: group.id,
        productId: product.id
      })

      expect(result.hasAccess).to.be.false
      expect(result.accessType).to.be.null
      expect(result.expiresAt).to.be.null
      expect(result.grantedAt).to.be.null
    })

    it('returns no access for non-existent product', async () => {
      const result = await checkContentAccess(user.id, {
        userId: user.id,
        grantedByGroupId: group.id,
        productId: 99999
      })

      expect(result.hasAccess).to.be.false
    })
  })
})

