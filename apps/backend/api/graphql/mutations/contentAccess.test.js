/* eslint-disable no-unused-expressions */
import path from 'path'
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import { dependencyOf, mockify, unspyify } from '../../../test/setup/helpers'
import {
  grantContentAccess,
  revokeContentAccess,
  recordStripePurchase,
  refundContentAccess
} from './contentAccess'
import { filterAndSortContentAccess } from '../../services/Search/util'
const { expect } = require('chai')

/* global ContentAccess, StripeProduct, Track, GroupRole, Queue, Frontend */

const MEMBER_ROLE_ERROR = 'The Member role cannot be edited, assigned or used as a requirement'

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
      group_id: group.id
    }).save()

    // Add admin user as group administrator
    await adminUser.joinGroup(group, { assignAdministrator: true })
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

    it('grants access to a group or space for a user', async () => {
      const result = await grantContentAccess(adminUser.id, {
        userId: user.id,
        grantedByGroupId: group.id,
        groupId: group.id,
        reason: 'Promotional access'
      })

      expect(result.success).to.be.true
      expect(result.groupId).to.equal(group.id)

      // Verify the access record was created
      const access = await ContentAccess.where({ id: result.id }).fetch()
      expect(access.get('group_id')).to.equal(group.id)
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

    it('grants access to all current group members when grantToAllMembers is true', async () => {
      const anotherMember = await factories.user().save()
      await anotherMember.joinGroup(group)

      const result = await grantContentAccess(adminUser.id, {
        grantedByGroupId: group.id,
        productId: product.id,
        reason: 'Mass grant',
        grantToAllMembers: true
      })

      expect(result.success).to.be.true
      expect(result.grantedCount).to.be.at.least(3) // admin, user, anotherMember
      expect(result.userId).to.be.null

      const accessForUser = await ContentAccess.query(q => {
        q.where({
          user_id: user.id,
          product_id: product.id,
          access_type: 'admin_grant'
        })
      }).fetchAll()
      expect(accessForUser.length).to.be.at.least(1)

      const accessForAnother = await ContentAccess.query(q => {
        q.where({
          user_id: anotherMember.id,
          product_id: product.id,
          access_type: 'admin_grant'
        })
      }).fetchAll()
      expect(accessForAnother.length).to.be.at.least(1)
    })

    it('rejects mass grant without productId, groupId, or groupRoleId', async () => {
      await expect(
        grantContentAccess(adminUser.id, {
          grantedByGroupId: group.id,
          grantToAllMembers: true,
          reason: 'Test'
        })
      ).to.be.rejectedWith('Must specify either groupId, productId, or groupRoleId')
    })

    it('rejects grant when neither userId nor grantToAllMembers is provided', async () => {
      await expect(
        grantContentAccess(adminUser.id, {
          grantedByGroupId: group.id,
          productId: product.id,
          reason: 'Test'
        })
      ).to.be.rejectedWith('Must specify userId or set grantToAllMembers')
    })

    it('rejects access grant without groupId, productId, or groupRoleId', async () => {
      await expect(
        grantContentAccess(adminUser.id, {
          userId: user.id,
          grantedByGroupId: group.id,
          reason: 'Test'
        })
      ).to.be.rejectedWith('Must specify either groupId, productId, or groupRoleId')
    })
  })

  describe('grantContentAccess with a role', () => {
    it('rejects the Member role', async () => {
      const memberRole = await GroupRole.findMemberRole(group.id)
      await expect(grantContentAccess(adminUser.id, {
        userId: user.id,
        grantedByGroupId: group.id,
        groupRoleId: memberRole.id,
        reason: 'Everyone'
      })).to.be.rejectedWith(MEMBER_ROLE_ERROR)

      const grants = await ContentAccess.where({ group_role_id: memberRole.id }).count()
      expect(Number(grants)).to.equal(0)
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

      expect(result.get('status')).to.equal('revoked')

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
        groupRoleId: role.id,
        sessionId: 'cs_test_789',
        metadata: { source: 'webhook' }
      })

      expect(result.success).to.be.true

      const access = await ContentAccess.where({ id: result.id }).fetch()
      expect(access.get('group_role_id')).to.equal(role.id)
      expect(access.get('access_type')).to.equal('stripe_purchase')
    })
  })

  describe('refundContentAccess', () => {
    let StripeService, accessRecord, queued, refundCalls, cancelCalls

    before(async () => {
      const stripeAccount = await factories.stripeAccount({ stripe_account_external_id: 'acct_refund_mutation' }).save()
      await group.save({ stripe_account_id: stripeAccount.id }, { patch: true })
    })

    beforeEach(async () => {
      await user.addSetting({ locale: 'es' }, true)
      accessRecord = await ContentAccess.create({
        user_id: user.id,
        granted_by_group_id: group.id,
        group_id: group.id,
        product_id: product.id,
        access_type: 'stripe_purchase',
        stripe_session_id: 'cs_refund_mutation',
        status: 'active'
      })

      StripeService = dependencyOf(
        path.resolve(__dirname, 'contentAccess.js'),
        path.resolve(__dirname, '../../services/StripeService.js')
      )
      mockify(StripeService, 'getCheckoutSession', async () => ({ payment_intent: 'pi_refund_mutation' }))
      refundCalls = []
      mockify(StripeService, 'refund', async params => {
        refundCalls.push(params)
        return { id: 're_refund_mutation', amount: 1000, currency: 'usd', charge: 'ch_refund_mutation' }
      })
      cancelCalls = []
      mockify(StripeService, 'cancelSubscription', async params => {
        cancelCalls.push(params)
        return { id: params.subscriptionId, cancel_at_period_end: true, cancel_at: 1893456000 }
      })
      queued = []
      mockify(Queue, 'classMethod', (className, methodName, data) => {
        queued.push({ className, methodName, data })
        return Promise.resolve()
      })
    })

    afterEach(() => {
      unspyify(StripeService, 'getCheckoutSession')
      unspyify(StripeService, 'refund')
      unspyify(StripeService, 'cancelSubscription')
      unspyify(Queue, 'classMethod')
    })

    const subscriptionPurchase = () => ContentAccess.create({
      user_id: user.id,
      granted_by_group_id: group.id,
      group_id: group.id,
      product_id: product.id,
      access_type: 'stripe_purchase',
      stripe_session_id: 'cs_refund_subscription',
      stripe_subscription_id: 'sub_refund_mutation',
      status: 'active'
    })

    it('refunds the purchase, keeps access and emails the member what was refunded and why', async () => {
      const result = await refundContentAccess(adminUser.id, {
        accessId: accessRecord.id,
        reason: 'Event cancelled'
      })

      expect(result.get('status')).to.equal('active')
      expect(result.get('refunded_at')).to.be.an.instanceof(Date)
      expect(result.get('refunded_amount')).to.equal(1000)
      const metadata = result.get('metadata')
      expect(metadata).to.include({
        refundId: 're_refund_mutation',
        refund_charge_id: 'ch_refund_mutation',
        refund_source: 'hylo_refund_button',
        refund_amount: 1000,
        refundReason: 'Event cancelled'
      })
      expect(metadata.revokedAt).to.equal(undefined)
      expect(metadata.revokedBy).to.equal(undefined)
      expect(cancelCalls).to.have.length(0)
      expect(refundCalls).to.deep.equal([{
        accountId: 'acct_refund_mutation',
        paymentIntentId: 'pi_refund_mutation',
        reason: 'requested_by_customer'
      }])

      const emails = queued.filter(q => q.methodName === 'sendRefundProcessed')
      expect(emails).to.have.length(1)
      expect(emails[0].className).to.equal('Email')
      expect(emails[0].data.email).to.equal(user.get('email'))
      expect(emails[0].data.locale).to.equal('es-ES')
      expect(emails[0].data.data).to.include({
        offering_name: 'Test Product',
        group_name: group.get('name'),
        group_url: Frontend.Route.group(group),
        refund_amount_formatted: '$10.00',
        currency: 'USD',
        refund_reason: 'Event cancelled'
      })
    })

    it('does not email the member when the refund fails', async () => {
      mockify(StripeService, 'refund', async () => { throw new Error('card_declined') })

      await expect(refundContentAccess(adminUser.id, { accessId: accessRecord.id }))
        .to.be.rejectedWith('Failed to refund access')

      expect(queued.filter(q => q.methodName === 'sendRefundProcessed')).to.have.length(0)
      await accessRecord.refresh()
      expect(accessRecord.get('status')).to.equal('active')
      expect(accessRecord.get('refunded_at')).to.equal(null)
    })

    it('leaves a refunded subscription running unless the steward asks to cancel future payments', async () => {
      const subscriptionAccess = await subscriptionPurchase()

      const result = await refundContentAccess(adminUser.id, { accessId: subscriptionAccess.id })

      expect(refundCalls[0]).to.include({ subscriptionId: 'sub_refund_mutation' })
      expect(result.get('status')).to.equal('active')
      expect(result.get('refunded_at')).to.be.an.instanceof(Date)
      expect(cancelCalls).to.have.length(0)
      expect(result.get('metadata').subscription_cancel_at_period_end).to.equal(undefined)
      expect(queued.filter(q => q.methodName === 'sendRefundProcessed')).to.have.length(1)
    })

    it('cancels future payments at the end of the paid period when asked, keeping access until then', async () => {
      const subscriptionAccess = await subscriptionPurchase()

      const result = await refundContentAccess(adminUser.id, {
        accessId: subscriptionAccess.id,
        cancelFuturePayments: true
      })

      expect(cancelCalls).to.deep.equal([{
        accountId: 'acct_refund_mutation',
        subscriptionId: 'sub_refund_mutation',
        immediately: false
      }])
      expect(result.get('status')).to.equal('active')
      expect(result.get('metadata')).to.include({
        subscription_cancel_at_period_end: true,
        subscription_period_end: new Date(1893456000 * 1000).toISOString()
      })
      expect(queued.filter(q => q.methodName === 'sendRefundProcessed')).to.have.length(1)
    })

    it('lists a refunded purchase under the Refunded filter while it stays active', async () => {
      await refundContentAccess(adminUser.id, { accessId: accessRecord.id })
      const earlierButtonRefund = await ContentAccess.create({
        user_id: user.id,
        granted_by_group_id: group.id,
        group_id: group.id,
        access_type: 'stripe_purchase',
        status: 'refunded'
      })
      const notRefunded = await ContentAccess.create({
        user_id: user.id,
        granted_by_group_id: group.id,
        group_id: group.id,
        access_type: 'stripe_purchase',
        status: 'active'
      })
      const idsFor = async status => (await ContentAccess.query(filterAndSortContentAccess({ groupIds: [group.id], status })).fetchAll())
        .map(access => String(access.id))

      const refundedIds = await idsFor('refunded')
      expect(refundedIds).to.include(String(accessRecord.id))
      expect(refundedIds).to.include(String(earlierButtonRefund.id))
      expect(refundedIds).to.not.include(String(notRefunded.id))

      const activeIds = await idsFor('active')
      expect(activeIds).to.include(String(accessRecord.id))
      expect(activeIds).to.include(String(notRefunded.id))
      expect(activeIds).to.not.include(String(earlierButtonRefund.id))
    })

    it('refuses to refund the same payment twice, with a clear message', async () => {
      await refundContentAccess(adminUser.id, { accessId: accessRecord.id })

      await expect(refundContentAccess(adminUser.id, { accessId: accessRecord.id }))
        .to.be.rejectedWith('The most recent payment for this purchase has already been refunded')

      expect(refundCalls).to.have.length(1)
      expect(queued.filter(q => q.methodName === 'sendRefundProcessed')).to.have.length(1)
    })

    it('refunds a subscription again only after a newer payment', async () => {
      const subscriptionAccess = await subscriptionPurchase()
      await refundContentAccess(adminUser.id, { accessId: subscriptionAccess.id })

      await expect(refundContentAccess(adminUser.id, { accessId: subscriptionAccess.id }))
        .to.be.rejectedWith('already been refunded')
      expect(refundCalls).to.have.length(1)

      await subscriptionAccess.refresh()
      const renewedAt = new Date(new Date(subscriptionAccess.get('refunded_at')).getTime() + 1000)
      await subscriptionAccess.save({
        metadata: { ...subscriptionAccess.get('metadata'), subscription_period_start: renewedAt.toISOString() }
      }, { patch: true })

      const result = await refundContentAccess(adminUser.id, { accessId: subscriptionAccess.id })
      expect(refundCalls).to.have.length(2)
      expect(result.get('status')).to.equal('active')
    })

    it('ignores cancelFuturePayments for a one-time purchase', async () => {
      const result = await refundContentAccess(adminUser.id, {
        accessId: accessRecord.id,
        cancelFuturePayments: true
      })

      expect(cancelCalls).to.have.length(0)
      expect(result.get('status')).to.equal('active')
    })
  })
})
