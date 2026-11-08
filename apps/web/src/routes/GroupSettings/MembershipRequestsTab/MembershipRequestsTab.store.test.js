import { acceptJoinRequest, declineJoinRequest } from './MembershipRequestsTab.store'

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-01-02T12:00:00.000Z').getTime())
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('acceptJoinRequest', () => {
  it('tracks Join Request Approved with how long the request waited', () => {
    const action = acceptJoinRequest('10', '1', '2026-01-01T00:00:00.000Z')

    expect(action.meta.analytics).toEqual({
      eventName: 'Join Request Approved',
      groupId: '1',
      ageHours: 36
    })
  })

  it('leaves ageHours out when the request date is unknown', () => {
    const action = acceptJoinRequest('10', '1')

    expect(action.meta.analytics.ageHours).toBeUndefined()
  })
})

describe('declineJoinRequest', () => {
  it('tracks Join Request Declined with how long the request waited', () => {
    const action = declineJoinRequest('10', '1', '2026-01-02T11:30:00.000Z')

    expect(action.meta.analytics).toEqual({
      eventName: 'Join Request Declined',
      groupId: '1',
      ageHours: 0.5
    })
  })
})
