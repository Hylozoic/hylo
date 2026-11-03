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
    expect(queued).to.deep.equal([
      { model: 'Group', method: 'notifyAboutPublicListingRequest', data: { groupId: group.id } },
      { model: 'Group', method: 'messageAdminsAboutPublicListingRequest', data: { groupId: group.id } }
    ])
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

describe('commons request notification jobs', () => {
  let steward, group, env, messages, emails, warnings, emailResult

  const ENV_KEYS = ['HYLO_ADMINS', 'NEW_GROUP_EMAIL']

  before(async () => {
    steward = await factories.user({ name: 'Sam Steward' }).save()
    group = await factories.group({ name: 'Garden <Club>', visibility: Group.Visibility.PUBLIC }).save()
    await group.save({
      settings: {
        public_listing_request: {
          status: 'pending',
          message: 'We grow food & share it',
          requested_at: new Date().toISOString(),
          requested_by_id: String(steward.id)
        }
      }
    }, { patch: true })
  })

  after(() => setup.clearDb())

  beforeEach(() => {
    env = {}
    ENV_KEYS.forEach(key => { env[key] = process.env[key] })
    process.env.HYLO_ADMINS = '11, 22'
    process.env.NEW_GROUP_EMAIL = 'team@hylo.test'
    messages = []
    emails = []
    warnings = []
    emailResult = true
    mockify(MessagingService, 'sendMessageFromAxolotl', (userIds, text) => {
      messages.push({ userIds, text })
      return Promise.resolve({ id: 1 })
    })
    mockify(Email, 'sendRawEmail', opts => {
      emails.push(opts)
      return Promise.resolve(emailResult)
    })
    mockify(sails.log, 'warn', msg => warnings.push(msg))
  })

  afterEach(() => {
    ENV_KEYS.forEach(key => {
      if (env[key] === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = env[key]
      }
    })
    unspyify(MessagingService, 'sendMessageFromAxolotl')
    unspyify(Email, 'sendRawEmail')
    unspyify(sails.log, 'warn')
  })

  it('messages every Hylo admin in one Axolotl thread with the review link', async () => {
    await Group.messageAdminsAboutPublicListingRequest({ groupId: group.id })
    expect(messages).to.have.length(1)
    expect(messages[0].userIds).to.deep.equal([11, 22])
    expect(messages[0].text).to.include('Sam Steward asked to add Garden &lt;Club&gt; to the commons.')
    expect(messages[0].text).to.include('Message: We grow food &amp; share it')
    expect(messages[0].text).to.include(Frontend.Route.managementCommonsRequests())
  })

  it('still messages admins when NEW_GROUP_EMAIL is unset, and warns instead of emailing', async () => {
    delete process.env.NEW_GROUP_EMAIL
    expect(await Group.notifyAboutPublicListingRequest({ groupId: group.id })).to.equal(false)
    await Group.messageAdminsAboutPublicListingRequest({ groupId: group.id })
    expect(emails).to.have.length(0)
    expect(messages).to.have.length(1)
    expect(warnings.some(w => /NEW_GROUP_EMAIL is not set/.test(w))).to.equal(true)
  })

  it('skips the message with a warning when HYLO_ADMINS is unset', async () => {
    delete process.env.HYLO_ADMINS
    expect(await Group.messageAdminsAboutPublicListingRequest({ groupId: group.id })).to.equal(false)
    expect(messages).to.have.length(0)
    expect(warnings.some(w => /HYLO_ADMINS is not set/.test(w))).to.equal(true)
  })

  it('warns when the group has no request', async () => {
    const other = await factories.group().save()
    expect(await Group.notifyAboutPublicListingRequest({ groupId: other.id })).to.equal(false)
    expect(warnings.some(w => /no commons request found/.test(w))).to.equal(true)
  })

  it('emails the Hylo team with the review link', async () => {
    await Group.notifyAboutPublicListingRequest({ groupId: group.id })
    expect(emails).to.have.length(1)
    expect(emails[0].email).to.equal('team@hylo.test')
    expect(emails[0].data.body).to.include(Frontend.Route.managementCommonsRequests())
  })

  it('throws when the team email fails to send, without messaging admins again on retry', async () => {
    emailResult = false
    await expect(Group.notifyAboutPublicListingRequest({ groupId: group.id })).to.be.rejectedWith(/failed to send/)
    // kue retries only the failed email job; the message job is separate
    await expect(Group.notifyAboutPublicListingRequest({ groupId: group.id })).to.be.rejectedWith(/failed to send/)
    expect(emails).to.have.length(2)
    expect(messages).to.have.length(0)
  })

  it('throws when the decision email fails to send', async () => {
    await group.save({ settings: { ...group.get('settings'), public_listing_request: { ...group.getSetting('public_listing_request'), status: 'denied' } } }, { patch: true })
    emailResult = false
    await expect(Group.sendPublicListingDecision({ groupId: group.id })).to.be.rejectedWith(/failed to send/)
    emailResult = true
    expect(await Group.sendPublicListingDecision({ groupId: group.id })).to.equal(true)
  })
})
