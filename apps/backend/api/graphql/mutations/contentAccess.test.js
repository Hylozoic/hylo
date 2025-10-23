/* eslint-disable no-unused-expressions */
import '../../../test/setup'
import factories from '../../../test/setup/factories'
import {
  grantContentAccess,
  revokeContentAccess,
  checkContentAccess,
  recordStripePurchase
} from './contentAccess'
const { expect } = require('chai')

/* global setup */

describe('Content Access Mutations', () => {
  let user, adminUser, group, product, track

  before(async () => {
    // Create test entities
    user = await factories.user().save()
    adminUser = await factories.user().save()
    group = await factories.group().save()
    product = await factories.stripeProduct({ group_id: group.id }).save()
    track = await factories.track({ group_id: group.id }).save()

    // Add admin user as group administrator
    await adminUser.joinGroup(group, { role: GroupMembership.Role.MODERATOR })
    // Add regular user as group member
    await user.joinGroup(group)
  })

  after(() => setup.clearDb())

  describe('grantContentAccess', () => {
    it('grants access to a product for a user', async () => {
      const result = await grantContentAccess({
        userId: user.id,
        groupId: group.id,
        productId: product.id,
        reason: 'Staff member'
      }, { session: { userId: adminUser.id } })

      expect(result.success).to.be.true
      expect(result.userId).to.equal(user.id)
      expect(result.groupId).to.equal(group.id)
      expect(result.productId).to.equal(product.id)
      expect(result.accessType).to.equal('admin_grant')
      expect(result.status).to.equal('active')

      // Verify the access record was created
      const access = await ContentAccess.where({ id: result.id }).fetch()
      expect(access).to.exist
      expect(access.get('user_id')).to.equal(user.id)
      expect(access.get('group_id')).to.equal(group.id)
      expect(access.get('product_id')).to.equal(product.id)
      expect(access.get('access_type')).to.equal('admin_grant')
      expect(access.get('status')).to.equal('active')
    })

    it('grants access to a track for a user', async () => {
      const result = await grantContentAccess({
        userId: user.id,
        groupId: group.id,
        trackId: track.id,
        reason: 'Promotional access'
      }, { session: { userId: adminUser.id } })

      expect(result.success).to.be.true
      expect(result.trackId).to.equal(track.id)

      // Verify the access record was created
      const access = await ContentAccess.where({ id: result.id }).fetch()
      expect(access.get('track_id')).to.equal(track.id)
    })

    it('grants access with expiration date', async () => {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now

      const result = await grantContentAccess({
        userId: user.id,
        groupId: group.id,
        productId: product.id,
        expiresAt,
        reason: 'Temporary access'
      }, { session: { userId: adminUser.id } })

      expect(result.success).to.be.true

      const access = await ContentAccess.where({ id: result.id }).fetch()
      expect(access.get('expires_at')).to.be.closeToTime(expiresAt, 1000)
    })

    it('rejects access grant for non-authenticated users', async () => {
      await expect(
        grantContentAccess({
          userId: user.id,
          groupId: group.id,
          productId: product.id,
          reason: 'Test'
        }, { session: null })
      ).to.be.rejectedWith('You must be logged in to grant content access')
    })

    it('rejects access grant for non-admin users', async () => {
      await expect(
        grantContentAccess({
          userId: user.id,
          groupId: group.id,
          productId: product.id,
          reason: 'Test'
        }, { session: { userId: user.id } })
      ).to.be.rejectedWith('You must be a group administrator to grant content access')
    })

    it('rejects access grant for non-existent user', async () => {
      await expect(
        grantContentAccess({
          userId: 99999,
          groupId: group.id,
          productId: product.id,
          reason: 'Test'
        }, { session: { userId: adminUser.id } })
      ).to.be.rejectedWith('User not found')
    })

    it('rejects access grant for non-existent group', async () => {
      await expect(
        grantContentAccess({
          userId: user.id,
          groupId: 99999,
          productId: product.id,
          reason: 'Test'
        }, { session: { userId: adminUser.id } })
      ).to.be.rejectedWith('Group not found')
    })

    it('rejects access grant without productId or trackId', async () => {
      await expect(
        grantContentAccess({
          userId: user.id,
          groupId: group.id,
          reason: 'Test'
        }, { session: { userId: adminUser.id } })
      ).to.be.rejectedWith('Must specify either productId or trackId')
    })
  })

  describe('revokeContentAccess', () => {
    let accessRecord

    beforeEach(async () => {
      // Create an access record to revoke
      accessRecord = await ContentAccess.create({
        user_id: user.id,
        group_id: group.id,
        product_id: product.id,
        access_type: 'admin_grant',
        status: 'active',
        metadata: { reason: 'Test access' }
      })
    })

    it('revokes access for admin users', async () => {
      const result = await revokeContentAccess({
        accessId: accessRecord.id,
        reason: 'Access no longer needed'
      }, { session: { userId: adminUser.id } })

      expect(result.success).to.be.true
      expect(result.message).to.equal('Access revoked successfully')

      // Verify the access record was revoked
      await accessRecord.refresh()
      expect(accessRecord.get('status')).to.equal('revoked')
    })

    it('rejects revocation for non-authenticated users', async () => {
      await expect(
        revokeContentAccess({
          accessId: accessRecord.id,
          reason: 'Test'
        }, { session: null })
      ).to.be.rejectedWith('You must be logged in to revoke content access')
    })

    it('rejects revocation for non-admin users', async () => {
      await expect(
        revokeContentAccess({
          accessId: accessRecord.id,
          reason: 'Test'
        }, { session: { userId: user.id } })
      ).to.be.rejectedWith('You must be a group administrator to revoke access')
    })

    it('rejects revocation for non-existent access record', async () => {
      await expect(
        revokeContentAccess({
          accessId: 99999,
          reason: 'Test'
        }, { session: { userId: adminUser.id } })
      ).to.be.rejectedWith('Access record not found')
    })
  })

  describe('checkContentAccess', () => {
    beforeEach(async () => {
      // Create an active access record
      await ContentAccess.create({
        user_id: user.id,
        group_id: group.id,
        product_id: product.id,
        access_type: 'admin_grant',
        status: 'active',
        metadata: { reason: 'Test access' }
      })
    })

    it('returns access information for user with access', async () => {
      const result = await checkContentAccess({
        userId: user.id,
        groupId: group.id,
        productId: product.id
      }, { session: { userId: user.id } })

      expect(result.hasAccess).to.be.true
      expect(result.accessType).to.equal('admin_grant')
      expect(result.grantedAt).to.exist
    })

    it('returns no access for user without access', async () => {
      const otherUser = await factories.user().save()

      const result = await checkContentAccess({
        userId: otherUser.id,
        groupId: group.id,
        productId: product.id
      }, { session: { userId: otherUser.id } })

      expect(result.hasAccess).to.be.false
      expect(result.accessType).to.be.null
      expect(result.expiresAt).to.be.null
      expect(result.grantedAt).to.be.null
    })

    it('returns no access for non-existent product', async () => {
      const result = await checkContentAccess({
        userId: user.id,
        groupId: group.id,
        productId: 99999
      }, { session: { userId: user.id } })

      expect(result.hasAccess).to.be.false
    })
  })

  describe('recordStripePurchase', () => {
    it('records a successful Stripe purchase', async () => {
      const sessionId = 'cs_test_123'
      const paymentIntentId = 'pi_test_123'
      const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now

      const result = await recordStripePurchase({
        userId: user.id,
        groupId: group.id,
        productId: product.id,
        sessionId,
        paymentIntentId,
        expiresAt,
        metadata: { source: 'webhook' }
      }, { session: { userId: adminUser.id } })

      expect(result.success).to.be.true
      expect(result.message).to.equal('Purchase recorded successfully')

      // Verify the access record was created
      const access = await ContentAccess.where({ id: result.id }).fetch()
      expect(access.get('user_id')).to.equal(user.id)
      expect(access.get('group_id')).to.equal(group.id)
      expect(access.get('product_id')).to.equal(product.id)
      expect(access.get('access_type')).to.equal('stripe_purchase')
      expect(access.get('stripe_session_id')).to.equal(sessionId)
      expect(access.get('stripe_payment_intent_id')).to.equal(paymentIntentId)
      expect(access.get('expires_at')).to.be.closeToTime(expiresAt, 1000)
      expect(access.get('metadata')).to.deep.include({ source: 'webhook' })
    })

    it('records a track-specific purchase', async () => {
      const result = await recordStripePurchase({
        userId: user.id,
        groupId: group.id,
        trackId: track.id,
        sessionId: 'cs_test_456',
        paymentIntentId: 'pi_test_456',
        metadata: { source: 'webhook' }
      }, { session: { userId: adminUser.id } })

      expect(result.success).to.be.true

      const access = await ContentAccess.where({ id: result.id }).fetch()
      expect(access.get('track_id')).to.equal(track.id)
      expect(access.get('access_type')).to.equal('stripe_purchase')
    })

    it('records a role-specific purchase', async () => {
      const roleId = 1

      const result = await recordStripePurchase({
        userId: user.id,
        groupId: group.id,
        roleId,
        sessionId: 'cs_test_789',
        paymentIntentId: 'pi_test_789',
        metadata: { source: 'webhook' }
      }, { session: { userId: adminUser.id } })

      expect(result.success).to.be.true

      const access = await ContentAccess.where({ id: result.id }).fetch()
      expect(access.get('role_id')).to.equal(roleId)
      expect(access.get('access_type')).to.equal('stripe_purchase')
    })
  })
})
