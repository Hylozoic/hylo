/* eslint-disable no-unused-expressions */
const root = require('root-path')
require(root('test/setup'))
const { mockify, unspyify } = require(root('test/setup/helpers'))

describe('StripeService checkout', () => {
  let StripeService, stripeClient

  before(() => {
    StripeService = require(root('api/services/StripeService'))
    stripeClient = require('stripe')()
  })

  describe('createCheckoutSession', () => {
    let originalCreate, createdConfigs

    beforeEach(() => {
      originalCreate = stripeClient.checkout.sessions.create
      createdConfigs = []
      stripeClient.checkout.sessions.create = async (config, options) => {
        createdConfigs.push({ config, options })
        return { id: 'cs_checkout_test', url: 'https://checkout.example/cs_checkout_test' }
      }
      mockify(StripeService, 'ensureDonationPriceExists', async () => 'price_contribution')
    })

    afterEach(() => {
      stripeClient.checkout.sessions.create = originalCreate
      unspyify(StripeService, 'ensureDonationPriceExists')
    })

    const createSession = (params = {}) => StripeService.createCheckoutSession({
      accountId: 'acct_checkout',
      priceId: 'price_checkout',
      applicationFeeAmount: 140,
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
      ...params
    })

    it('pre-fills the buyer\'s email and allows promotion codes', async () => {
      await createSession({ customerEmail: 'buyer@example.com' })

      expect(createdConfigs).to.have.length(1)
      const { config, options } = createdConfigs[0]
      expect(config.customer_email).to.equal('buyer@example.com')
      expect(config.allow_promotion_codes).to.equal(true)
      expect(config.payment_intent_data.application_fee_amount).to.equal(140)
      expect(options).to.deep.equal({ stripeAccount: 'acct_checkout' })
    })

    it('allows promotion codes on subscriptions too, and leaves the email blank when unknown', async () => {
      await createSession({ mode: 'subscription' })

      const { config } = createdConfigs[0]
      expect(config.allow_promotion_codes).to.equal(true)
      expect(config).to.not.have.property('customer_email')
      expect(config.subscription_data.application_fee_percent).to.equal(7.0)
    })
  })

  describe('applicationFeeForAmount', () => {
    it('takes 7% and never more than the amount', () => {
      expect(StripeService.applicationFeeForAmount(2000)).to.equal(140)
      expect(StripeService.applicationFeeForAmount(10)).to.equal(1)
      expect(StripeService.applicationFeeForAmount(0)).to.equal(0)
      expect(StripeService.applicationFeeForAmount(-50)).to.equal(0)
    })
  })

  describe('refundApplicationFeeAboveShare', () => {
    let originalRetrieve, originalApplicationFees, feeRefunds, applicationFee

    beforeEach(() => {
      originalRetrieve = stripeClient.paymentIntents.retrieve
      originalApplicationFees = stripeClient.applicationFees
      applicationFee = { id: 'fee_checkout', amount: 700, amount_refunded: 0 }
      stripeClient.paymentIntents.retrieve = async (id, params, options) => {
        expect(options).to.deep.equal({ stripeAccount: 'acct_checkout' })
        return { id, latest_charge: { id: 'ch_checkout', application_fee: 'fee_checkout' } }
      }
      feeRefunds = []
      stripeClient.applicationFees = {
        retrieve: async () => applicationFee,
        createRefund: async (id, params) => {
          feeRefunds.push({ id, params })
          applicationFee.amount_refunded += params.amount
          return { id: 'fr_checkout', amount: params.amount }
        }
      }
    })

    afterEach(() => {
      stripeClient.paymentIntents.retrieve = originalRetrieve
      stripeClient.applicationFees = originalApplicationFees
    })

    const refundFor = paidAmount => StripeService.refundApplicationFeeAboveShare({
      accountId: 'acct_checkout',
      paymentIntentId: 'pi_checkout',
      paidAmount
    })

    it('refunds the part of the fee above Hylo\'s share after a large discount', async () => {
      // A 10000 price with a 95% promotion code: the fee was set at 700, the buyer paid 500
      const refunded = await refundFor(500)

      expect(refunded).to.equal(665)
      expect(feeRefunds).to.have.length(1)
      expect(feeRefunds[0].id).to.equal('fee_checkout')
      expect(feeRefunds[0].params.amount).to.equal(665)
    })

    it('refunds nothing when the fee is within the share of what was paid', async () => {
      const refunded = await refundFor(10000)

      expect(refunded).to.equal(0)
      expect(feeRefunds).to.have.length(0)
    })

    it('does not refund twice when called again', async () => {
      await refundFor(500)
      const second = await refundFor(500)

      expect(second).to.equal(0)
      expect(feeRefunds).to.have.length(1)
    })

    it('does nothing when the charge has no application fee', async () => {
      stripeClient.paymentIntents.retrieve = async () => ({ latest_charge: { id: 'ch_free' } })

      expect(await refundFor(500)).to.equal(0)
      expect(feeRefunds).to.have.length(0)
    })
  })
})
