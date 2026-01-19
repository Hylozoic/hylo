/* eslint-disable no-unused-expressions */
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import {
  grantContentAccess,
  revokeContentAccess,
  recordStripePurchase
} from './contentAccess'
const { expect } = require('chai')

/* global ContentAccess, GroupMembership, StripeProduct, Track, GroupRole */

describe('Content Access Mutations', () => {
  let user, adminUser, group, product, track

  before(async () => {
    // Create test entities
    user = await factories.user().save()
    adminUser = await factories.user().save()
    group = await factories.group().save()
    product = await StripeProduct.forge({
      group_id: group.id,
      stripe_product_id: 'prod_test_123',
      stripe_price_id: 'price_test_123',
      name: 'Test Product',
      description: 'Test Description',
      price_in_cents: 1000,
      currency: 'usd',
      publish_status: 'published'
    }).save()
    track = await Track.forge({
      name: 'Test Track',
      description: 'Test Track Description'
    }).save()
    await group.tracks().attach(track.id)

    // Add admin user as group administrator
    await adminUser.joinGroup(group, { role: GroupMembership.Role.MODERATOR })
    // Add regular user as group member
    await user.joinGroup(group)
  })

  after(() => setup.clearDb())

  describe('grantContentAccess', () => {
    it('grants access to a product for a user', async () => {
      const result = await grantContentAccess(adminUser.id, {
        userId: user.id,
        grantedByGroupId: group.id,
        productId: product.id,
        reason: 'Staff member'
      })

      expect(result.success).to.be.true
      expect(result.userId).to.equal(user.id)
      expect(result.grantedByGroupId).to.equal(group.id)
      expect(result.productId).to.equal(product.id)
      expect(result.accessType).to.equal('admin_grant')
      expect(result.status).to.equal('active')

      // Verify the access record was created
      const access = await ContentAccess.where({ id: result.id }).fetch()
      expect(access).to.exist
      expect(access.get('user_id')).to.equal(user.id)
      expect(access.get('granted_by_group_id')).to.equal(group.id)
      expect(access.get('product_id')).to.equal(product.id)
      expect(access.get('access_type')).to.equal('admin_grant')
      expect(access.get('status')).to.equal('active')
    })

    it('grants access to a track for a user', async () => {
      const result = await grantContentAccess(adminUser.id, {
        userId: user.id,
        grantedByGroupId: group.id,
        trackId: track.id,
        reason: 'Promotional access'
      })

      expect(result.success).to.be.true
      expect(result.trackId).to.equal(track.id)

      // Verify the access record was created
      const access = await ContentAccess.where({ id: result.id }).fetch()
      expect(access.get('track_id')).to.equal(track.id)
    })

    it('grants access with expiration date', async () => {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now

      const result = await grantContentAccess(adminUser.id, {
        userId: user.id,
        grantedByGroupId: group.id,
        productId: product.id,
        expiresAt,
        reason: 'Temporary access'
      })

      expect(result.success).to.be.true

      const access = await ContentAccess.where({ id: result.id }).fetch()
      expect(access.get('expires_at')).to.be.closeToTime(expiresAt, 1000)
    })

    it('rejects access grant for non-authenticated users', async () => {
      await expect(
        grantContentAccess(null, {
          userId: user.id,
          grantedByGroupId: group.id,
          productId: product.id,
          reason: 'Test'
        })
      ).to.be.rejectedWith('You must be logged in to grant content access')
    })

    it('rejects access grant for non-admin users', async () => {
      await expect(
        grantContentAccess(user.id, {
          userId: user.id,
          grantedByGroupId: group.id,
          productId: product.id,
          reason: 'Test'
        })
      ).to.be.rejectedWith('You must be an administrator of the granting group to grant content access')
    })

    it('rejects access grant for non-existent user', async () => {
      await expect(
        grantContentAccess(adminUser.id, {
          userId: 99999,
          grantedByGroupId: group.id,
          productId: product.id,
          reason: 'Test'
        })
      ).to.be.rejectedWith('User not found')
    })

    it('rejects access grant for non-existent group', async () => {
      await expect(
        grantContentAccess(adminUser.id, {
          userId: user.id,
          grantedByGroupId: 99999,
          productId: product.id,
          reason: 'Test'
        })
      ).to.be.rejectedWith('Granting group not found')
    })

    it('rejects access grant without productId or trackId', async () => {
      await expect(
        grantContentAccess(adminUser.id, {
          userId: user.id,
          grantedByGroupId: group.id,
          reason: 'Test'
        })
      ).to.be.rejectedWith('Must specify either productId, trackId, or roleId')
    })
  })

  describe('revokeContentAccess', () => {
    let accessRecord

    beforeEach(async () => {
      // Create an access record to revoke
      accessRecord = await ContentAccess.create({
        user_id: user.id,
        granted_by_group_id: group.id,
        product_id: product.id,
        access_type: 'admin_grant',
        status: 'active',
        metadata: { reason: 'Test access' }
      })
    })

    it('revokes access for admin users', async () => {
      const result = await revokeContentAccess(adminUser.id, {
        accessId: accessRecord.id,
        reason: 'Access no longer needed'
      })

      expect(result.success).to.be.true
      expect(result.message).to.equal('Access revoked successfully')

      // Verify the access record was revoked
      await accessRecord.refresh()
      expect(accessRecord.get('status')).to.equal('revoked')
    })

    it('rejects revocation for non-authenticated users', async () => {
      await expect(
        revokeContentAccess(null, {
          accessId: accessRecord.id,
          reason: 'Test'
        })
      ).to.be.rejectedWith('You must be logged in to revoke content access')
    })

    it('rejects revocation for non-admin users', async () => {
      await expect(
        revokeContentAccess(user.id, {
          accessId: accessRecord.id,
          reason: 'Test'
        })
      ).to.be.rejectedWith('You must be an administrator of the granting group to revoke access')
    })

    it('rejects revocation for non-existent access record', async () => {
      await expect(
        revokeContentAccess(adminUser.id, {
          accessId: 99999,
          reason: 'Test'
        })
      ).to.be.rejectedWith('Access record not found')
    })
  })

  describe('recordStripePurchase', () => {
    it('records a successful Stripe purchase', async () => {
      const sessionId = 'cs_test_123'
      const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now

      const result = await recordStripePurchase(adminUser.id, {
        userId: user.id,
        grantedByGroupId: group.id,
        productId: product.id,
        sessionId,
        expiresAt,
        metadata: { source: 'webhook' }
      })

      expect(result.success).to.be.true
      expect(result.message).to.equal('Purchase recorded successfully')

      // Verify the access record was created
      const access = await ContentAccess.where({ id: result.id }).fetch()
      expect(access.get('user_id')).to.equal(user.id)
      expect(access.get('granted_by_group_id')).to.equal(group.id)
      expect(access.get('product_id')).to.equal(product.id)
      expect(access.get('access_type')).to.equal('stripe_purchase')
      expect(access.get('stripe_session_id')).to.equal(sessionId)
      expect(access.get('expires_at')).to.be.closeToTime(expiresAt, 1000)
      expect(access.get('metadata')).to.deep.include({ source: 'webhook' })
    })

    it('records a track-specific purchase', async () => {
      const result = await recordStripePurchase(adminUser.id, {
        userId: user.id,
        grantedByGroupId: group.id,
        trackId: track.id,
        sessionId: 'cs_test_456',
        metadata: { source: 'webhook' }
      })

      expect(result.success).to.be.true

      const access = await ContentAccess.where({ id: result.id }).fetch()
      expect(access.get('track_id')).to.equal(track.id)
      expect(access.get('access_type')).to.equal('stripe_purchase')
    })

    it('records a role-specific purchase', async () => {
      // Create a role for this group first
      const role = await GroupRole.forge({
        group_id: group.id,
        name: 'Test Role',
        emoji: '👤',
        color: '#FF0000',
        active: true
      }).save()

      const result = await recordStripePurchase(adminUser.id, {
        userId: user.id,
        grantedByGroupId: group.id,
        roleId: role.id,
        sessionId: 'cs_test_789',
        metadata: { source: 'webhook' }
      })

      expect(result.success).to.be.true

      const access = await ContentAccess.where({ id: result.id }).fetch()
      expect(access.get('role_id')).to.equal(role.id)
      expect(access.get('access_type')).to.equal('stripe_purchase')
    })
  })
})
