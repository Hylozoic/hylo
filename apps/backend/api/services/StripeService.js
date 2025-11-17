/**
 * StripeService
 *
 * Service for managing Stripe Connect integration.
 * Handles connected account creation, onboarding, product management,
 * and payment processing for groups.
 */

const Stripe = require('stripe')

// Initialize Stripe with API version
// TODO STRIPE: Replace with your actual Stripe secret key
// Set this in your environment variables as STRIPE_SECRET_KEY
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY

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
      const retrievedAccount = await stripe.accounts.retrieve(accountId)

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
   * @returns {Promise<Object>} The created product with default price
   */
  async createProduct ({ accountId, name, description, priceInCents, currency = 'usd' }) {
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

      // Create product on the connected account using stripeAccount parameter
      const product = await stripe.products.create({
        name,
        description: description || '',
        default_price_data: {
          unit_amount: priceInCents,
          currency: currency.toLowerCase()
        }
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
   * @param {Object} params - Checkout session parameters
   * @param {String} params.accountId - The Stripe connected account ID
   * @param {String} params.priceId - The price ID to charge
   * @param {Number} params.quantity - Quantity to purchase
   * @param {Number} params.applicationFeeAmount - Platform fee in cents
   * @param {String} params.successUrl - URL to redirect on success
   * @param {String} params.cancelUrl - URL to redirect on cancel
   * @param {Object} params.metadata - Optional metadata to attach
   * @returns {Promise<Object>} Checkout session with url to redirect customer
   */
  async createCheckoutSession ({
    accountId,
    priceId,
    quantity = 1,
    applicationFeeAmount,
    successUrl,
    cancelUrl,
    metadata = {}
  }) {
    try {
      // Validate required parameters
      if (!accountId) {
        throw new Error('Account ID is required to create a checkout session')
      }

      if (!priceId) {
        throw new Error('Price ID is required')
      }

      if (!applicationFeeAmount || applicationFeeAmount < 0) {
        throw new Error('Valid application fee amount is required')
      }

      if (!successUrl || !cancelUrl) {
        throw new Error('Both success and cancel URLs are required')
      }

      // Create checkout session on the connected account
      const session = await stripe.checkout.sessions.create({
        line_items: [{
          price: priceId,
          quantity
        }],
        mode: 'payment',
        // Direct charge with application fee
        payment_intent_data: {
          application_fee_amount: applicationFeeAmount,
          metadata: {
            session_id: 'placeholder' // Will be updated after session creation
          }
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata
      }, {
        stripeAccount: accountId // Process payment on connected account
      })

      // Update the payment intent with the actual session ID for refund tracking
      if (session.payment_intent) {
        await stripe.paymentIntents.update(session.payment_intent, {
          metadata: {
            session_id: session.id
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
  }
}
