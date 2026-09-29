/* eslint-disable no-unused-expressions */
// Which signed-in API requests update users.last_active_at, which the quieter delivery
// for members who are away reads (D9)
import '../../../test/setup'
import factories from '../../../test/setup/factories'
import { FIRST_PARTY_CLIENT_IDS, countsAsActivity, recordActivity } from '../../../api/graphql'
import { NATIVE_CLIENT_ID } from '../../../api/services/OIDCTokens'

describe('last active time', () => {
  let user

  const longAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

  beforeEach(async () => {
    user = await factories.user({ last_active_at: longAgo }).save()
  })

  async function lastActiveAfterRequest (apiClient) {
    const req = { session: { userId: user.id } }
    if (apiClient) req.api_client = apiClient
    await recordActivity(req)
    await user.refresh()
    return new Date(user.get('last_active_at'))
  }

  it('counts the mobile app, which is signed in with an access token', async () => {
    expect(FIRST_PARTY_CLIENT_IDS).to.include(NATIVE_CLIENT_ID)
    expect(await lastActiveAfterRequest({ id: NATIVE_CLIENT_ID, name: 'Hylo mobile' })).to.be.above(new Date(Date.now() - 60000))
  })

  it('counts a request signed in with a cookie', async () => {
    expect(await lastActiveAfterRequest(null)).to.be.above(new Date(Date.now() - 60000))
  })

  it('does not count requests from other OAuth clients', async () => {
    expect((await lastActiveAfterRequest({ id: 'some-other-app', name: 'Other app' })).getTime()).to.equal(longAgo.getTime())
  })

  it('does not count a request with no one signed in', () => {
    expect(countsAsActivity({ session: {} })).to.be.false
    expect(countsAsActivity({ session: { userId: user.id } })).to.be.true
  })
})
