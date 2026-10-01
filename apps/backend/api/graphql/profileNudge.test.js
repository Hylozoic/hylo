/* eslint-disable no-unused-expressions */
import { createRequestHandler } from './index'
import '../../test/setup'
import factories from '../../test/setup/factories'

describe('UserSettings profileNudge', () => {
  let handler, user

  const run = async (document) => {
    const req = factories.mock.request()
    req.url = '/noo/graphql'
    req.method = 'POST'
    req.headers = { 'Content-Type': 'application/json' }
    req.session = { userId: user.id, destroy: () => {} }
    const { executionResult } = await handler.inject({ document, serverContext: { req, res: factories.mock.response() } })
    expect(executionResult.errors).to.be.undefined
    return executionResult.data
  }

  before(async () => {
    handler = createRequestHandler()
    user = await factories.user({ settings: { signup_in_progress: true } }).save()
  })

  it('finishes signup and marks the profile nudge as pending in one change, then records the answer', async () => {
    const finished = await run(`mutation {
      updateMe(changes: { settings: { signupInProgress: false, profileNudge: "pending" } }) {
        settings { signupInProgress profileNudge }
      }
    }`)
    expect(finished.updateMe.settings).to.deep.equal({ signupInProgress: false, profileNudge: 'pending' })

    await run('mutation { updateMe(changes: { settings: { profileNudge: "dismissed" } }) { id } }')
    const read = await run('{ me { settings { signupInProgress profileNudge } } }')
    expect(read.me.settings).to.deep.equal({ signupInProgress: false, profileNudge: 'dismissed' })
  })
})
