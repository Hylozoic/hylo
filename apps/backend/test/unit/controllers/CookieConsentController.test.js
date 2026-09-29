/* eslint-disable no-unused-expressions */
const rootPath = require('root-path')
const setup = require(rootPath('test/setup'))
const factories = require(rootPath('test/setup/factories'))
const CookieConsentController = require(rootPath('api/controllers/CookieConsentController'))
const mixpanel = require(rootPath('lib/mixpanel'))

describe('CookieConsentController', () => {
  let user, saved, calls

  async function upsert (analytics, { signedInAs } = {}) {
    const req = factories.mock.request()
    const res = factories.mock.response()
    req.body = { settings: { analytics, support: true }, user_id: user.id }
    if (signedInAs) req.login(signedInAs.id)
    await CookieConsentController.upsert(req, res)
    expect(res.body).to.deep.include({ success: true })
    return res
  }

  beforeEach(async () => {
    await setup.clearDb()
    user = await factories.user().save()
    calls = { set: [], delete: [] }
    saved = { disabled: mixpanel.disabled, set: mixpanel.people.set, deleteUser: mixpanel.people.delete_user }
    mixpanel.disabled = false
    mixpanel.people.set = (...args) => calls.set.push(args)
    mixpanel.people.delete_user = (...args) => calls.delete.push(args)
  })

  afterEach(() => {
    mixpanel.disabled = saved.disabled
    mixpanel.people.set = saved.set
    mixpanel.people.delete_user = saved.deleteUser
  })

  it('deletes the Mixpanel profile when analytics are turned off', async () => {
    await upsert(true, { signedInAs: user })
    await upsert(false, { signedInAs: user })
    expect(calls.delete).to.deep.equal([[String(user.id)]])
    expect(calls.set).to.deep.equal([])
  })

  it('deletes the profile when the first answer is a rejection', async () => {
    await upsert(false, { signedInAs: user })
    expect(calls.delete).to.deep.equal([[String(user.id)]])
  })

  it('does not delete again when the choice was already a rejection', async () => {
    await upsert(false, { signedInAs: user })
    await upsert(false, { signedInAs: user })
    expect(calls.delete).to.have.length(1)
  })

  it('records the opt-in property when analytics are turned back on', async () => {
    await upsert(false, { signedInAs: user })
    await upsert(true, { signedInAs: user })
    expect(calls.set).to.deep.equal([[user.id, { analytics_opt_in: true }]])
  })

  it("deletes a profile only for the signed-in person's own account", async () => {
    const someoneElse = await factories.user().save()
    await upsert(true)
    await upsert(false)
    expect(calls.delete).to.deep.equal([])
    await upsert(true)
    await upsert(false, { signedInAs: someoneElse })
    expect(calls.delete).to.deep.equal([])
  })

  it('does nothing in Mixpanel when it is disabled', async () => {
    mixpanel.disabled = true
    await upsert(true, { signedInAs: user })
    await upsert(false, { signedInAs: user })
    expect(calls.delete).to.deep.equal([])
    expect(calls.set).to.deep.equal([])
  })

  it('gives the disabled Mixpanel stub a delete_user that does nothing', () => {
    mixpanel.people.delete_user = saved.deleteUser
    expect(typeof mixpanel.people.delete_user).to.equal('function')
    expect(() => mixpanel.people.delete_user('1')).not.to.throw()
  })
})
