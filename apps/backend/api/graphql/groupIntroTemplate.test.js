/* eslint-disable no-unused-expressions */
import { createRequestHandler } from './index'
import '../../test/setup'
import factories from '../../test/setup/factories'

describe('Group settings introTemplate', () => {
  let handler, steward, member, group

  const run = async (userId, document) => {
    const req = factories.mock.request()
    req.url = '/noo/graphql'
    req.method = 'POST'
    req.headers = { 'Content-Type': 'application/json' }
    req.session = { userId, destroy: () => {} }
    const { executionResult } = await handler.inject({ document, serverContext: { req, res: factories.mock.response() } })
    expect(executionResult.errors).to.be.undefined
    return executionResult.data
  }

  before(async () => {
    handler = createRequestHandler()
    steward = await factories.user().save()
    member = await factories.user().save()
    group = await factories.group({ settings: { show_welcome_page: true } }).save()
    await steward.joinGroup(group, { assignAdministrator: true })
    await member.joinGroup(group)
  })

  it('lets stewards save the Introduction template and members read it, keeping other settings', async () => {
    await run(steward.id, `mutation {
      updateGroupSettings(id: "${group.id}", changes: { settings: { introTemplate: "Hi! Where do you grow food?" } }) { id }
    }`)

    const data = await run(member.id, `{ group(id: "${group.id}") { settings { introTemplate showWelcomePage } } }`)
    expect(data.group.settings.introTemplate).to.equal('Hi! Where do you grow food?')
    expect(data.group.settings.showWelcomePage).to.equal(true)
  })
})
