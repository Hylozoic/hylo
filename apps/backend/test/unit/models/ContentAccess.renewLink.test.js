/* eslint-disable no-unused-expressions */
const root = require('root-path')
const setup = require(root('test/setup'))
const factories = require(root('test/setup/factories'))
const { mockify, unspyify } = require(root('test/setup/helpers'))
/* global ContentAccess, StripeProduct, Frontend, Queue */

describe('ContentAccess renew link', () => {
  let user, group, space, product, queued

  const expiredAccess = (attrs = {}) => ContentAccess.create({
    user_id: user.id,
    granted_by_group_id: group.id,
    group_id: group.id,
    access_type: ContentAccess.Type.STRIPE_PURCHASE,
    status: ContentAccess.Status.ACTIVE,
    expires_at: new Date(Date.now() - 60 * 60 * 1000),
    ...attrs
  })

  const loadForEmail = access => ContentAccess.where({ id: access.id })
    .fetch({ withRelated: ['product', 'group', 'grantedByGroup'] })

  beforeEach(async () => {
    await setup.clearDb()
    user = await factories.user().save()
    group = await factories.group({ slug: 'renew-parent' }).save()
    space = await factories.group({ type: 'space', parent_id: group.id, slug: 'renew-parent-workshop' }).save()
    product = await StripeProduct.create({
      group_id: group.id,
      stripe_product_id: 'prod_renew',
      stripe_price_id: 'price_renew',
      name: 'Workshop Pass',
      description: 'workshop',
      price_in_cents: 1500,
      currency: 'usd',
      renewal_policy: 'manual',
      duration: 'month',
      access_grants: { groupIds: [space.id] },
      publish_status: 'published'
    })
    queued = []
    mockify(Queue, 'classMethod', (className, methodName, data) => {
      queued.push({ className, methodName, data })
      return Promise.resolve()
    })
  })

  afterEach(() => unspyify(Queue, 'classMethod'))

  it('opens the offering page when the access came from a product', async () => {
    const access = await expiredAccess({ group_id: space.id, product_id: product.id })

    const renewUrl = await ContentAccess.renewUrl(await loadForEmail(access))

    expect(renewUrl).to.equal(Frontend.Route.offering(group, product))
    expect(renewUrl).to.match(new RegExp(`/groups/renew-parent/offerings/${product.id}$`))
  })

  it('opens the space itself when the offering was archived or unpublished', async () => {
    const access = await expiredAccess({ group_id: space.id, product_id: product.id })

    await product.save({ publish_status: StripeProduct.PublishStatus.ARCHIVED }, { patch: true })
    expect(await ContentAccess.renewUrl(await loadForEmail(access))).to.match(/\/groups\/renew-parent\/spaces\/workshop$/)

    await product.save({ publish_status: StripeProduct.PublishStatus.UNPUBLISHED }, { patch: true })
    expect(await ContentAccess.renewUrl(await loadForEmail(access))).to.match(/\/groups\/renew-parent\/spaces\/workshop$/)

    await product.save({ publish_status: StripeProduct.PublishStatus.UNLISTED }, { patch: true })
    expect(await ContentAccess.renewUrl(await loadForEmail(access))).to.equal(Frontend.Route.offering(group, product))
  })

  it('opens the space itself, under its parent, when a space access has no product', async () => {
    const access = await expiredAccess({ group_id: space.id, access_type: ContentAccess.Type.ADMIN_GRANT })

    const renewUrl = await ContentAccess.renewUrl(await loadForEmail(access))

    expect(renewUrl).to.match(/\/groups\/renew-parent\/spaces\/workshop$/)
  })

  it('opens the group itself when a group access has no product', async () => {
    const access = await expiredAccess({ access_type: ContentAccess.Type.ADMIN_GRANT })

    const renewUrl = await ContentAccess.renewUrl(await loadForEmail(access))

    expect(renewUrl).to.equal(Frontend.Route.group(group))
  })

  it('puts the renew link in the access-expired email', async () => {
    await expiredAccess({ group_id: space.id, product_id: product.id })

    await ContentAccess.sendExpiredAccessNotifications()

    const email = queued.find(q => q.methodName === 'sendAccessExpired')
    expect(email).to.exist
    expect(email.data.data.renew_url).to.equal(Frontend.Route.offering(group, product))
  })
})
