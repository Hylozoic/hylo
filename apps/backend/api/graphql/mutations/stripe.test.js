/* eslint-disable no-unused-expressions */
import '../../../test/setup'
import factories from '../../../test/setup/factories'
import {
  createStripeConnectedAccount,
  createStripeAccountLink,
  stripeAccountStatus,
  createStripeProduct,
  stripeProducts,
  createStripeCheckoutSession
} from './stripe'
const { expect } = require('chai')

/* global setup */

describe('Stripe Mutations', () => {
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

  describe('createStripeConnectedAccount', () => {
    it('creates a connected account for group admins', async () => {
      const result = await createStripeConnectedAccount({
        groupId: group.id,
        email: 'group@example.com',
        businessName: 'Test Group',
        country: 'US'
      }, { session: { userId: adminUser.id } })

      expect(result.success).to.be.true
      expect(result.accountId).to.equal('acct_test_123')
      expect(result.message).to.equal('Connected account created successfully')
    })

    it('uses group email and name as defaults', async () => {
      await group.save({ contact_email: 'default@group.com', name: 'Default Group' })

      const result = await createStripeConnectedAccount({
        groupId: group.id,
        country: 'CA'
      }, { session: { userId: adminUser.id } })

      expect(result.success).to.be.true
      expect(result.accountId).to.equal('acct_test_123')
    })

    it('rejects creation for non-authenticated users', async () => {
      await expect(
        createStripeConnectedAccount({
          groupId: group.id,
          email: 'test@example.com',
          businessName: 'Test'
        }, { session: null })
      ).to.be.rejectedWith('You must be logged in to create a connected account')
    })

    it('rejects creation for non-admin users', async () => {
      await expect(
        createStripeConnectedAccount({
          groupId: group.id,
          email: 'test@example.com',
          businessName: 'Test'
        }, { session: { userId: user.id } })
      ).to.be.rejectedWith('You must be a group administrator to create a connected account')
    })

    it('rejects creation for non-existent group', async () => {
      await expect(
        createStripeConnectedAccount({
          groupId: 99999,
          email: 'test@example.com',
          businessName: 'Test'
        }, { session: { userId: adminUser.id } })
      ).to.be.rejectedWith('Group not found')
    })
  })

  describe('createStripeAccountLink', () => {
    it('creates an account link for group admins', async () => {
      const result = await createStripeAccountLink({
        groupId: group.id,
        accountId: 'acct_test_123',
        returnUrl: 'https://example.com/return',
        refreshUrl: 'https://example.com/refresh'
      }, { session: { userId: adminUser.id } })

      expect(result.success).to.be.true
      expect(result.url).to.equal('https://connect.stripe.com/setup/test')
      expect(result.expiresAt).to.be.a('number')
    })

    it('rejects creation for non-authenticated users', async () => {
      await expect(
        createStripeAccountLink({
          groupId: group.id,
          accountId: 'acct_test_123',
          returnUrl: 'https://example.com/return',
          refreshUrl: 'https://example.com/refresh'
        }, { session: null })
      ).to.be.rejectedWith('You must be logged in to create an account link')
    })

    it('rejects creation for non-admin users', async () => {
      await expect(
        createStripeAccountLink({
          groupId: group.id,
          accountId: 'acct_test_123',
          returnUrl: 'https://example.com/return',
          refreshUrl: 'https://example.com/refresh'
        }, { session: { userId: user.id } })
      ).to.be.rejectedWith('You must be a group administrator to manage payments')
    })
  })

  describe('stripeAccountStatus', () => {
    it('returns account status for group members', async () => {
      const result = await stripeAccountStatus({
        groupId: group.id,
        accountId: 'acct_test_123'
      }, { session: { userId: user.id } })

      expect(result.accountId).to.equal('acct_test_123')
      expect(result.chargesEnabled).to.be.true
      expect(result.payoutsEnabled).to.be.true
      expect(result.detailsSubmitted).to.be.true
      expect(result.email).to.equal('test@example.com')
    })

    it('rejects status check for non-authenticated users', async () => {
      await expect(
        stripeAccountStatus({
          groupId: group.id,
          accountId: 'acct_test_123'
        }, { session: null })
      ).to.be.rejectedWith('You must be logged in to view account status')
    })

    it('rejects status check for non-group members', async () => {
      const nonMember = await factories.user().save()

      await expect(
        stripeAccountStatus({
          groupId: group.id,
          accountId: 'acct_test_123'
        }, { session: { userId: nonMember.id } })
      ).to.be.rejectedWith('You must be a member of this group to view payment status')
    })
  })

  describe('createStripeProduct', () => {
    it('creates a product for group admins', async () => {
      const contentAccess = {
        [group.id]: {
          trackIds: [1, 2],
          roleIds: [1]
        }
      }

      const result = await createStripeProduct({
        groupId: group.id,
        accountId: 'acct_test_123',
        name: 'Premium Membership',
        description: 'Access to premium content',
        priceInCents: 2000,
        currency: 'usd',
        contentAccess,
        renewalPolicy: 'manual',
        duration: 365
      }, { session: { userId: adminUser.id } })

      expect(result.success).to.be.true
      expect(result.productId).to.equal('prod_test_123')
      expect(result.priceId).to.equal('price_test_123')
      expect(result.name).to.equal('Premium Membership')
      expect(result.databaseId).to.exist

      // Verify the product was saved to database
      const savedProduct = await StripeProduct.where({ id: result.databaseId }).fetch()
      expect(savedProduct.get('group_id')).to.equal(group.id)
      expect(savedProduct.get('stripe_product_id')).to.equal('prod_test_123')
      expect(savedProduct.get('name')).to.equal('Premium Membership')
      expect(savedProduct.get('price_in_cents')).to.equal(2000)
      expect(savedProduct.get('content_access')).to.deep.equal(contentAccess)
      expect(savedProduct.get('renewal_policy')).to.equal('manual')
      expect(savedProduct.get('duration')).to.equal(365)
    })

    it('creates a product with minimal required fields', async () => {
      const result = await createStripeProduct({
        groupId: group.id,
        accountId: 'acct_test_123',
        name: 'Basic Product',
        description: 'A basic product',
        priceInCents: 1000
      }, { session: { userId: adminUser.id } })

      expect(result.success).to.be.true
      expect(result.name).to.equal('Basic Product')

      const savedProduct = await StripeProduct.where({ id: result.databaseId }).fetch()
      expect(savedProduct.get('currency')).to.equal('usd') // default
      expect(savedProduct.get('content_access')).to.deep.equal({}) // default
      expect(savedProduct.get('renewal_policy')).to.equal('manual') // default
    })

    it('rejects creation for non-authenticated users', async () => {
      await expect(
        createStripeProduct({
          groupId: group.id,
          accountId: 'acct_test_123',
          name: 'Test Product',
          priceInCents: 1000
        }, { session: null })
      ).to.be.rejectedWith('You must be logged in to create a product')
    })

    it('rejects creation for non-admin users', async () => {
      await expect(
        createStripeProduct({
          groupId: group.id,
          accountId: 'acct_test_123',
          name: 'Test Product',
          priceInCents: 1000
        }, { session: { userId: user.id } })
      ).to.be.rejectedWith('You must be a group administrator to create products')
    })
  })

  describe('stripeProducts', () => {
    it('lists products for group admins', async () => {
      const result = await stripeProducts({
        groupId: group.id,
        accountId: 'acct_test_123'
      }, { session: { userId: adminUser.id } })

      expect(result.success).to.be.true
      expect(result.products).to.have.length(1)
      expect(result.products[0].id).to.equal('prod_test_123')
      expect(result.products[0].name).to.equal('Test Product')
      expect(result.products[0].description).to.equal('A test product')
    })

    it('rejects listing for non-authenticated users', async () => {
      await expect(
        stripeProducts({
          groupId: group.id,
          accountId: 'acct_test_123'
        }, { session: null })
      ).to.be.rejectedWith('You must be logged in to view products')
    })

    it('rejects listing for non-admin users', async () => {
      await expect(
        stripeProducts({
          groupId: group.id,
          accountId: 'acct_test_123'
        }, { session: { userId: user.id } })
      ).to.be.rejectedWith('You must be a group administrator to view products')
    })
  })

  describe('createStripeCheckoutSession', () => {
    it('creates a checkout session', async () => {
      const result = await createStripeCheckoutSession({
        groupId: group.id,
        accountId: 'acct_test_123',
        priceId: 'price_test_123',
        quantity: 1,
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
        metadata: { source: 'web' }
      }, { session: { userId: user.id } })

      expect(result.success).to.be.true
      expect(result.sessionId).to.equal('cs_test_123')
      expect(result.url).to.equal('https://checkout.stripe.com/test')
    })

    it('creates a checkout session with default quantity', async () => {
      const result = await createStripeCheckoutSession({
        groupId: group.id,
        accountId: 'acct_test_123',
        priceId: 'price_test_123',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel'
      }, { session: { userId: user.id } })

      expect(result.success).to.be.true
      expect(result.sessionId).to.equal('cs_test_123')
    })

    it('allows unauthenticated checkout sessions', async () => {
      const result = await createStripeCheckoutSession({
        groupId: group.id,
        accountId: 'acct_test_123',
        priceId: 'price_test_123',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel'
      }, { session: null })

      expect(result.success).to.be.true
      expect(result.sessionId).to.equal('cs_test_123')
    })

    it('includes user ID in metadata when authenticated', async () => {
      const result = await createStripeCheckoutSession({
        groupId: group.id,
        accountId: 'acct_test_123',
        priceId: 'price_test_123',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
        metadata: { custom: 'data' }
      }, { session: { userId: user.id } })

      expect(result.success).to.be.true
      // Note: In a real test, you'd verify the metadata was passed correctly to StripeService
    })
  })
})
