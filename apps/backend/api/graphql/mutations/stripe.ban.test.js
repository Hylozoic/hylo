/* eslint-disable no-unused-expressions */
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import mock from 'mock-require'
import { assignAdministrator } from '../../../test/setup/roleHelpers'
import { removeMember } from './group'

/* global StripeAccount, StripeProduct */

// Stands in for Stripe: only what starting a checkout needs
let checkoutsStarted = 0
mock('../../services/StripeService', {
  getPrice: async (accountId, priceId) => ({ id: priceId, unit_amount: 2000, currency: 'usd' }),
  applicationFeeForAmount: amount => Math.round(amount * 0.07),
  createCheckoutSession: async () => {
    checkoutsStarted++
    return { id: 'cs_test_ban', url: 'https://checkout.stripe.com/pay/cs_test_ban' }
  }
})

const { createStripeCheckoutSession } = mock.reRequire('./stripe')

describe('buying access to a group someone is blocked from rejoining', () => {
  let steward, group, offering

  const checkout = userId => createStripeCheckoutSession(userId, {
    groupId: group.id,
    offeringId: offering.id,
    successUrl: 'https://example.com/success',
    cancelUrl: 'https://example.com/cancel'
  })

  before(async () => {
    steward = await factories.user().save()
    group = await factories.group({ accessibility: Group.Accessibility.RESTRICTED }).save()
    await assignAdministrator(steward, group)
    const account = await StripeAccount.forge({ stripe_account_external_id: 'acct_test_ban' }).save()
    await group.save({ stripe_account_id: account.id })
    offering = await StripeProduct.forge({
      group_id: group.id,
      stripe_product_id: 'prod_test_ban',
      stripe_price_id: 'price_test_ban',
      name: 'Membership',
      price_in_cents: 2000,
      currency: 'usd',
      access_grants: JSON.stringify({ groupIds: [group.id] }),
      publish_status: 'published'
    }).save()
  })

  after(async function () {
    this.timeout(10000)
    mock.stopAll()
    await setup.clearDb()
  })

  it("refuses to start a checkout for someone removed and blocked, and doesn't reach Stripe", async () => {
    const person = await factories.user().save()
    await person.joinGroup(group)
    await removeMember(steward.id, person.id, group.id, {}, { blockFromRejoining: true })
    const before = checkoutsStarted

    // The message reaches the person as it is, not wrapped in a checkout failure
    const error = await checkout(person.id).then(() => null, err => err)
    expect(error && error.message).to.equal("You can't join this group")
    expect(checkoutsStarted).to.equal(before)
  })

  it('lets people who were never blocked, current members, and people whose block was lifted buy', async () => {
    const newcomer = await factories.user().save()
    expect((await checkout(newcomer.id)).success).to.be.true

    const member = await factories.user().save()
    await member.joinGroup(group)
    expect((await checkout(member.id)).success).to.be.true

    const forgiven = await factories.user().save()
    await forgiven.joinGroup(group)
    await removeMember(steward.id, forgiven.id, group.id, {}, { blockFromRejoining: true })
    await GroupBan.lift({ groupId: group.id, userId: forgiven.id, liftedById: steward.id })
    expect((await checkout(forgiven.id)).success).to.be.true
  })
})
