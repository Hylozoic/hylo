import '../../../test/setup'
import factories from '../../../test/setup/factories'
import { createRequestHandler } from '../../../api/graphql'
import findOrCreateThread from '../../../api/models/post/findOrCreateThread'

describe('MessageThread participants visibility', () => {
  let handler, userA, userB, userC, groupAB, groupAC, thread

  before(async () => {
    handler = createRequestHandler()

    userA = await factories.user().save()
    userB = await factories.user().save()
    userC = await factories.user().save()
    groupAB = await factories.group().save()
    groupAC = await factories.group().save()

    // A shares a group with B and a different group with C; B and C share nothing
    await userA.joinGroup(groupAB)
    await userB.joinGroup(groupAB)
    await userA.joinGroup(groupAC)
    await userC.joinGroup(groupAC)

    thread = await findOrCreateThread(userA.id, [userB.id, userC.id])
  })

  /**
   * Queries participants for a thread as the given viewer.
   */
  async function fetchParticipantsAs (viewer) {
    const req = factories.mock.request()
    req.url = '/noo/graphql'
    req.method = 'POST'
    req.headers = { 'Content-Type': 'application/json' }
    req.session = { userId: viewer.id, destroy: () => {} }
    req.user = viewer
    const res = factories.mock.response()

    const { executionResult } = await handler.inject({
      document: `{
        messageThread(id: "${thread.id}") {
          id
          participantsTotal
          participants {
            id
            name
          }
        }
      }`,
      serverContext: { req, res }
    })

    return executionResult
  }

  it('shows all participants to a member who does not share a group with another member', async () => {
    const asB = await fetchParticipantsAs(userB)
    expect(asB.errors).to.equal(undefined)
    const participantIdsB = asB.data.messageThread.participants.map(p => p.id)
    expect(participantIdsB).to.include.members([userA.id, userB.id, userC.id])
    expect(asB.data.messageThread.participantsTotal).to.equal(3)

    const asC = await fetchParticipantsAs(userC)
    expect(asC.errors).to.equal(undefined)
    const participantIdsC = asC.data.messageThread.participants.map(p => p.id)
    expect(participantIdsC).to.include.members([userA.id, userB.id, userC.id])
    expect(asC.data.messageThread.participantsTotal).to.equal(3)
  })

  describe('when a participant is blocked', () => {
    before(async () => {
      await BlockedUser.create(userB.id, userC.id)
    })

    it('hides the blocked participant', async () => {
      const asB = await fetchParticipantsAs(userB)
      expect(asB.errors).to.equal(undefined)
      const participantIds = asB.data.messageThread.participants.map(p => p.id)
      expect(participantIds).to.include.members([userA.id, userB.id])
      expect(participantIds).to.not.include(userC.id)
    })
  })
})
