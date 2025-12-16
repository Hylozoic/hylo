/* eslint-disable no-unused-expressions */
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import mock from 'mock-require'
const { expect } = require('chai')

/* global StripeAccount, GroupMembership, StripeProduct */

// Mock StripeService to avoid real API calls
const mockStripeService = {
  getAccountStatus: async (accountId) => ({
    id: accountId,
    email: 'test@example.com',
    charges_enabled: true,
    payouts_enabled: true,
    details_submitted: true,
    requirements: []
  }),

  getProducts: async (accountId) => ({
    data: [{
      id: 'prod_test_123',
      name: 'Test Product',
      description: 'A test product',
      default_price: 'price_test_123',
      active: true
    }]
  })
}

// Mock OfferingStatsService for stats queries
const mockOfferingStatsService = {
  getSubscriptionStats: async (productId) => ({
    activeCount: 5,
    lapsedCount: 2
  })
}

// Mock the services before importing the queries
mock('../../services/StripeService', mockStripeService)
mock('../../services/OfferingStatsService', mockOfferingStatsService)

// Import after mocking
import {
  stripeAccountStatus,
  stripeOfferings,
  publicStripeOfferings,
  publicStripeOffering,
  offeringSubscriptionStats
} from './stripe'

describe('Stripe Queries', () => {
  let user, adminUser, group

  before(async () => {
    // Create test entities
    user = await factories.user().save()
    adminUser = await factories.user().save()
    group = await factories.group().save()

    // Add admin user as group administrator
    await adminUser.joinGroup(group, { role: GroupMembership.Role.MODERATOR })
    // Add regular user as group member
    await user.joinGroup(group)
  })

  after(() => setup.clearDb())

  describe('stripeAccountStatus', () => {
    it('returns account status for group members', async () => {
      const result = await stripeAccountStatus(user.id, {
        groupId: group.id,
        accountId: 'acct_test_123'
      })

      expect(result.accountId).to.equal('acct_test_123')
      expect(result.chargesEnabled).to.be.true
      expect(result.payoutsEnabled).to.be.true
      expect(result.detailsSubmitted).to.be.true
      expect(result.email).to.equal('test@example.com')
    })

    it('rejects status check for non-authenticated users', async () => {
      await expect(
        stripeAccountStatus(null, {
          groupId: group.id,
          accountId: 'acct_test_123'
        })
      ).to.be.rejectedWith('You must be logged in to view account status')
    })

    it('rejects status check for non-group members', async () => {
      const nonMember = await factories.user().save()

      await expect(
        stripeAccountStatus(nonMember.id, {
          groupId: group.id,
          accountId: 'acct_test_123'
        })
      ).to.be.rejectedWith('You must be a member of this group to view payment status')
    })
  })

  describe('stripeOfferings', () => {
    before(async () => {
      // Clean up any existing offerings for this group from previous tests
      await StripeProduct.where({ group_id: group.id }).destroy({ require: false })

      // Create a stripe_account for these tests
      const testStripeAccount = await StripeAccount.forge({
        stripe_account_external_id: 'acct_test_123'
      }).save()

      await group.save({ stripe_account_id: testStripeAccount.id })

      // Create some test offerings
      await StripeProduct.create({
        group_id: group.id,
        stripe_product_id: 'prod_test_1',
        stripe_price_id: 'price_test_1',
        name: 'Test Offering 1',
        description: 'A test offering',
        price_in_cents: 1000,
        currency: 'usd',
        publish_status: 'published'
      })

      await StripeProduct.create({
        group_id: group.id,
        stripe_product_id: 'prod_test_2',
        stripe_price_id: 'price_test_2',
        name: 'Test Offering 2',
        description: 'Another test offering',
        price_in_cents: 2000,
        currency: 'usd',
        publish_status: 'unpublished'
      })
    })

    it('lists offerings for group admins', async () => {
      const result = await stripeOfferings(adminUser.id, {
        groupId: group.id,
        accountId: 'acct_test_123'
      })

      expect(result.success).to.be.true
      expect(result.offerings).to.have.length(2)
    })

    it('rejects listing for non-authenticated users', async () => {
      await expect(
        stripeOfferings(null, {
          groupId: group.id,
          accountId: 'acct_test_123'
        })
      ).to.be.rejectedWith('You must be logged in to view offerings')
    })

    it('rejects listing for non-admin users', async () => {
      await expect(
        stripeOfferings(user.id, {
          groupId: group.id,
          accountId: 'acct_test_123'
        })
      ).to.be.rejectedWith('You must be a group administrator to view offerings')
    })
  })

  describe('publicStripeOfferings', () => {
    let testGroup

    before(async () => {
      // Create a stripe_account for these tests
      const testStripeAccount = await StripeAccount.forge({
        stripe_account_external_id: 'acct_test_123'
      }).save()

      testGroup = await factories.group().save()
      await testGroup.save({ stripe_account_id: testStripeAccount.id })

      // Create published offering with group access
      await StripeProduct.create({
        group_id: testGroup.id,
        stripe_product_id: 'prod_published_1',
        stripe_price_id: 'price_published_1',
        name: 'Published Offering',
        description: 'A published offering',
        price_in_cents: 1000,
        currency: 'usd',
        access_grants: JSON.stringify({ groupIds: [testGroup.id] }),
        publish_status: 'published'
      })

      // Create unpublished offering (should not appear)
      await StripeProduct.create({
        group_id: testGroup.id,
        stripe_product_id: 'prod_unpublished_1',
        stripe_price_id: 'price_unpublished_1',
        name: 'Unpublished Offering',
        description: 'An unpublished offering',
        price_in_cents: 2000,
        currency: 'usd',
        access_grants: JSON.stringify({ groupIds: [testGroup.id] }),
        publish_status: 'unpublished'
      })

      // Create published offering without group access (should not appear)
      await StripeProduct.create({
        group_id: testGroup.id,
        stripe_product_id: 'prod_no_access_1',
        stripe_price_id: 'price_no_access_1',
        name: 'No Group Access Offering',
        description: 'An offering without group access',
        price_in_cents: 3000,
        currency: 'usd',
        access_grants: JSON.stringify({ trackIds: [1] }),
        publish_status: 'published'
      })
    })

    it('returns only published offerings with group access', async () => {
      const result = await publicStripeOfferings(null, {
        groupId: testGroup.id
      })

      expect(result.success).to.be.true
      expect(result.offerings).to.have.length(1)
      expect(result.offerings[0].get('name')).to.equal('Published Offering')
      expect(result.offerings[0].get('publish_status')).to.equal('published')
    })

    it('works without authentication', async () => {
      const result = await publicStripeOfferings(null, {
        groupId: testGroup.id
      })

      expect(result.success).to.be.true
      expect(result.offerings).to.be.an('array')
    })

    it('returns empty array when no matching offerings exist', async () => {
      const emptyGroup = await factories.group().save()

      const result = await publicStripeOfferings(null, {
        groupId: emptyGroup.id
      })

      expect(result.success).to.be.true
      expect(result.offerings).to.have.length(0)
    })
  })

  describe('publicStripeOffering', () => {
    let testOffering

    before(async () => {
      testOffering = await StripeProduct.create({
        group_id: group.id,
        stripe_product_id: 'prod_single_test',
        stripe_price_id: 'price_single_test',
        name: 'Single Offering',
        description: 'A single test offering',
        price_in_cents: 1500,
        currency: 'usd',
        publish_status: 'unlisted'
      })
    })

    it('returns a single offering by ID', async () => {
      const result = await publicStripeOffering(null, {
        offeringId: testOffering.id
      })

      expect(result.get('name')).to.equal('Single Offering')
      expect(result.get('price_in_cents')).to.equal(1500)
    })

    it('works without authentication', async () => {
      const result = await publicStripeOffering(null, {
        offeringId: testOffering.id
      })

      expect(result).to.exist
      expect(result.get('name')).to.equal('Single Offering')
    })

    it('returns unlisted offerings', async () => {
      const result = await publicStripeOffering(null, {
        offeringId: testOffering.id
      })

      expect(result.get('publish_status')).to.equal('unlisted')
    })

    it('rejects non-existent offering', async () => {
      await expect(
        publicStripeOffering(null, {
          offeringId: 99999
        })
      ).to.be.rejectedWith('Offering not found')
    })
  })

  describe('offeringSubscriptionStats', () => {
    let testOffering

    before(async () => {
      testOffering = await StripeProduct.create({
        group_id: group.id,
        stripe_product_id: 'prod_stats_test',
        stripe_price_id: 'price_stats_test',
        name: 'Stats Test Offering',
        description: 'An offering for testing stats',
        price_in_cents: 2000,
        currency: 'usd',
        publish_status: 'published'
      })
    })

    it('returns subscription stats for group admins', async () => {
      const result = await offeringSubscriptionStats(adminUser.id, {
        offeringId: testOffering.id,
        groupId: group.id
      })

      expect(result.success).to.be.true
      expect(result.activeCount).to.equal(5)
      expect(result.lapsedCount).to.equal(2)
      expect(result.currency).to.equal('usd')
    })

    it('rejects stats for non-authenticated users', async () => {
      await expect(
        offeringSubscriptionStats(null, {
          offeringId: testOffering.id,
          groupId: group.id
        })
      ).to.be.rejectedWith('You must be logged in to view offering stats')
    })

    it('rejects stats for non-admin users', async () => {
      await expect(
        offeringSubscriptionStats(user.id, {
          offeringId: testOffering.id,
          groupId: group.id
        })
      ).to.be.rejectedWith('You must be a group administrator to view offering stats')
    })

    it('rejects stats for non-existent offering', async () => {
      await expect(
        offeringSubscriptionStats(adminUser.id, {
          offeringId: 99999,
          groupId: group.id
        })
      ).to.be.rejectedWith('Offering not found or does not belong to this group')
    })

    it('rejects stats when offering belongs to different group', async () => {
      const otherGroup = await factories.group().save()

      await expect(
        offeringSubscriptionStats(adminUser.id, {
          offeringId: testOffering.id,
          groupId: otherGroup.id
        })
      ).to.be.rejectedWith('Offering not found or does not belong to this group')
    })
  })
})

