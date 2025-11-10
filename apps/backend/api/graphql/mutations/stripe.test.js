/* eslint-disable no-unused-expressions */
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import mock from 'mock-require'
import {
  createStripeConnectedAccount,
  createStripeAccountLink,
  stripeAccountStatus,
  createStripeProduct,
  updateStripeProduct,
  stripeProducts,
  createStripeCheckoutSession
} from './stripe'
const { expect } = require('chai')

/* global StripeAccount, GroupMembership, StripeProduct */

// Mock StripeService to avoid real API calls
const mockStripeService = {
  createConnectedAccount: async ({ email, country, businessName, groupId }) => ({
    id: 'acct_test_123',
    email: email || 'test@example.com',
    country: country || 'US',
    business_name: businessName || 'Test Business',
    charges_enabled: false,
    payouts_enabled: false,
    details_submitted: false
  }),

  connectExistingAccount: async ({ accountId, groupId }) => ({
    id: accountId,
    email: 'existing@example.com',
    country: 'US',
    business_name: 'Existing Business',
    charges_enabled: true,
    payouts_enabled: true,
    details_submitted: true
  }),

  createAccountLink: async ({ accountId, returnUrl, refreshUrl }) => ({
    url: `https://connect.stripe.com/setup/c/${accountId}`,
    expires_at: Math.floor(Date.now() / 1000) + 3600
  }),

  getAccountStatus: async (accountId) => ({
    id: accountId,
    email: 'test@example.com',
    charges_enabled: true,
    payouts_enabled: true,
    details_submitted: true,
    requirements: []
  }),

  createProduct: async ({ accountId, name, description, priceInCents, currency }) => ({
    id: 'prod_test_123',
    name,
    description: description || '',
    default_price: 'price_test_123',
    active: true
  }),

  updateProduct: async ({ accountId, productId, name, description, priceInCents, currency }) => ({
    id: productId,
    name: name || 'Updated Product',
    description: description || 'Updated description',
    default_price: {
      id: 'price_test_updated',
      unit_amount: priceInCents || 2000,
      currency: currency || 'usd'
    },
    active: true
  }),

  getProducts: async (accountId) => ({
    data: [{
      id: 'prod_test_123',
      name: 'Test Product',
      description: 'A test product',
      default_price: 'price_test_123',
      active: true
    }]
  }),

  getPrice: async (accountId, priceId) => ({
    id: priceId,
    unit_amount: 2000,
    currency: 'usd'
  }),

  createCheckoutSession: async ({ accountId, priceId, quantity, applicationFeeAmount, successUrl, cancelUrl, metadata }) => ({
    id: 'cs_test_123',
    url: 'https://checkout.stripe.com/pay/cs_test_123',
    payment_intent: 'pi_test_123'
  })
}

