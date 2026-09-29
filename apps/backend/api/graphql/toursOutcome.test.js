/* eslint-disable no-unused-expressions */
import { createRequestHandler } from './index'
import '../../test/setup'
import factories from '../../test/setup/factories'

describe('UserSettings toursOutcome', () => {
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
    user = await factories.user({ settings: { tours_seen: ['map'] } }).save()
  })

  it('stores how each tour ended, one tour at a time, and reads it back', async () => {
    const first = await run(`mutation {
      updateMe(changes: { settings: { toursOutcome: { post_editor: "completed" }, toursSeen: ["map", "post-editor"] } }) {
        settings { toursSeen toursOutcome }
      }
    }`)
    expect(first.updateMe.settings.toursOutcome).to.deep.equal({ post_editor: 'completed' })
    expect(first.updateMe.settings.toursSeen).to.deep.equal(['map', 'post-editor'])

    await run(`mutation {
      updateMe(changes: { settings: { toursOutcome: { stream_controls: "dismissed" } } }) { id }
    }`)

    const read = await run('{ me { settings { toursSeen toursOutcome } } }')
    expect(read.me.settings.toursOutcome).to.deep.equal({ post_editor: 'completed', stream_controls: 'dismissed' })
    expect(read.me.settings.toursSeen).to.deep.equal(['map', 'post-editor'])
  })

  it('replaces the outcome of a tour taken again', async () => {
    await run(`mutation {
      updateMe(changes: { settings: { toursOutcome: { stream_controls: "completed" } } }) { id }
    }`)
    const read = await run('{ me { settings { toursOutcome } } }')
    expect(read.me.settings.toursOutcome).to.deep.equal({ post_editor: 'completed', stream_controls: 'completed' })
  })
})
