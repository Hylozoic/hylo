/**
 * StripeService
 *
 * Service for managing Stripe Connect integration.
 * Handles connected account creation, onboarding, product management,
 * and payment processing for groups.
 */

const Stripe = require('stripe')
const {
  resolvePeriodUnitAmountCentsSync,
  resolvePeriodPriceCentsForCredit
} = require('../../lib/membershipChangeCredit')
const { getLocaleStrings } = require('../../lib/i18n/locales')

// Initialize Stripe with API version
// TODO STRIPE: Replace with your actual Stripe secret key
// Set this in your environment variables as STRIPE_SECRET_KEY
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY

// Cached platform-contribution price IDs per connected account (created on first use)
// Key: accountId (or 'platform' for platform account), Value: priceId
const cachedDonationPriceIds = {}

// Cached sliding-scale unit price IDs per account+currency (created programmatically on first use)
// Key: `${accountId || 'platform'}:${currency}`, Value: priceId
const cachedSlidingScaleUnitPriceIds = {}

function normalizeLocale (locale) {
  if (!locale || typeof locale !== 'string') {
    return 'en'
  }
  return locale.toLowerCase().split('-')[0]
}

function getStripeContributionCopy ({ locale, currency }) {
  const localeStrings = getLocaleStrings(normalizeLocale(locale))
  const upperCurrency = (currency || 'usd').toUpperCase()

  return {
    contributionProductName: localeStrings.stripeContributionProductName
      ? localeStrings.stripeContributionProductName()
      : 'Choose Your Hylo Contribution',
    contributionProductDescription: localeStrings.stripeContributionProductDescription
      ? localeStrings.stripeContributionProductDescription()
      : 'Choose your level of contribution to support the Hylo platform.',
    slidingScaleUnitProductName: localeStrings.stripeSlidingScaleUnitProductName
      ? localeStrings.stripeSlidingScaleUnitProductName({ currency: upperCurrency })
      : `Set Your Contribution Amount (${upperCurrency} units)`,
    slidingScaleUnitProductDescription: localeStrings.stripeSlidingScaleUnitProductDescription
      ? localeStrings.stripeSlidingScaleUnitProductDescription()
      : 'Adjust quantity to choose your contribution amount.'
  }
}

// Validate that Stripe secret key is configured
if (!STRIPE_SECRET_KEY) {
  throw new Error(
    '🔴 STRIPE_SECRET_KEY environment variable is not set. ' +
    'Please add STRIPE_SECRET_KEY to your .env file or environment variables. ' +
    'You can find this in your Stripe Dashboard: https://dashboard.stripe.com/apikeys'
  )
}

// Initialize Stripe client with the latest API version
// Note: API version should match what Stripe expects - check Stripe dashboard for latest
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2025-10-29.clover' // Updated to match Stripe's expected version
})