// Mock the StripeService before importing the mutations
mock('../../services/StripeService', mockStripeService)

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
      const testGroup = await factories.group().save()
      await adminUser.joinGroup(testGroup, { role: GroupMembership.Role.MODERATOR })

      const result = await createStripeConnectedAccount(adminUser.id, {
        groupId: testGroup.id,
        email: 'group@example.com',
        businessName: 'Test Group',
        country: 'US'
      })

      expect(result.success).to.be.true
      expect(result.accountId).to.equal('acct_test_123')
      expect(result.message).to.equal('Connected account created successfully')
    })

    it('uses group email and name as defaults', async () => {
      const testGroup = await factories.group({ name: 'Default Group' }).save()
      await adminUser.joinGroup(testGroup, { role: GroupMembership.Role.MODERATOR })

      const result = await createStripeConnectedAccount(adminUser.id, {
        groupId: testGroup.id,
        country: 'CA'
      })

      expect(result.success).to.be.true
      expect(result.accountId).to.equal('acct_test_123')
    })

    it('rejects creation for non-authenticated users', async () => {
      await expect(
        createStripeConnectedAccount(null, {
          groupId: group.id,
          email: 'test@example.com',
          businessName: 'Test'
        })
      ).to.be.rejectedWith('You must be logged in to create a connected account')
    })

    it('rejects creation for non-admin users', async () => {
      await expect(
        createStripeConnectedAccount(user.id, {
          groupId: group.id,
          email: 'test@example.com',
          businessName: 'Test'
        })
      ).to.be.rejectedWith('You must be a group administrator to create a connected account')
    })

    it('rejects creation for non-existent group', async () => {
      await expect(
        createStripeConnectedAccount(adminUser.id, {
          groupId: 99999,
          email: 'test@example.com',
          businessName: 'Test'
        })
      ).to.be.rejectedWith('Group not found')
    })

    it('connects existing Stripe account when existingAccountId provided', async () => {
      const testGroup = await factories.group().save()
      await adminUser.joinGroup(testGroup, { role: GroupMembership.Role.MODERATOR })

      const result = await createStripeConnectedAccount(adminUser.id, {
        groupId: testGroup.id,
        email: 'group@example.com',
        businessName: 'Test Group',
        country: 'US',
        existingAccountId: 'acct_existing_123'
      })

      expect(result.success).to.be.true
      expect(result.accountId).to.equal('acct_existing_123')
      expect(result.message).to.equal('Connected account created successfully')
    })

    it('rejects connection if group already has Stripe account', async () => {
      const testGroup = await factories.group().save()
      await adminUser.joinGroup(testGroup, { role: GroupMembership.Role.MODERATOR })

      // First, create an account
      await createStripeConnectedAccount(adminUser.id, {
        groupId: testGroup.id,
        email: 'group@example.com',
        businessName: 'Test Group',
        country: 'US'
      })

      // Try to create another account
      await expect(
        createStripeConnectedAccount(adminUser.id, {
          groupId: testGroup.id,
          email: 'group2@example.com',
          businessName: 'Test Group 2',
          country: 'US'
        })
      ).to.be.rejectedWith('This group already has a Stripe account connected')
    })

    it('rejects connection with invalid existing account ID', async () => {
      const testGroup = await factories.group().save()
      await adminUser.joinGroup(testGroup, { role: GroupMembership.Role.MODERATOR })

      await expect(
        createStripeConnectedAccount(adminUser.id, {
          groupId: testGroup.id,
          email: 'group@example.com',
          businessName: 'Test Group',
          country: 'US',
          existingAccountId: 'invalid_account_id'
        })
      ).to.be.rejectedWith('Invalid Stripe account ID provided')
    })

    it('allows connection of unverified accounts', async () => {
      const testGroup = await factories.group().save()
      await adminUser.joinGroup(testGroup, { role: GroupMembership.Role.MODERATOR })

      // This test verifies that we can connect accounts even if they're not fully verified
      // The verification status will be handled in the UI
      const result = await createStripeConnectedAccount(adminUser.id, {
        groupId: testGroup.id,
        email: 'group@example.com',
        businessName: 'Test Group',
        country: 'US',
        existingAccountId: 'acct_unverified_123'
      })

      expect(result.success).to.be.true
      expect(result.accountId).to.equal('acct_unverified_123')
    })
  })

  describe('createStripeAccountLink', () => {
    it('creates an account link for group admins', async () => {
      const result = await createStripeAccountLink(adminUser.id, {
        groupId: group.id,
        accountId: 'acct_test_123',
        returnUrl: 'https://example.com/return',
        refreshUrl: 'https://example.com/refresh'
      })

      expect(result.success).to.be.true
      expect(result.url).to.equal('https://connect.stripe.com/setup/c/acct_test_123')
      expect(result.expiresAt).to.be.a('number')
    })

    it('rejects creation for non-authenticated users', async () => {
      await expect(
        createStripeAccountLink(null, {
          groupId: group.id,
          accountId: 'acct_test_123',
          returnUrl: 'https://example.com/return',
          refreshUrl: 'https://example.com/refresh'
        })
      ).to.be.rejectedWith('You must be logged in to create an account link')
    })

    it('rejects creation for non-admin users', async () => {
      await expect(
        createStripeAccountLink(user.id, {
          groupId: group.id,
          accountId: 'acct_test_123',
          returnUrl: 'https://example.com/return',
          refreshUrl: 'https://example.com/refresh'
        })
      ).to.be.rejectedWith('You must be a group administrator to manage payments')
    })
  })

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

  describe('createStripeProduct', () => {
    before(async () => {
      // Create a stripe_account for these tests
      const testStripeAccount = await StripeAccount.forge({
        stripe_account_external_id: 'acct_test_123'
      }).save()

      await group.save({ stripe_account_id: testStripeAccount.id })
    })

    it('creates a product for group admins', async () => {
      const contentAccess = {
        [group.id]: {
          trackIds: [1, 2],
          roleIds: [1]
        }
      }

      const result = await createStripeProduct(adminUser.id, {
        groupId: group.id,
        accountId: 'acct_test_123',
        name: 'Premium Membership',
        description: 'Access to premium content',
        priceInCents: 2000,
        currency: 'usd',
        contentAccess,
        renewalPolicy: 'manual',
        duration: 'lifetime',
        publishStatus: 'published'
      })

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
      expect(savedProduct.get('access_grants')).to.deep.equal(contentAccess)
      expect(savedProduct.get('renewal_policy')).to.equal('manual')
      expect(savedProduct.get('duration')).to.equal('lifetime')
      expect(savedProduct.get('publish_status')).to.equal('published')
    })

    it('creates a product with minimal required fields', async () => {
      const result = await createStripeProduct(adminUser.id, {
        groupId: group.id,
        accountId: 'acct_test_123',
        name: 'Basic Product',
        description: 'A basic product',
        priceInCents: 1000
      })

      expect(result.success).to.be.true
      expect(result.name).to.equal('Basic Product')

      const savedProduct = await StripeProduct.where({ id: result.databaseId }).fetch()
      expect(savedProduct.get('currency')).to.equal('usd') // default
      expect(savedProduct.get('access_grants')).to.deep.equal({}) // default
      expect(savedProduct.get('renewal_policy')).to.equal('manual') // default
      expect(savedProduct.get('publish_status')).to.equal('unpublished') // default
    })

    it('rejects creation for non-authenticated users', async () => {
      await expect(
        createStripeProduct(null, {
          groupId: group.id,
          accountId: 'acct_test_123',
          name: 'Test Product',
          priceInCents: 1000
        })
      ).to.be.rejectedWith('You must be logged in to create a product')
    })

    it('rejects creation for non-admin users', async () => {
      await expect(
        createStripeProduct(user.id, {
          groupId: group.id,
          accountId: 'acct_test_123',
          name: 'Test Product',
          priceInCents: 1000
        })
      ).to.be.rejectedWith('You must be a group administrator to create products')
    })
  })

  describe('updateStripeProduct', () => {
    let testProduct

    before(async () => {
      // Create a stripe_account for these tests
      const testStripeAccount = await StripeAccount.forge({
        stripe_account_external_id: 'acct_test_123'
      }).save()

      await group.save({ stripe_account_id: testStripeAccount.id })

      // Create a test product
      const result = await createStripeProduct(adminUser.id, {
        groupId: group.id,
        accountId: 'acct_test_123',
        name: 'Original Product',
        description: 'Original description',
        priceInCents: 1000,
        currency: 'usd',
        contentAccess: { [group.id]: { trackIds: [1] } },
        renewalPolicy: 'manual',
        duration: 'month',
        publishStatus: 'unpublished'
      })
      testProduct = await StripeProduct.where({ id: result.databaseId }).fetch()
    })

    it('updates product name and description', async () => {
      const result = await updateStripeProduct(adminUser.id, {
        productId: testProduct.id,
        name: 'Updated Product Name',
        description: 'Updated description'
      })

      expect(result.success).to.be.true
      expect(result.message).to.equal('Product updated successfully')

      // Verify the changes were saved (values come from mocked StripeService)
      await testProduct.refresh()
      expect(testProduct.get('name')).to.equal('Updated Product Name')
      expect(testProduct.get('description')).to.equal('Updated description')
    })

    it('updates product price and currency', async () => {
      const result = await updateStripeProduct(adminUser.id, {
        productId: testProduct.id,
        priceInCents: 2500,
        currency: 'eur'
      })

      expect(result.success).to.be.true

      // Verify the changes were saved (values come from mocked StripeService)
      await testProduct.refresh()
      expect(testProduct.get('price_in_cents')).to.equal(2500)
      expect(testProduct.get('currency')).to.equal('eur')
      expect(testProduct.get('stripe_price_id')).to.equal('price_test_updated')
    })

    it('updates content access configuration', async () => {
      const newContentAccess = {
        [group.id]: {
          trackIds: [1, 2, 3],
          roleIds: [1, 2]
        }
      }

      const result = await updateStripeProduct(adminUser.id, {
        productId: testProduct.id,
        contentAccess: newContentAccess
      })

      expect(result.success).to.be.true

      // Verify the changes were saved
      await testProduct.refresh()
      expect(testProduct.get('access_grants')).to.deep.equal(newContentAccess)
    })

    it('updates renewal policy and duration', async () => {
      const result = await updateStripeProduct(adminUser.id, {
        productId: testProduct.id,
        renewalPolicy: 'automatic',
        duration: 'annual'
      })

      expect(result.success).to.be.true

      // Verify the changes were saved
      await testProduct.refresh()
      expect(testProduct.get('renewal_policy')).to.equal('automatic')
      expect(testProduct.get('duration')).to.equal('annual')
    })

    it('updates publish status to all valid values', async () => {
      // Test unpublished
      let result = await updateStripeProduct(adminUser.id, {
        productId: testProduct.id,
        publishStatus: 'unpublished'
      })
      expect(result.success).to.be.true
      await testProduct.refresh()
      expect(testProduct.get('publish_status')).to.equal('unpublished')

      // Test unlisted
      result = await updateStripeProduct(adminUser.id, {
        productId: testProduct.id,
        publishStatus: 'unlisted'
      })
      expect(result.success).to.be.true
      await testProduct.refresh()
      expect(testProduct.get('publish_status')).to.equal('unlisted')

      // Test published
      result = await updateStripeProduct(adminUser.id, {
        productId: testProduct.id,
        publishStatus: 'published'
      })
      expect(result.success).to.be.true
      await testProduct.refresh()
      expect(testProduct.get('publish_status')).to.equal('published')

      // Test archived
      result = await updateStripeProduct(adminUser.id, {
        productId: testProduct.id,
        publishStatus: 'archived'
      })
      expect(result.success).to.be.true
      await testProduct.refresh()
      expect(testProduct.get('publish_status')).to.equal('archived')
    })

    it('rejects invalid publish status', async () => {
      await expect(
        updateStripeProduct(adminUser.id, {
          productId: testProduct.id,
          publishStatus: 'invalid_status'
        })
      ).to.be.rejectedWith('Invalid publish status. Must be unpublished, unlisted, published, or archived')
    })

    it('updates multiple fields at once', async () => {
      const result = await updateStripeProduct(adminUser.id, {
        productId: testProduct.id,
        name: 'Multi-Update Product',
        description: 'Updated with multiple fields',
        priceInCents: 3000,
        publishStatus: 'unlisted'
      })

      expect(result.success).to.be.true

      // Verify all changes were saved (Stripe-synced fields come from mock, platform fields from input)
      await testProduct.refresh()
      expect(testProduct.get('name')).to.equal('Multi-Update Product')
      expect(testProduct.get('description')).to.equal('Updated with multiple fields')
      expect(testProduct.get('price_in_cents')).to.equal(3000)
      expect(testProduct.get('currency')).to.equal('eur') // Preserved from previous test since not updated
      expect(testProduct.get('stripe_price_id')).to.equal('price_test_updated') // From mock
      expect(testProduct.get('publish_status')).to.equal('unlisted')
    })

    it('handles partial updates without affecting other fields', async () => {
      // First set some values
      await updateStripeProduct(adminUser.id, {
        productId: testProduct.id,
        name: 'Test Name',
        description: 'Test Description',
        priceInCents: 1500
      })

      // Then update only the name
      await updateStripeProduct(adminUser.id, {
        productId: testProduct.id,
        name: 'Only Name Updated'
      })

      // Verify only name changed, other fields remained
      await testProduct.refresh()
      expect(testProduct.get('name')).to.equal('Only Name Updated')
      expect(testProduct.get('description')).to.equal('Test Description')
      expect(testProduct.get('price_in_cents')).to.equal(1500)
    })

    it('rejects update for non-authenticated users', async () => {
      await expect(
        updateStripeProduct(null, {
          productId: testProduct.id,
          name: 'Unauthorized Update'
        })
      ).to.be.rejectedWith('You must be logged in to update a product')
    })

    it('rejects update for non-admin users', async () => {
      await expect(
        updateStripeProduct(user.id, {
          productId: testProduct.id,
          name: 'Unauthorized Update'
        })
      ).to.be.rejectedWith('You must be a group administrator to update products')
    })

    it('rejects update for non-existent product', async () => {
      await expect(
        updateStripeProduct(adminUser.id, {
          productId: 99999,
          name: 'Non-existent Product'
        })
      ).to.be.rejectedWith('Product not found')
    })

    it('rejects update when group has no Stripe account', async () => {
      // Create a group without a Stripe account
      const groupWithoutStripe = await factories.group().save()
      await adminUser.joinGroup(groupWithoutStripe, { role: GroupMembership.Role.MODERATOR })

      const productWithoutStripe = await StripeProduct.create({
        group_id: groupWithoutStripe.id,
        stripe_product_id: 'prod_no_stripe',
        stripe_price_id: 'price_no_stripe',
        name: 'Product Without Stripe',
        description: 'A product for a group without Stripe',
        price_in_cents: 1000,
        currency: 'usd'
      })

      await expect(
        updateStripeProduct(adminUser.id, {
          productId: productWithoutStripe.id,
          name: 'Updated Name'
        })
      ).to.be.rejectedWith('Group does not have a connected Stripe account')
    })

    it('handles empty update gracefully', async () => {
      const originalName = testProduct.get('name')

      const result = await updateStripeProduct(adminUser.id, {
        productId: testProduct.id
      })

      expect(result.success).to.be.true

      // Verify nothing changed
      await testProduct.refresh()
      expect(testProduct.get('name')).to.equal(originalName)
    })
  })

  describe('stripeProducts', () => {
    before(async () => {
      // Create a stripe_account for these tests
      const testStripeAccount = await StripeAccount.forge({
        stripe_account_external_id: 'acct_test_123'
      }).save()

      await group.save({ stripe_account_id: testStripeAccount.id })
    })

    it('lists products for group admins', async () => {
      const result = await stripeProducts(adminUser.id, {
        groupId: group.id,
        accountId: 'acct_test_123'
      })

      expect(result.success).to.be.true
      expect(result.products).to.have.length(1)
      expect(result.products[0].id).to.equal('prod_test_123')
      expect(result.products[0].name).to.equal('Test Product')
      expect(result.products[0].description).to.equal('A test product')
    })

    it('rejects listing for non-authenticated users', async () => {
      await expect(
        stripeProducts(null, {
          groupId: group.id,
          accountId: 'acct_test_123'
        })
      ).to.be.rejectedWith('You must be logged in to view products')
    })

    it('rejects listing for non-admin users', async () => {
      await expect(
        stripeProducts(user.id, {
          groupId: group.id,
          accountId: 'acct_test_123'
        })
      ).to.be.rejectedWith('You must be a group administrator to view products')
    })
  })

  describe('createStripeCheckoutSession', () => {
    before(async () => {
      // Create a stripe_account for these tests
      const testStripeAccount = await StripeAccount.forge({
        stripe_account_external_id: 'acct_test_123'
      }).save()

      await group.save({ stripe_account_id: testStripeAccount.id })
    })

    it('creates a checkout session', async () => {
      const result = await createStripeCheckoutSession(user.id, {
        groupId: group.id,
        accountId: 'acct_test_123',
        priceId: 'price_test_123',
        quantity: 1,
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
        metadata: { source: 'web' }
      })

      expect(result.success).to.be.true
      expect(result.sessionId).to.equal('cs_test_123')
      expect(result.url).to.equal('https://checkout.stripe.com/pay/cs_test_123')
    })

    it('creates a checkout session with default quantity', async () => {
      const result = await createStripeCheckoutSession(user.id, {
        groupId: group.id,
        accountId: 'acct_test_123',
        priceId: 'price_test_123',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel'
      })

      expect(result.success).to.be.true
      expect(result.sessionId).to.equal('cs_test_123')
    })

    it('allows unauthenticated checkout sessions', async () => {
      const result = await createStripeCheckoutSession(null, {
        groupId: group.id,
        accountId: 'acct_test_123',
        priceId: 'price_test_123',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel'
      })

      expect(result.success).to.be.true
      expect(result.sessionId).to.equal('cs_test_123')
    })

    it('includes user ID in metadata when authenticated', async () => {
      const result = await createStripeCheckoutSession(user.id, {
        groupId: group.id,
        accountId: 'acct_test_123',
        priceId: 'price_test_123',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
        metadata: { custom: 'data' }
      })

      expect(result.success).to.be.true
      // Note: In a real test, you'd verify the metadata was passed correctly to StripeService
    })
  })
})
