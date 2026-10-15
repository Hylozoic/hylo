import { expect } from 'chai'
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import { mockify, unspyify } from '../../../test/setup/helpers'
import { requestPublicListing, reviewPublicListingRequest, publicListingRequests } from './publicListingRequest'

describe('public listing (commons) requests', () => {
  let steward, member, admin, group, originalAdmins, queued

  before(async () => {
    steward = await factories.user().save()
    member = await factories.user().save()
    admin = await factories.user().save()
    group = await factories.group({ visibility: Group.Visibility.PUBLIC, allow_in_public: false }).save()
    await steward.joinGroup(group, { assignAdministrator: true })
    await member.joinGroup(group)
  })

  after(() => setup.clearDb())

  beforeEach(() => {
    originalAdmins = process.env.HYLO_ADMINS
    process.env.HYLO_ADMINS = String(admin.id)
    queued = []
    mockify(Queue, 'classMethod', (model, method, data) => {
      queued.push({ model, method, data })
      return Promise.resolve()
    })
  })

  afterEach(() => {
    if (originalAdmins === undefined) {
      delete process.env.HYLO_ADMINS
    } else {
      process.env.HYLO_ADMINS = originalAdmins
    }
    unspyify(Queue, 'classMethod')
  })

  it('does not let a non-steward request', async () => {
    await expect(requestPublicListing(member.id, group.id)).to.be.rejectedWith(/responsibilities/)
  })

  it('stores a pending request and notifies the Hylo team', async () => {
    await requestPublicListing(steward.id, group.id, '  We are a public commons group  ')
    await group.refresh()
    const request = group.getSetting('public_listing_request')
    expect(request.status).to.equal('pending')
    expect(request.message).to.equal('We are a public commons group')
    expect(request.requested_by_id).to.equal(String(steward.id))
    expect(group.get('allow_in_public')).to.equal(false)
    expect(queued).to.deep.equal([{ model: 'Group', method: 'notifyAboutPublicListingRequest', data: { groupId: group.id } }])
  })

  it('rejects a second request while one is pending', async () => {
    await expect(requestPublicListing(steward.id, group.id)).to.be.rejectedWith(/pending/)
  })

  it('lists pending requests for admins only', async () => {
    await expect(publicListingRequests(steward.id, 'pending')).to.be.rejectedWith(/Admin access/)
    const pending = await publicListingRequests(admin.id, 'pending')
    expect(pending.map(g => g.id)).to.include(group.id)
    const approved = await publicListingRequests(admin.id, 'approved')
    expect(approved.map(g => g.id)).not.to.include(group.id)
  })

  it('does not let a steward review their own request', async () => {
    await expect(reviewPublicListingRequest(steward.id, group.id, true)).to.be.rejectedWith(/Admin access/)
  })

  it('denies a request without turning on allow_in_public, then allows a new request', async () => {
    await reviewPublicListingRequest(admin.id, group.id, false, 'Please add a description first')
    await group.refresh()
    const request = group.getSetting('public_listing_request')
    expect(request.status).to.equal('denied')
    expect(request.review_message).to.equal('Please add a description first')
    expect(group.get('allow_in_public')).to.equal(false)
    expect(queued).to.deep.equal([{ model: 'Group', method: 'sendPublicListingDecision', data: { groupId: group.id } }])

    await requestPublicListing(steward.id, group.id)
    await group.refresh()
    const newRequest = group.getSetting('public_listing_request')
    expect(newRequest.status).to.equal('pending')
    expect(newRequest.review_message).to.equal(undefined)
  })

  it('approves a request and turns on allow_in_public', async () => {
    await reviewPublicListingRequest(admin.id, group.id, true)
    await group.refresh()
    expect(group.getSetting('public_listing_request.status')).to.equal('approved')
    expect(group.get('allow_in_public')).to.equal(true)
    await expect(reviewPublicListingRequest(admin.id, group.id, true)).to.be.rejectedWith(/no pending request/)
  })

  it('does not let stewards change the request through group settings', async () => {
    await group.update({ settings: { public_listing_request: { status: 'pending' }, allow_group_invites: true } }, steward.id)
    await group.refresh()
    expect(group.getSetting('public_listing_request.status')).to.equal('approved')
    expect(group.getSetting('allow_group_invites')).to.equal(true)
  })
})