module.exports = {

  /**
   * Ensures the Hylo platform contribution product and $1 unit price exist in Stripe.
   * Creates them if they don't exist, otherwise retrieves the existing price ID.
   * The price ID is cached per account for subsequent calls.
   *
   * @param {String} [accountId] - Connected account ID. If provided, creates on that account.
   * @returns {Promise<String>} The contribution line-item price ID
   */
  async ensureDonationPriceExists (accountId = null, locale = 'en') {
    const cacheKey = accountId || 'platform'

    // Return cached price ID if we already have it for this account
    if (cachedDonationPriceIds[cacheKey]) {
      return cachedDonationPriceIds[cacheKey]
    }

    try {
      const {
        contributionProductName: CONTRIBUTION_PRODUCT_NAME,
        contributionProductDescription: CONTRIBUTION_PRODUCT_DESCRIPTION
      } = getStripeContributionCopy({ locale, currency: 'usd' })
      const CONTRIBUTION_PRODUCT_METADATA_KEY = 'hylo_donation_product'

      // Options for connected account API calls
      const stripeOptions = accountId ? { stripeAccount: accountId } : {}

      // Search for existing donation product by metadata
      // Note: products.search is not available on connected accounts, so we list and filter
      let donationProduct = null

      if (accountId) {
        // For connected accounts, list products and filter by metadata
        const products = await stripe.products.list({
          active: true,
          limit: 100
        }, stripeOptions)

        donationProduct = products.data.find(
          p => p.metadata && p.metadata[CONTRIBUTION_PRODUCT_METADATA_KEY] === 'true'
        )
      } else {
        // For platform account, use search
        const existingProducts = await stripe.products.search({
          query: `metadata['${CONTRIBUTION_PRODUCT_METADATA_KEY}']:'true' AND active:'true'`
        })
        if (existingProducts.data.length > 0) {
          donationProduct = existingProducts.data[0]
        }
      }

      if (donationProduct) {
        // Keep copy in sync for existing products so Checkout label text stays user-friendly.
        if (
          donationProduct.name !== CONTRIBUTION_PRODUCT_NAME ||
          donationProduct.description !== CONTRIBUTION_PRODUCT_DESCRIPTION
        ) {
          donationProduct = await stripe.products.update(donationProduct.id, {
            name: CONTRIBUTION_PRODUCT_NAME,
            description: CONTRIBUTION_PRODUCT_DESCRIPTION
          }, stripeOptions)
        }
        if (process.env.NODE_ENV === 'development') {
          console.log(`Found existing donation product on ${cacheKey}: ${donationProduct.id}`)
        }
      } else {
        // Create the donation product
        donationProduct = await stripe.products.create({
          name: CONTRIBUTION_PRODUCT_NAME,
          description: CONTRIBUTION_PRODUCT_DESCRIPTION,
          metadata: {
            [CONTRIBUTION_PRODUCT_METADATA_KEY]: 'true'
          }
        }, stripeOptions)
        if (process.env.NODE_ENV === 'development') {
          console.log(`Created donation product on ${cacheKey}: ${donationProduct.id}`)
        }
      }

      // Search for existing $1 donation price
      const existingPrices = await stripe.prices.list({
        product: donationProduct.id,
        active: true,
        limit: 10
      }, stripeOptions)

      // Find a $1 USD price
      let donationPrice = existingPrices.data.find(
        p => p.unit_amount === 100 && p.currency === 'usd' && !p.recurring
      )

      if (donationPrice) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`Found existing donation price on ${cacheKey}: ${donationPrice.id}`)
        }
      } else {
        // Create the $1 donation price
        donationPrice = await stripe.prices.create({
          product: donationProduct.id,
          unit_amount: 100, // $1.00 in cents
          currency: 'usd',
          metadata: {
            hylo_donation_price: 'true'
          }
        }, stripeOptions)
        if (process.env.NODE_ENV === 'development') {
          console.log(`Created donation price on ${cacheKey}: ${donationPrice.id}`)
        }
      }

      // Cache the price ID for this account
      cachedDonationPriceIds[cacheKey] = donationPrice.id
      return cachedDonationPriceIds[cacheKey]
    } catch (error) {
      console.error('Error ensuring donation price exists:', error)
      throw new Error(`Failed to ensure donation price exists: ${error.message}`)
    }
  },

  /**
   * Ensures a sliding-scale \"unit\" product+price exist in Stripe for a currency.
   *
   * This is intended to support pay-what-you-want / sliding-scale offerings by using
   * quantity on a single unit price (e.g. 1 unit = $1.00 USD).
   *
   * @param {String} accountId - Connected account ID (required)
   * @param {String} currency - Currency code (e.g. 'usd', 'eur')
   * @param {String|null} billingInterval - Optional recurring interval ('day', 'week', 'month', 'year')
   * @param {Number} billingIntervalCount - Optional recurring interval count (e.g. 3 for quarterly)
   * @returns {Promise<String>} The unit price ID
   */
  async ensureSlidingScaleUnitPriceExists (accountId, currency = 'usd', billingInterval = null, billingIntervalCount = 1, locale = 'en') {
    const normalizedCurrency = (currency || 'usd').toLowerCase()
    const intervalKey = billingInterval ? `${billingInterval}:${billingIntervalCount || 1}` : 'one_time'
    const cacheKey = `${accountId || 'platform'}:${normalizedCurrency}:${intervalKey}`

    if (cachedSlidingScaleUnitPriceIds[cacheKey]) {
      return cachedSlidingScaleUnitPriceIds[cacheKey]
    }

    if (!accountId) {
      throw new Error('Account ID is required to ensure sliding scale unit price exists')
    }

    try {
      const UNIT_PRODUCT_METADATA_KEY = 'hylo_sliding_scale_unit_product'
      const UNIT_CURRENCY_METADATA_KEY = 'hylo_sliding_scale_unit_currency'
      const {
        slidingScaleUnitProductName: UNIT_PRODUCT_NAME,
        slidingScaleUnitProductDescription: UNIT_PRODUCT_DESCRIPTION
      } = getStripeContributionCopy({ locale, currency: normalizedCurrency })

      const stripeOptions = { stripeAccount: accountId }

      // products.search is not available on connected accounts, so list + filter
      const products = await stripe.products.list({
        active: true,
        limit: 100
      }, stripeOptions)

      let unitProduct = products.data.find(
        p => p.metadata &&
          p.metadata[UNIT_PRODUCT_METADATA_KEY] === 'true' &&
          p.metadata[UNIT_CURRENCY_METADATA_KEY] === normalizedCurrency
      )

      if (!unitProduct) {
        unitProduct = await stripe.products.create({
          name: UNIT_PRODUCT_NAME,
          description: UNIT_PRODUCT_DESCRIPTION,
          metadata: {
            [UNIT_PRODUCT_METADATA_KEY]: 'true',
            [UNIT_CURRENCY_METADATA_KEY]: normalizedCurrency
          }
        }, stripeOptions)
      } else if (
        unitProduct.name !== UNIT_PRODUCT_NAME ||
        unitProduct.description !== UNIT_PRODUCT_DESCRIPTION
      ) {
        unitProduct = await stripe.products.update(unitProduct.id, {
          name: UNIT_PRODUCT_NAME,
          description: UNIT_PRODUCT_DESCRIPTION
        }, stripeOptions)
      }

      const existingPrices = await stripe.prices.list({
        product: unitProduct.id,
        active: true,
        limit: 10
      }, stripeOptions)

      let unitPrice = null
      if (billingInterval) {
        const expectedCount = billingIntervalCount || 1
        unitPrice = existingPrices.data.find(p => {
          if (p.unit_amount !== 100) return false
          if (p.currency !== normalizedCurrency) return false
          if (!p.recurring) return false
          if (p.recurring.interval !== billingInterval) return false
          return (p.recurring.interval_count || 1) === expectedCount
        })
      } else {
        unitPrice = existingPrices.data.find(
          p => p.unit_amount === 100 && p.currency === normalizedCurrency && !p.recurring
        )
      }

      if (!unitPrice) {
        const priceData = {
          product: unitProduct.id,
          unit_amount: 100,
          currency: normalizedCurrency,
          metadata: {
            hylo_sliding_scale_unit_price: 'true'
          }
        }

        if (billingInterval) {
          priceData.recurring = {
            interval: billingInterval,
            interval_count: billingIntervalCount || 1
          }
        }

        unitPrice = await stripe.prices.create(priceData, stripeOptions)
      }

      cachedSlidingScaleUnitPriceIds[cacheKey] = unitPrice.id
      return cachedSlidingScaleUnitPriceIds[cacheKey]
    } catch (error) {
      console.error('Error ensuring sliding scale unit price exists:', error)
      throw new Error(`Failed to ensure sliding scale unit price exists: ${error.message}`)
    }
  },

  /**
   * Creates a new Stripe Connected Account for a group
   *
   * This allows groups to receive payments directly while the platform
   * takes an application fee. The account is created with:
   * - Connected account pays Stripe fees
   * - Stripe handles payment disputes and losses
   * - Connected account gets full dashboard access
   * - Group ID stored in metadata for webhook correlation
   *
   * @param {Object} params - Account creation parameters
   * @param {String} params.email - Email address for the connected account
   * @param {String} params.country - Two-letter country code (e.g. 'US', 'GB')
   * @param {String} params.businessName - Business/group name
   * @param {String} params.groupId - Group ID for metadata correlation
   * @returns {Promise<Object>} The created Stripe account object
   */
  async createConnectedAccount ({ email, country = 'US', businessName, groupId }) {
    try {
      // Validate required parameters
      if (!email) {
        throw new Error('Email is required to create a connected account')
      }

      if (!businessName) {
        throw new Error('Business name is required to create a connected account')
      }

      if (!groupId) {
        throw new Error('Group ID is required for account metadata')
      }

      // Create the connected account with controller settings
      // Note: We use controller properties, NOT top-level type property
      const account = await stripe.accounts.create({
        email,
        country,
        business_profile: {
          name: businessName
        },
        metadata: {
          group_id: groupId.toString(),
          platform: 'hylo'
        },
        controller: {
          // Platform controls fee collection - connected account pays fees
          fees: {
            payer: 'account'
          },
          // Stripe handles payment disputes and losses
          losses: {
            payments: 'stripe'
          },
          // Connected account gets full access to Stripe dashboard
          stripe_dashboard: {
            type: 'full'
          }
        }
      })

      return account
    } catch (error) {
      console.error('Error creating connected account:', error)
      throw new Error(`Failed to create Stripe connected account: ${error.message}`)
    }
  },

  /**
   * Connects an existing Stripe account to a group
   *
   * This allows groups to use their existing Stripe account instead of
   * creating a new one. The account can be connected even if not fully
   * verified - verification status will be displayed in the UI and
   * prevent product publishing until the account is ready.
   *
   * NOTE: This only works for Stripe accounts that were originally created
   * through our platform (connected accounts). To connect accounts created
   * outside our platform, we need to implement Stripe OAuth flow.
   *
   * Note: Stripe will handle the edge case where the user already has an account
   * by prompting them to connect their existing account during onboarding.
   *
   * @param {Object} params - Connection parameters
   * @param {String} params.accountId - Existing Stripe account ID (must be a connected account)
   * @param {String} params.groupId - Group ID for metadata correlation
   * @returns {Promise<Object>} The Stripe account object
   */
  async connectExistingAccount ({ accountId, groupId }) {
    try {
      // Validate required parameters
      if (!accountId) {
        throw new Error('Account ID is required to connect existing account')
      }

      if (!groupId) {
        throw new Error('Group ID is required for account metadata')
      }

      // Validate that the account exists by retrieving it
      // This will throw an error if the account ID is invalid
      // Note: For connected accounts, we retrieve using the account ID directly
      // The accountId should be a string like 'acct_xxx'
      if (process.env.NODE_ENV !== 'production') {
        console.log('Attempting to retrieve Stripe account:', {
          accountId,
          accountIdType: typeof accountId,
          accountIdLength: accountId?.length,
          isString: typeof accountId === 'string'
        })
      }
      // Verify account exists (will throw if not found)
      await stripe.accounts.retrieve(accountId)

      // Account exists and is valid - we can proceed with connection
      // No need to check verification status here as UI will handle that

      // Update the account metadata to include our group ID
      const updatedAccount = await stripe.accounts.update(accountId, {
        metadata: {
          group_id: groupId.toString(),
          platform: 'hylo',
          connected_at: new Date().toISOString()
        }
      })

      return updatedAccount
    } catch (error) {
      console.error('Error connecting existing account:', {
        accountId,
        groupId,
        errorType: error.type,
        errorMessage: error.message,
        errorCode: error.code,
        errorParam: error.param,
        errorDetail: error.detail,
        rawError: error.raw,
        fullError: error
      })
      if (error.type === 'StripeInvalidRequestError') {
        // Provide more specific error message based on the error details
        if (error.message && error.message.includes('API version')) {
          throw new Error(`Stripe API version error: ${error.message}. This may indicate an issue with the Stripe SDK configuration.`)
        }
        throw new Error(`Invalid Stripe account ID provided: ${error.message}`)
      }
      throw new Error(`Failed to connect existing Stripe account: ${error.message}`)
    }
  },

  /**
   * Creates an Account Link for onboarding a connected account
   *
   * Account Links are temporary URLs that allow connected accounts
   * to complete their onboarding and gain access to the Stripe Dashboard.
   * Links expire after the specified time.
   *
   * @param {Object} params - Account link parameters
   * @param {String} params.accountId - The Stripe connected account ID
   * @param {String} params.refreshUrl - URL to redirect if link expires
   * @param {String} params.returnUrl - URL to redirect after onboarding complete
   * @returns {Promise<Object>} Account link object with url property
   */
  async createAccountLink ({ accountId, refreshUrl, returnUrl }) {
    try {
      // Validate required parameters
      if (!accountId) {
        throw new Error('Account ID is required to create an account link')
      }

      if (!refreshUrl || !returnUrl) {
        throw new Error('Both refreshUrl and returnUrl are required')
      }

      // Create the account link for onboarding
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding'
      })

      return accountLink
    } catch (error) {
      console.error('Error creating account link:', error)
      throw new Error(`Failed to create account link: ${error.message}`)
    }
  },

  /**
   * Retrieves the current status of a connected account
   *
   * This fetches the account directly from Stripe to get the most
   * up-to-date onboarding status and capabilities.
   *
   * @param {String} accountId - The Stripe connected account ID
   * @returns {Promise<Object>} Account object with status information
   */
  async getAccountStatus (accountId) {
    try {
      // Validate required parameter
      if (!accountId) {
        throw new Error('Account ID is required to get account status')
      }

      // Retrieve the account from Stripe
      const account = await stripe.accounts.retrieve(accountId)

      // Return relevant status information
      return {
        id: account.id,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        requirements: account.requirements,
        email: account.email,
        business_profile: account.business_profile
      }
    } catch (error) {
      console.error('Error retrieving account status:', error)
      throw new Error(`Failed to retrieve account status: ${error.message}`)
    }
  },

  /**
   * Creates a product on a connected account
   *
   * Products represent the items/memberships/content that the
   * connected account is selling. Uses the Stripe-Account header
   * to create the product on the connected account, not the platform.
   *
   * @param {Object} params - Product creation parameters
   * @param {String} params.accountId - The Stripe connected account ID
   * @param {String} params.name - Product name
   * @param {String} params.description - Product description
   * @param {Number} params.priceInCents - Price in cents (e.g. 2000 = $20.00)
   * @param {String} params.currency - Three-letter currency code (e.g. 'usd')
   * @param {String} params.billingInterval - Optional: 'month', 'year', or null for one-time
   * @param {Number} params.billingIntervalCount - Optional: number of intervals (e.g., 3 for quarterly)
   * @returns {Promise<Object>} The created product with default price
   */
  async createProduct ({ accountId, name, description, priceInCents, currency = 'usd', billingInterval = null, billingIntervalCount = 1 }) {
    try {
      // Validate required parameters
      if (!accountId) {
        throw new Error('Account ID is required to create a product')
      }

      if (!name) {
        throw new Error('Product name is required')
      }

      if (priceInCents === undefined || priceInCents === null) {
        throw new Error('Price is required')
      }

      if (priceInCents < 0) {
        throw new Error('Price must be a positive number')
      }

      // Build price data - add recurring if billingInterval specified
      const priceData = {
        unit_amount: priceInCents,
        currency: currency.toLowerCase()
      }

      if (billingInterval) {
        priceData.recurring = {
          interval: billingInterval, // 'day', 'week', 'month', or 'year'
          interval_count: billingIntervalCount // e.g., 3 for quarterly (every 3 months)
        }
      }

      // Create product on the connected account using stripeAccount parameter
      const product = await stripe.products.create({
        name,
        description: description || '',
        default_price_data: priceData
      }, {
        stripeAccount: accountId // This header creates the product on the connected account
      })

      return product
    } catch (error) {
      console.error('Error creating product:', error)
      throw new Error(`Failed to create product: ${error.message}`)
    }
  },

  /**
   * Updates a product on a connected account
   *
   * Updates product details in Stripe and returns the updated product.
   * Only updates fields that are provided and different from current values.
   *
   * @param {Object} params - Product update parameters
   * @param {String} params.accountId - The Stripe connected account ID
   * @param {String} params.productId - The Stripe product ID to update
   * @param {String} [params.name] - New product name
   * @param {String} [params.description] - New product description
   * @param {Number} [params.priceInCents] - New price in cents
   * @param {String} [params.currency] - New currency code
   * @returns {Promise<Object>} The updated product object
   */
  async updateProduct ({ accountId, productId, name, description, priceInCents, currency }) {
    try {
      // Validate required parameters
      if (!accountId) {
        throw new Error('Account ID is required to update a product')
      }

      if (!productId) {
        throw new Error('Product ID is required')
      }

      // First, get the current product to compare values
      const currentProduct = await stripe.products.retrieve(productId, {
        expand: ['default_price']
      }, {
        stripeAccount: accountId
      })

      const updateData = {}

      // Only update fields that are provided and different
      if (name !== undefined && name !== currentProduct.name) {
        updateData.name = name
      }

      if (description !== undefined && description !== currentProduct.description) {
        updateData.description = description || ''
      }

      // Handle price updates - this requires updating the price, not the product
      if (priceInCents !== undefined || currency !== undefined) {
        const currentPrice = currentProduct.default_price
        const newPriceInCents = priceInCents !== undefined ? priceInCents : currentPrice.unit_amount
        const newCurrency = currency !== undefined ? currency.toLowerCase() : currentPrice.currency

        // Only update price if it's different
        if (newPriceInCents !== currentPrice.unit_amount || newCurrency !== currentPrice.currency) {
          // Create a new price for the product
          const newPrice = await stripe.prices.create({
            product: productId,
            unit_amount: newPriceInCents,
            currency: newCurrency
          }, {
            stripeAccount: accountId
          })

          // Update the product to use the new default price
          updateData.default_price = newPrice.id
        }
      }

      // Only proceed with update if there are changes
      if (Object.keys(updateData).length === 0) {
        return currentProduct // No changes needed
      }

      // Update the product in Stripe
      const updatedProduct = await stripe.products.update(productId, updateData, {
        stripeAccount: accountId
      })

      // If we created a new price, retrieve the product with expanded price info
      if (updateData.default_price) {
        return await stripe.products.retrieve(productId, {
          expand: ['default_price']
        }, {
          stripeAccount: accountId
        })
      }

      return updatedProduct
    } catch (error) {
      console.error('Error updating product:', error)
      throw new Error(`Failed to update product: ${error.message}`)
    }
  },

  /**
   * Retrieves all products for a connected account
   *
   * Lists products using the Stripe-Account header to get products
   * from the connected account, not the platform account.
   *
   * @param {String} accountId - The Stripe connected account ID
   * @param {Object} options - Optional pagination parameters
   * @param {Number} options.limit - Number of products to retrieve (default: 100)
   * @returns {Promise<Array>} Array of product objects
   */
  async getProducts (accountId, { limit = 100 } = {}) {
    try {
      // Validate required parameter
      if (!accountId) {
        throw new Error('Account ID is required to retrieve products')
      }

      // List products from the connected account
      const products = await stripe.products.list({
        limit,
        active: true // Only return active products
      }, {
        stripeAccount: accountId // This header retrieves from the connected account
      })

      return products.data
    } catch (error) {
      console.error('Error retrieving products:', error)
      throw new Error(`Failed to retrieve products: ${error.message}`)
    }
  },

  /**
   * Retrieves a single product with its price information
   *
   * Fetches a product and expands the default price to get
   * pricing information in a single call.
   *
   * @param {String} accountId - The Stripe connected account ID
   * @param {String} productId - The product ID to retrieve
   * @returns {Promise<Object>} Product object with expanded price
   */
  async getProduct (accountId, productId) {
    try {
      // Validate required parameters
      if (!accountId) {
        throw new Error('Account ID is required to retrieve a product')
      }

      if (!productId) {
        throw new Error('Product ID is required')
      }

      // Retrieve the product with expanded price information
      const product = await stripe.products.retrieve(productId, {
        expand: ['default_price']
      }, {
        stripeAccount: accountId
      })

      return product
    } catch (error) {
      console.error('Error retrieving product:', error)
      throw new Error(`Failed to retrieve product: ${error.message}`)
    }
  },

  /**
   * Retrieves a price object from Stripe
   *
   * Fetches detailed price information including unit amount and currency.
   *
   * @param {String} accountId - The Stripe connected account ID
   * @param {String} priceId - The price ID to retrieve
   * @returns {Promise<Object>} Price object with unit_amount, currency, etc.
   */
  async getPrice (accountId, priceId) {
    try {
      // Validate required parameters
      if (!accountId) {
        throw new Error('Account ID is required to retrieve a price')
      }

      if (!priceId) {
        throw new Error('Price ID is required')
      }

      // Retrieve the price from the connected account
      const price = await stripe.prices.retrieve(priceId, {
        stripeAccount: accountId
      })

      return price
    } catch (error) {
      console.error('Error retrieving price:', error)
      throw new Error(`Failed to retrieve price: ${error.message}`)
    }
  },

  /**
   * Creates a Checkout Session for purchasing a product
   *
   * Uses Stripe Hosted Checkout for a secure payment experience.
   * Implements Direct Charges with an application fee to monetize
   * the transaction. The platform takes a fee, and the rest goes
   * to the connected account.
   *
   * Includes an optional contribution to the Hylo platform on the Stripe checkout page.
   *
   * @param {Object} params - Checkout session parameters
   * @param {String} params.accountId - The Stripe connected account ID
   * @param {String} params.priceId - The price ID to charge
   * @param {Number} params.quantity - Quantity to purchase
   * @param {Number} params.applicationFeeAmount - Platform fee in cents
   * @param {String} params.successUrl - URL to redirect on success
   * @param {String} params.cancelUrl - URL to redirect on cancel
   * @param {String} params.mode - Checkout mode: 'payment' or 'subscription'
   * @param {Object} params.metadata - Optional metadata to attach
   * @returns {Promise<Object>} Checkout session with url to redirect customer
   */
  async createCheckoutSession ({
    accountId,
    priceId,
    quantity = 1,
    adjustableQuantity = null,
    applicationFeeAmount,
    successUrl,
    cancelUrl,
    mode = 'payment',
    metadata = {},
    locale = 'en'
  }) {
    try {
      // Validate required parameters
      if (!accountId) {
        throw new Error('Account ID is required to create a checkout session')
      }

      if (!priceId) {
        throw new Error('Price ID is required')
      }

      if (applicationFeeAmount === undefined || applicationFeeAmount === null || applicationFeeAmount < 0) {
        throw new Error('Valid application fee amount is required')
      }

      if (!successUrl || !cancelUrl) {
        throw new Error('Both success and cancel URLs are required')
      }

      // Retrieve price to validate it exists on the connected account
      await this.getPrice(accountId, priceId)

      // Build session configuration based on mode
      const lineItem = {
        price: priceId,
        quantity
      }

      if (adjustableQuantity && adjustableQuantity.enabled) {
        // Provide safety defaults so sliding-scale can omit min/max.
        const safeMinimum = adjustableQuantity.minimum ?? 1
        const safeMaximum = adjustableQuantity.maximum ?? 999999

        lineItem.adjustable_quantity = {
          enabled: true,
          minimum: safeMinimum,
          maximum: safeMaximum
        }
      }

      const sessionConfig = {
        line_items: [lineItem],
        mode,
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata
      }

      // Add optional platform contribution to checkout session
      // Uses a pre-created price ID (created programmatically on the connected account if it doesn't exist)
      // Note: Recurring platform contributions are not yet supported — only one-time optional_items for now
      try {
        const donationPriceId = await this.ensureDonationPriceExists(accountId, locale)

        // Add one-time contribution option (works for both subscription and payment modes)
        // User can select quantity 0-100 ($0 to $100 in $1 increments)
        // Note: quantity must be >= 1 for API, but adjustable_quantity.minimum: 0
        // allows users to reduce it to 0 in the checkout UI
        // ALSO: its completely optional - users can checkout without it if they want
        sessionConfig.optional_items = [
          {
            price: donationPriceId,
            quantity: 5, // This displays as an add-on
            adjustable_quantity: {
              enabled: true,
              minimum: 0,
              maximum: 100
            }
          }
        ]

        // Store flag in metadata to indicate platform contribution option was available
        metadata.hasContributionOption = 'true'
      } catch (donationError) {
        // If contribution setup fails, continue without it - don't block the checkout
        console.error('Failed to set up platform contribution option, continuing without it:', donationError.message)
      }

      // Configure for payment or subscription mode
      if (mode === 'subscription') {
        // For subscriptions, use subscription_data with platform fee
        sessionConfig.subscription_data = {
          application_fee_percent: 7.0, // Platform takes 7% of each subscription payment
          metadata // Metadata flows to subscription
        }
      } else {
        // For one-time payments, use payment_intent_data
        sessionConfig.payment_intent_data = {
          application_fee_amount: applicationFeeAmount,
          metadata: {
            session_id: 'placeholder' // Will be updated after session creation
          }
        }
      }

      // Create checkout session on the connected account
      const session = await stripe.checkout.sessions.create(sessionConfig, {
        stripeAccount: accountId // Process payment on connected account
      })

      // For one-time payments, update payment intent with session ID for refund tracking
      if (mode === 'payment' && session.payment_intent) {
        await stripe.paymentIntents.update(session.payment_intent, {
          metadata: {
            session_id: session.id
          }
        }, {
          stripeAccount: accountId
        })
      }

      // For subscriptions, update subscription with session ID
      if (mode === 'subscription' && session.subscription) {
        await stripe.subscriptions.update(session.subscription, {
          metadata: {
            ...metadata,
            sessionId: session.id
          }
        }, {
          stripeAccount: accountId
        })
      }

      return session
    } catch (error) {
      console.error('Error creating checkout session:', error)
      throw new Error(`Failed to create checkout session: ${error.message}`)
    }
  },

  /**
   * Retrieves a checkout session
   *
   * Used to verify payment status after customer returns from
   * Stripe Hosted Checkout.
   *
   * @param {String} accountId - The Stripe connected account ID
   * @param {String} sessionId - The checkout session ID
   * @returns {Promise<Object>} Checkout session object
   */
  async getCheckoutSession (accountId, sessionId) {
    try {
      // Validate required parameters
      if (!accountId) {
        throw new Error('Account ID is required')
      }

      if (!sessionId) {
        throw new Error('Session ID is required')
      }

      // Retrieve the checkout session
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['payment_intent', 'line_items']
      }, {
        stripeAccount: accountId
      })

      return session
    } catch (error) {
      console.error('Error retrieving checkout session:', error)
      throw new Error(`Failed to retrieve checkout session: ${error.message}`)
    }
  },

  /**
   * Retrieves an invoice from Stripe with expanded payment details
   *
   * @param {String} accountId - The Stripe connected account ID
   * @param {String} invoiceId - The invoice ID to retrieve
   * @returns {Promise<Object>} Invoice object with expanded payment_intent and charge
   */
  async getInvoice (accountId, invoiceId) {
    try {
      if (!accountId) {
        throw new Error('Account ID is required')
      }

      if (!invoiceId) {
        throw new Error('Invoice ID is required')
      }

      const invoice = await stripe.invoices.retrieve(invoiceId, {
        expand: ['payment_intent', 'charge']
      }, {
        stripeAccount: accountId
      })

      return invoice
    } catch (error) {
      console.error('Error retrieving invoice:', error)
      throw new Error(`Failed to retrieve invoice: ${error.message}`)
    }
  },

  /**
   * Lists all subscriptions for a specific price on a connected account
   *
   * Fetches all subscriptions in one API call, filtered by price ID.
   * Much more efficient than fetching individual subscriptions.
   *
   * @param {String} accountId - The Stripe connected account ID
   * @param {String} priceId - The price ID to filter by
   * @param {String} status - Filter by status: 'active', 'canceled', 'all', etc. (default: 'active')
   * @param {Number} limit - Maximum number of subscriptions to return (default: 100)
   * @returns {Promise<Array<Object>>} Array of subscription objects
   */
  async listSubscriptionsByPrice (accountId, priceId, { status = 'active', limit = 100 } = {}) {
    try {
      if (!accountId) {
        throw new Error('Account ID is required to list subscriptions')
      }

      if (!priceId) {
        throw new Error('Price ID is required to list subscriptions')
      }

      const params = {
        price: priceId,
        limit,
        expand: ['data.items.data.price']
      }

      // Only add status filter if not 'all'
      if (status !== 'all') {
        params.status = status
      }

      const subscriptions = await stripe.subscriptions.list(params, {
        stripeAccount: accountId
      })

      return subscriptions.data
    } catch (error) {
      console.error('Error listing subscriptions by price:', error)
      throw new Error(`Failed to list subscriptions: ${error.message}`)
    }
  },

  /**
   * Retrieves a subscription from Stripe
   *
   * Used to get subscription details for individual lookups.
   * Expands the items to get price information.
   *
   * @param {String} accountId - The Stripe connected account ID
   * @param {String} subscriptionId - The subscription ID to retrieve
   * @returns {Promise<Object>} Subscription object with expanded items
   */
  async getSubscription (accountId, subscriptionId) {
    try {
      // Validate required parameters
      if (!accountId) {
        throw new Error('Account ID is required to retrieve a subscription')
      }

      if (!subscriptionId) {
        throw new Error('Subscription ID is required')
      }

      // Retrieve the subscription with expanded items to get price info
      const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['items.data.price', 'items.data.plan']
      }, {
        stripeAccount: accountId
      })

      return subscription
    } catch (error) {
      console.error('Error retrieving subscription:', error)
      throw new Error(`Failed to retrieve subscription: ${error.message}`)
    }
  },

  /**
   * Updates the first subscription line item to a new price (membership plan change).
   *
   * @param {object} params
   * @param {string} params.accountId - Connected account id (acct_...)
   * @param {string} params.subscriptionId
   * @param {string} params.newPriceId - Stripe price id
   * @param {number|null} [params.quantity] - optional quantity for sliding-scale targets
   * @param {string} [params.prorationBehavior] - create_prorations | none
   * @param {'now'|undefined} [params.billingCycleAnchor] - pass `now` to reset billing cycle to current time
   * @param {object} [params.metadata] - Merged onto existing subscription metadata
   * @returns {Promise<object>} Updated Stripe subscription
   */
  async updateSubscriptionPrimaryItemPrice ({
    accountId,
    subscriptionId,
    newPriceId,
    quantity = null,
    prorationBehavior = 'create_prorations',
    billingCycleAnchor,
    metadata = {}
  }) {
    if (!accountId) throw new Error('Account ID is required')
    if (!subscriptionId) throw new Error('Subscription ID is required')
    if (!newPriceId) throw new Error('New price ID is required')

    const subscription = await this.getSubscription(accountId, subscriptionId)
    const item = subscription.items?.data?.[0]
    if (!item?.id) {
      throw new Error('Subscription has no line items')
    }

    const mergedMeta = { ...(subscription.metadata || {}), ...metadata }
    const updatePayload = {
      items: [{
        id: item.id,
        price: newPriceId,
        ...(quantity != null ? { quantity } : {})
      }],
      proration_behavior: prorationBehavior,
      metadata: mergedMeta
    }
    if (billingCycleAnchor === 'now') {
      updatePayload.billing_cycle_anchor = 'now'
    }
    return stripe.subscriptions.update(subscriptionId, updatePayload, {
      stripeAccount: accountId
    })
  },

  /**
   * Adds customer credit (reduces amount owed) on a Connect account.
   * Stripe expects a negative balance transaction amount for credit.
   *
   * @param {object} params
   * @param {string} params.accountId - Connected account id (acct_...)
   * @param {string} params.customerId - cus_...
   * @param {number} params.amountCents - Positive credit value in smallest currency unit
   * @param {string} params.currency - lowercase ISO currency
   * @param {string} [params.description]
   * @returns {Promise<object>} Balance transaction
   */
  /**
   * Full recurring amount for the primary subscription line (per Stripe billing period), in cents.
   * Uses expanded item price/plan when present; otherwise loads Price from Stripe (Connect) by id;
   * finally Hylo product list price.
   *
   * @param {object} params
   * @param {string} params.accountId
   * @param {object} params.subscription
   * @param {object} params.fromProduct Bookshelf StripeProduct
   * @returns {Promise<number>}
   */
  async resolvePrimaryItemPeriodPriceCents ({ accountId, subscription, fromProduct }) {
    const item = subscription?.items?.data?.[0]
    const qty = item?.quantity != null ? item.quantity : 1
    const unitSync = resolvePeriodUnitAmountCentsSync(subscription, fromProduct)
    if (unitSync != null) {
      return Math.round(unitSync * qty)
    }

    const price = item?.price
    const priceId = typeof price === 'string' ? price : price?.id
    if (priceId && accountId) {
      try {
        const p = await stripe.prices.retrieve(priceId, { stripeAccount: accountId })
        if (p.unit_amount != null) {
          return Math.round(p.unit_amount * qty)
        }
      } catch (err) {
        console.error('resolvePrimaryItemPeriodPriceCents:', err.message)
      }
    }

    return resolvePeriodPriceCentsForCredit(subscription, fromProduct)
  },

  async createCustomerBalanceCredit ({ accountId, customerId, amountCents, currency, description }) {
    if (!accountId) throw new Error('Account ID is required')
    if (!customerId) throw new Error('Customer ID is required')
    if (amountCents == null || amountCents < 1) {
      throw new Error('Credit amount must be at least 1 cent')
    }
    const cur = (currency || 'usd').toLowerCase()
    return stripe.customers.createBalanceTransaction(customerId, {
      amount: -amountCents,
      currency: cur,
      description: description || 'Account credit'
    }, {
      stripeAccount: accountId
    })
  },

  /**
   * Updates quantity on the first subscription line item (e.g. sliding-scale units).
   *
   * @param {object} params
   * @param {string} params.accountId
   * @param {string} params.subscriptionId
   * @param {number} params.quantity
   * @param {string} [params.prorationBehavior] - default none (no mid-cycle proration for quantity-only rules)
   * @param {object} [params.metadata]
   * @returns {Promise<object>} Updated Stripe subscription
   */
  async updateSubscriptionPrimaryItemQuantity ({ accountId, subscriptionId, quantity, prorationBehavior = 'none', metadata = {} }) {
    if (!accountId) throw new Error('Account ID is required')
    if (!subscriptionId) throw new Error('Subscription ID is required')
    if (quantity == null || quantity < 1) throw new Error('Quantity must be at least 1')

    const subscription = await this.getSubscription(accountId, subscriptionId)
    const item = subscription.items?.data?.[0]
    if (!item?.id) {
      throw new Error('Subscription has no line items')
    }

    const mergedMeta = { ...(subscription.metadata || {}), ...metadata }
    return stripe.subscriptions.update(subscriptionId, {
      items: [{ id: item.id, quantity }],
      proration_behavior: prorationBehavior,
      metadata: mergedMeta
    }, {
      stripeAccount: accountId
    })
  },

  /**
   * Previews invoice for replacing the first subscription line item price (Stripe invoices.createPreview).
   *
   * @param {object} params
   * @param {string} params.accountId
   * @param {string} params.subscriptionId
   * @param {string} params.newPriceId
   * @param {string} [params.prorationBehavior]
   * @returns {Promise<object>} Upcoming invoice preview
   */
  async previewSubscriptionPrimaryItemPriceChange ({ accountId, subscriptionId, newPriceId, prorationBehavior = 'create_prorations' }) {
    if (!accountId) throw new Error('Account ID is required')
    if (!subscriptionId) throw new Error('Subscription ID is required')
    if (!newPriceId) throw new Error('New price ID is required')

    const subscription = await this.getSubscription(accountId, subscriptionId)
    const item = subscription.items?.data?.[0]
    if (!item?.id) {
      throw new Error('Subscription has no line items')
    }

    const customer = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id
    if (!customer) {
      throw new Error('Subscription customer not found')
    }

    return stripe.invoices.createPreview({
      customer,
      subscription: subscriptionId,
      subscription_details: {
        proration_behavior: prorationBehavior,
        items: [{
          id: item.id,
          price: newPriceId
        }]
      },
      expand: ['lines.data']
    }, {
      stripeAccount: accountId
    })
  },

  /**
   * Preview invoice for immediate membership upgrade: new price, billing cycle reset,
   * no Stripe proration, optional Hylo prepaid credit as a negative invoice item.
   * If Stripe rejects negative invoice items (e.g. automatic tax), retries without
   * invoice_items and returns manualCreditCents for the caller to merge into totals.
   *
   * @param {object} params
   * @param {string} params.accountId
   * @param {string} params.subscriptionId
   * @param {string} params.newPriceId
   * @param {number} params.creditCents - Hylo unused prepaid credit (0 allowed)
   * @param {string} params.currency - lowercase ISO
   * @param {string} [params.creditDescription]
   * @returns {Promise<{ invoice: object, manualCreditCents: number|null }>}
   */
  async previewMembershipImmediateUpgradeWithHyloCredit ({
    accountId,
    subscriptionId,
    newPriceId,
    creditCents,
    currency,
    creditDescription
  }) {
    if (!accountId) throw new Error('Account ID is required')
    if (!subscriptionId) throw new Error('Subscription ID is required')
    if (!newPriceId) throw new Error('New price ID is required')

    const subscription = await this.getSubscription(accountId, subscriptionId)
    const item = subscription.items?.data?.[0]
    if (!item?.id) {
      throw new Error('Subscription has no line items')
    }

    const customer = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id
    if (!customer) {
      throw new Error('Subscription customer not found')
    }

    const cur = (currency || subscription.currency || 'usd').toLowerCase()
    const baseParams = {
      customer,
      subscription: subscriptionId,
      subscription_details: {
        proration_behavior: 'none',
        billing_cycle_anchor: 'now',
        items: [{
          id: item.id,
          price: newPriceId
        }]
      },
      expand: ['lines.data']
    }

    const credit = Math.max(0, Math.round(creditCents || 0))
    const desc = creditDescription || 'Unused prepaid time (prior membership offering)'

    if (credit > 0) {
      try {
        const invoice = await stripe.invoices.createPreview({
          ...baseParams,
          invoice_items: [{
            amount: -credit,
            currency: cur,
            description: desc
          }]
        }, {
          stripeAccount: accountId
        })
        return { invoice, manualCreditCents: null }
      } catch (_err) {
        // Negative invoice lines can fail (e.g. automatic tax). Fall back: preview subscription only;
        // caller merges manual credit into lines / amount_due.
      }
    }

    const invoice = await stripe.invoices.createPreview(baseParams, {
      stripeAccount: accountId
    })
    return {
      invoice,
      manualCreditCents: credit > 0 ? credit : null
    }
  },

  /**
   * Schedules a primary item price change at period end using a subscription schedule.
   * Stripe does not allow custom phases or metadata on the same request as from_subscription;
   * create does not accept phases[n].start_date — use create then update (Stripe docs).
   *
   * @param {object} params
   * @param {string} params.accountId
   * @param {string} params.subscriptionId
   * @param {string} params.newPriceId
   * @param {number|null} [params.quantity] - optional quantity for target phase
   * @param {object} [params.metadata]
   * @returns {Promise<object>} Stripe subscription schedule after update
   */
  async scheduleSubscriptionPrimaryItemPriceAtPeriodEnd ({ accountId, subscriptionId, newPriceId, quantity = null, metadata = {} }) {
    if (!accountId) throw new Error('Account ID is required')
    if (!subscriptionId) throw new Error('Subscription ID is required')
    if (!newPriceId) throw new Error('New price ID is required')

    const subscription = await this.getSubscription(accountId, subscriptionId)
    const item = subscription.items?.data?.[0]
    if (!item?.id || !item?.price?.id) {
      throw new Error('Subscription has no line items')
    }

    const mergedMeta = { ...(subscription.metadata || {}), ...metadata }

    const created = await stripe.subscriptionSchedules.create({
      from_subscription: subscriptionId
    }, {
      stripeAccount: accountId
    })

    const phase0 = created.phases?.[0]
    // Stripe-node may expose snake_case or camelCase; after from_subscription, bounds also live on phase 0.
    const periodEnd =
      subscription.current_period_end ??
      subscription.currentPeriodEnd ??
      phase0?.end_date ??
      phase0?.endDate
    const firstPhaseStart =
      phase0?.start_date ??
      phase0?.startDate ??
      subscription.current_period_start ??
      subscription.currentPeriodStart

    if (periodEnd == null || firstPhaseStart == null) {
      throw new Error('Could not determine billing period start or end for subscription schedule')
    }

    const updatedSchedule = await stripe.subscriptionSchedules.update(
      created.id,
      {
        phases: [
          {
            start_date: firstPhaseStart,
            end_date: periodEnd,
            items: [{ price: item.price.id, quantity: item.quantity || 1 }]
          },
          {
            items: [{ price: newPriceId, quantity: quantity != null ? quantity : (item.quantity || 1) }]
          }
        ],
        metadata: mergedMeta,
        proration_behavior: 'none'
      },
      {
        stripeAccount: accountId
      }
    )

    // Webhooks receive the Subscription object; correlation id must live on subscription metadata.
    await stripe.subscriptions.update(
      subscriptionId,
      { metadata: mergedMeta },
      { stripeAccount: accountId }
    )

    return updatedSchedule
  },

  /**
   * Retrieves multiple subscriptions from Stripe
   *
   * Fetches multiple subscriptions in a single batch for efficiency.
   * Returns an array of subscription objects.
   *
   * @param {String} accountId - The Stripe connected account ID
   * @param {Array<String>} subscriptionIds - Array of subscription IDs to retrieve
   * @returns {Promise<Array<Object>>} Array of subscription objects
   */
  async getSubscriptions (accountId, subscriptionIds) {
    if (!accountId || !subscriptionIds || subscriptionIds.length === 0) {
      return []
    }

    // Fetch subscriptions in parallel with error handling for individual failures
    const results = await Promise.allSettled(
      subscriptionIds.map(subId => this.getSubscription(accountId, subId))
    )

    // Return only successful results
    return results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value)
  },

  /**
   * Creates a Billing Portal session for a customer
   *
   * Generates a URL where customers can manage their subscriptions,
   * update payment methods, and view invoices.
   *
   * @param {String} accountId - The Stripe connected account ID
   * @param {String} customerId - The Stripe customer ID
   * @param {String} returnUrl - URL to redirect after portal session
   * @returns {Promise<Object>} Billing portal session with url property
   */
  async createBillingPortalSession (accountId, customerId, returnUrl) {
    try {
      if (!accountId) {
        throw new Error('Account ID is required to create a billing portal session')
      }

      if (!customerId) {
        throw new Error('Customer ID is required to create a billing portal session')
      }

      if (!returnUrl) {
        throw new Error('Return URL is required')
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl
      }, {
        stripeAccount: accountId
      })

      return session
    } catch (error) {
      console.error('Error creating billing portal session:', error)
      throw new Error(`Failed to create billing portal session: ${error.message}`)
    }
  },

  /**
   * Retrieves enriched transaction data from Stripe
   *
   * Fetches subscription or checkout session data to enrich our
   * transaction records with payment details.
   *
   * @param {String} accountId - The Stripe connected account ID
   * @param {String} subscriptionId - Optional subscription ID
   * @param {String} sessionId - Optional checkout session ID
   * @returns {Promise<Object>} Enriched data object
   */
  async getTransactionDetails (accountId, { subscriptionId, sessionId }) {
    try {
      if (!accountId) {
        return null
      }

      const result = {
        subscriptionStatus: null,
        currentPeriodEnd: null,
        amountPaid: null,
        currency: null,
        customerId: null,
        receiptUrl: null
      }

      // If we have a subscription ID, get subscription details
      if (subscriptionId) {
        try {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
            expand: ['latest_invoice', 'items.data.price']
          }, {
            stripeAccount: accountId
          })

          result.subscriptionStatus = subscription.status
          result.currentPeriodEnd = subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000)
            : null
          result.customerId = subscription.customer

          // Amount per billing period (unit × quantity), not unit-only — matches Hylo list price semantics
          const item0 = subscription.items?.data?.[0]
          if (item0?.price && item0.price.unit_amount != null) {
            const qty = item0.quantity != null ? item0.quantity : 1
            result.amountPaid = Math.round(item0.price.unit_amount * qty)
            result.currency = item0.price.currency
          }

          // Get receipt URL from latest invoice
          if (subscription.latest_invoice?.hosted_invoice_url) {
            result.receiptUrl = subscription.latest_invoice.hosted_invoice_url
          }
        } catch (subError) {
          console.error('Error fetching subscription:', subscriptionId, subError.message)
          // Continue - we may still have session data
        }
      }

      // If we have a session ID and no subscription data, get session details
      if (sessionId && !result.customerId) {
        try {
          const session = await stripe.checkout.sessions.retrieve(sessionId, {
            expand: ['payment_intent', 'line_items']
          }, {
            stripeAccount: accountId
          })

          result.customerId = session.customer
          result.amountPaid = session.amount_total
          result.currency = session.currency

          // For one-time payments, get receipt from payment intent
          if (session.payment_intent?.charges?.data?.[0]?.receipt_url) {
            result.receiptUrl = session.payment_intent.charges.data[0].receipt_url
          }
        } catch (sessError) {
          console.error('Error fetching checkout session:', sessionId, sessError.message)
        }
      }

      return result
    } catch (error) {
      console.error('Error getting transaction details:', error)
      return null
    }
  },

  /**
   * Utility function to format price from cents to display string
   *
   * @param {Number} cents - Price in cents
   * @param {String} currency - Currency code
   * @returns {String} Formatted price string (e.g. "$20.00")
   */
  formatPrice (cents, currency = 'usd') {
    const dollars = cents / 100
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(dollars)
  },

  /**
   * Transfers the platform contribution portion from a connected-account charge to the platform Stripe account.
   *
   * Optional Hylo platform contributions are paid on the connected account checkout; this moves that amount
   * to the platform balance (no separate connected destination).
   *
   * @param {String} connectedAccountId - The Stripe connected account ID (group's account)
   * @param {String} paymentIntentId - The payment intent ID from the checkout session or invoice
   * @param {Number} donationAmount - The contribution amount in cents
   * @param {String} currency - The currency code (e.g., 'usd')
   * @returns {Promise<Object>} The transfer object
   */
  async transferContributionToPlatform ({
    connectedAccountId,
    paymentIntentId,
    donationAmount,
    currency = 'usd'
  }) {
    try {
      if (!connectedAccountId) {
        throw new Error('Connected account ID is required')
      }

      if (!paymentIntentId) {
        throw new Error('Payment intent ID is required')
      }

      if (!donationAmount || donationAmount <= 0) {
        throw new Error('Valid contribution amount is required')
      }

      // Retrieve the payment intent to get the charge ID
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ['charges']
      }, {
        stripeAccount: connectedAccountId
      })

      // Get the charge ID from the payment intent
      const chargeId = paymentIntent.charges?.data?.[0]?.id
      if (!chargeId) {
        throw new Error('No charge found for payment intent')
      }

      const transferParams = {
        amount: donationAmount,
        currency: currency.toLowerCase(),
        source_transaction: chargeId,
        description: process.env.NODE_ENV === 'production'
          ? 'Hylo platform contribution'
          : 'Hylo platform contribution (test)'
      }

      // Omit destination so funds settle on the platform account
      const transfer = await stripe.transfers.create(transferParams)

      if (process.env.NODE_ENV === 'development') {
        console.log(`Transferred platform contribution of ${donationAmount} ${currency} to platform account`)
      }

      return transfer
    } catch (error) {
      console.error('Error transferring platform contribution:', error)
      throw new Error(`Failed to transfer platform contribution: ${error.message}`)
    }
  },

  /**
   * Cancels a subscription on a connected account
   *
   * Immediately cancels the subscription. The customer will lose access
   * at the end of the current billing period unless prorate is specified.
   *
   * @param {Object} params - Cancellation parameters
   * @param {String} params.accountId - The Stripe connected account ID
   * @param {String} params.subscriptionId - The subscription ID to cancel
   * @param {Boolean} [params.immediately=true] - If true, cancel immediately. If false, cancel at period end.
   * @returns {Promise<Object>} The cancelled subscription object
   */
  async cancelSubscription ({ accountId, subscriptionId, immediately = true }) {
    try {
      if (!accountId) {
        throw new Error('Account ID is required to cancel a subscription')
      }

      if (!subscriptionId) {
        throw new Error('Subscription ID is required')
      }

      let subscription

      if (immediately) {
        // Cancel immediately - customer loses access right away
        subscription = await stripe.subscriptions.cancel(subscriptionId, {}, {
          stripeAccount: accountId
        })
      } else {
        // Cancel at period end - customer keeps access until current period ends
        subscription = await stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true
        }, {
          stripeAccount: accountId
        })
      }

      if (process.env.NODE_ENV === 'development') {
        console.log(`Subscription ${subscriptionId} cancelled ${immediately ? 'immediately' : 'at period end'}`)
      }

      return subscription
    } catch (error) {
      console.error('Error cancelling subscription:', error)
      throw new Error(`Failed to cancel subscription: ${error.message}`)
    }
  },

  /**
   * Issues a refund for a payment on a connected account
   *
   * Can refund either by charge ID, payment intent ID, or the latest invoice
   * of a subscription. Supports full and partial refunds.
   *
   * @param {Object} params - Refund parameters
   * @param {String} params.accountId - The Stripe connected account ID
   * @param {String} [params.chargeId] - The charge ID to refund
   * @param {String} [params.paymentIntentId] - The payment intent ID to refund
   * @param {String} [params.subscriptionId] - The subscription ID (will refund latest invoice)
   * @param {Number} [params.amount] - Amount to refund in cents (omit for full refund)
   * @param {String} [params.reason] - Reason for refund: 'duplicate', 'fraudulent', or 'requested_by_customer'
   * @returns {Promise<Object>} The refund object
   */
  async refund ({ accountId, chargeId, paymentIntentId, subscriptionId, amount, reason = 'requested_by_customer' }) {
    try {
      if (!accountId) {
        throw new Error('Account ID is required to issue a refund')
      }

      if (!chargeId && !paymentIntentId && !subscriptionId) {
        throw new Error('Either chargeId, paymentIntentId, or subscriptionId is required')
      }

      const refundParams = {}

      // If we have a subscription ID, find a refundable payment
      if (subscriptionId && !chargeId && !paymentIntentId) {
        let foundPayment = false
        const isDev = process.env.NODE_ENV === 'development'

        if (isDev) {
          console.log(`[Refund Debug] Looking for payment for subscription: ${subscriptionId} on account: ${accountId}`)
        }

        // Strategy 1: Try listing paid invoices for this subscription
        try {
          const invoices = await stripe.invoices.list({
            subscription: subscriptionId,
            status: 'paid',
            limit: 5
          }, {
            stripeAccount: accountId
          })

          if (isDev) {
            console.log(`[Refund Debug] Strategy 1 - Found ${invoices.data.length} paid invoices`)
          }

          // Find the most recent paid invoice with a charge or payment_intent
          for (const invoice of invoices.data) {
            if (isDev) {
              console.log(`[Refund Debug] Invoice ${invoice.id}: amount_due=${invoice.amount_due}, amount_paid=${invoice.amount_paid}, total=${invoice.total}, payment_intent=${invoice.payment_intent}, charge=${invoice.charge}`)
            }
            if (invoice.payment_intent) {
              paymentIntentId = typeof invoice.payment_intent === 'string'
                ? invoice.payment_intent
                : invoice.payment_intent.id
              foundPayment = true
              if (isDev) {
                console.log(`[Refund Debug] Found payment_intent: ${paymentIntentId}`)
              }
              break
            } else if (invoice.charge) {
              chargeId = typeof invoice.charge === 'string'
                ? invoice.charge
                : invoice.charge.id
              foundPayment = true
              if (isDev) {
                console.log(`[Refund Debug] Found charge: ${chargeId}`)
              }
              break
            }
          }
        } catch (invoiceListError) {
          if (isDev) {
            console.log('[Refund Debug] Strategy 1 failed:', invoiceListError.message)
          }
        }

        // Strategy 2: Retrieve subscription with latest_invoice expanded
        // This is more reliable for Checkout-created subscriptions where the
        // invoice might not immediately appear in the 'paid' status list
        if (!foundPayment) {
          if (isDev) {
            console.log('[Refund Debug] Strategy 2 - Retrieving subscription with expanded latest_invoice')
          }
          try {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
              expand: ['latest_invoice.payment_intent', 'latest_invoice.charge']
            }, {
              stripeAccount: accountId
            })

            if (isDev) {
              console.log(`[Refund Debug] Subscription status: ${subscription.status}`)
            }
            const latestInvoice = subscription.latest_invoice
            if (isDev) {
              console.log(`[Refund Debug] Latest invoice: ${latestInvoice ? latestInvoice.id : 'null'}, status: ${latestInvoice?.status}, amount_due: ${latestInvoice?.amount_due}, amount_paid: ${latestInvoice?.amount_paid}, total: ${latestInvoice?.total}`)
            }

            if (latestInvoice) {
              if (isDev) {
                console.log(`[Refund Debug] Latest invoice payment_intent: ${latestInvoice.payment_intent?.id || latestInvoice.payment_intent || 'null'}`)
                console.log(`[Refund Debug] Latest invoice charge: ${latestInvoice.charge?.id || latestInvoice.charge || 'null'}`)
              }

              if (latestInvoice.payment_intent) {
                paymentIntentId = typeof latestInvoice.payment_intent === 'string'
                  ? latestInvoice.payment_intent
                  : latestInvoice.payment_intent.id
                foundPayment = true
                if (isDev) {
                  console.log(`[Refund Debug] Found payment_intent from latest_invoice: ${paymentIntentId}`)
                }
              } else if (latestInvoice.charge) {
                chargeId = typeof latestInvoice.charge === 'string'
                  ? latestInvoice.charge
                  : latestInvoice.charge.id
                foundPayment = true
                if (isDev) {
                  console.log(`[Refund Debug] Found charge from latest_invoice: ${chargeId}`)
                }
              }
            }
          } catch (subscriptionError) {
            if (isDev) {
              console.log('[Refund Debug] Strategy 2 failed:', subscriptionError.message)
            }
          }
        }

        // Strategy 3: List ALL invoices (not just 'paid' status) for this subscription
        if (!foundPayment) {
          if (isDev) {
            console.log('[Refund Debug] Strategy 3 - Listing all invoices for subscription')
          }
          try {
            const allInvoices = await stripe.invoices.list({
              subscription: subscriptionId,
              limit: 10
            }, {
              stripeAccount: accountId
            })

            if (isDev) {
              console.log(`[Refund Debug] Found ${allInvoices.data.length} total invoices`)
            }
            for (const invoice of allInvoices.data) {
              if (isDev) {
                console.log(`[Refund Debug] Invoice ${invoice.id}: status=${invoice.status}, amount_due=${invoice.amount_due}, amount_paid=${invoice.amount_paid}, total=${invoice.total}, payment_intent=${invoice.payment_intent}, charge=${invoice.charge}`)
              }
              if (invoice.payment_intent) {
                paymentIntentId = typeof invoice.payment_intent === 'string'
                  ? invoice.payment_intent
                  : invoice.payment_intent.id
                foundPayment = true
                if (isDev) {
                  console.log(`[Refund Debug] Found payment_intent: ${paymentIntentId}`)
                }
                break
              } else if (invoice.charge) {
                chargeId = typeof invoice.charge === 'string'
                  ? invoice.charge
                  : invoice.charge.id
                foundPayment = true
                if (isDev) {
                  console.log(`[Refund Debug] Found charge: ${chargeId}`)
                }
                break
              }
            }
          } catch (allInvoicesError) {
            if (isDev) {
              console.log('[Refund Debug] Strategy 3 failed:', allInvoicesError.message)
            }
          }
        }

        // Strategy 4: Get the subscription's customer and list their charges
        if (!foundPayment) {
          if (isDev) {
            console.log('[Refund Debug] Strategy 4 - Looking up charges via subscription customer')
          }
          try {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId, {}, {
              stripeAccount: accountId
            })
            const customerId = subscription.customer
            if (isDev) {
              console.log(`[Refund Debug] Subscription customer: ${customerId}`)
            }

            if (customerId) {
              const charges = await stripe.charges.list({
                customer: typeof customerId === 'string' ? customerId : customerId.id,
                limit: 10
              }, {
                stripeAccount: accountId
              })

              if (isDev) {
                console.log(`[Refund Debug] Found ${charges.data.length} charges for customer`)
              }
              for (const charge of charges.data) {
                if (isDev) {
                  console.log(`[Refund Debug] Charge ${charge.id}: amount=${charge.amount}, status=${charge.status}, paid=${charge.paid}, refunded=${charge.refunded}`)
                }
                if (charge.paid && !charge.refunded) {
                  chargeId = charge.id
                  foundPayment = true
                  if (isDev) {
                    console.log(`[Refund Debug] Found refundable charge: ${chargeId}`)
                  }
                  break
                }
              }
            }
          } catch (chargeError) {
            if (isDev) {
              console.log('[Refund Debug] Strategy 4 failed:', chargeError.message)
            }
          }
        }

        // Strategy 5: List payment intents for the customer
        if (!foundPayment) {
          if (isDev) {
            console.log('[Refund Debug] Strategy 5 - Looking up payment intents via customer')
          }
          try {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId, {}, {
              stripeAccount: accountId
            })
            const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id

            if (customerId) {
              const paymentIntents = await stripe.paymentIntents.list({
                customer: customerId,
                limit: 10
              }, {
                stripeAccount: accountId
              })

              if (isDev) {
                console.log(`[Refund Debug] Found ${paymentIntents.data.length} payment intents for customer`)
              }
              for (const pi of paymentIntents.data) {
                if (isDev) {
                  console.log(`[Refund Debug] PaymentIntent ${pi.id}: amount=${pi.amount}, status=${pi.status}`)
                }
                if (pi.status === 'succeeded') {
                  paymentIntentId = pi.id
                  foundPayment = true
                  if (isDev) {
                    console.log(`[Refund Debug] Found refundable payment intent: ${paymentIntentId}`)
                  }
                  break
                }
              }
            }
          } catch (piError) {
            if (isDev) {
              console.log('[Refund Debug] Strategy 5 failed:', piError.message)
            }
          }
        }

        if (!foundPayment) {
          if (isDev) {
            console.log('[Refund Debug] All strategies failed - no payment found')
          }
          throw new Error('No refundable payment found for this subscription. Could not find any charges or payment intents.')
        }
      }

      // Build refund parameters
      if (chargeId) {
        refundParams.charge = chargeId
      } else if (paymentIntentId) {
        refundParams.payment_intent = paymentIntentId
      }

      if (amount) {
        refundParams.amount = amount
      }

      if (reason) {
        refundParams.reason = reason
      }

      // Issue the refund on the connected account
      const refund = await stripe.refunds.create(refundParams, {
        stripeAccount: accountId
      })

      if (process.env.NODE_ENV === 'development') {
        console.log(`Refund issued: ${refund.id} for ${refund.amount} ${refund.currency}`)
      }

      return refund
    } catch (error) {
      console.error('Error issuing refund:', error)
      throw new Error(`Failed to issue refund: ${error.message}`)
    }
  }
}
