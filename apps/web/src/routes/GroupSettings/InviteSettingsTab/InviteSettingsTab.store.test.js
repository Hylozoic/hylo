import {
  ormSessionReducer,
  CREATE_INVITATIONS,
  RESEND_INVITATION_PENDING,
  EXPIRE_INVITATION_PENDING,
  REINVITE_ALL_PENDING,
  allowGroupInvites,
  fetchPendingInvitations
} from './InviteSettingsTab.store'
import orm from 'store/models'

describe('InviteSettingsTab.store.ormSessionReducer', () => {
  let session
  beforeEach(() => {
    session = orm.session(orm.getEmptyState())
  })

  it('responds to CREATE_INVITATIONS', () => {
    session.Group.create({ id: '5' })

    const action = {
      type: CREATE_INVITATIONS,
      payload: {
        data: {
          createInvitation: {
            invitations: [
              { id: '15', email: 'foo5@bar.com' },
              { id: '16', email: 'foo6@bar.com' },
              { id: '17', email: 'foo7@bar.com' }
            ]
          }
        }
      },
      meta: { groupId: '5' }
    }

    ormSessionReducer(session, action)
    const now = new Date().getTime()
    const invitations = session.Invitation.all().toRefArray()
    expect(invitations).toEqual([
      expect.objectContaining({ email: 'foo5@bar.com', group: '5' }),
      expect.objectContaining({ email: 'foo6@bar.com', group: '5' }),
      expect.objectContaining({ email: 'foo7@bar.com', group: '5' })
    ])
    invitations.forEach(i => {
      const createdAt = new Date(i.createdAt).getTime()
      expect(now - createdAt).toBeLessThan(1000)
    })
  })

  it('does not store CREATE_INVITATIONS results without an id', () => {
    session.Group.create({ id: '5' })

    const action = {
      type: CREATE_INVITATIONS,
      payload: {
        data: {
          createInvitation: {
            invitations: [
              { id: null, email: 'sent@bar.com', status: 'sent' },
              { id: null, email: 'skipped@bar.com', status: 'sent' },
              { id: null, email: 'bad', error: 'invalid' },
              { id: '18', email: 'steward@bar.com' }
            ]
          }
        }
      },
      meta: { groupId: '5' }
    }

    ormSessionReducer(session, action)
    expect(session.Invitation.all().toRefArray().map(i => i.email)).toEqual(['steward@bar.com'])
  })

  it('fetches the invite allowance along with pending invitations', () => {
    expect(fetchPendingInvitations('5').graphql.query).toMatch(/myInviteAllowance/)
  })

  it('fetches who sent each pending invitation and how', () => {
    const { query } = fetchPendingInvitations('5').graphql
    expect(query).toMatch(/inviterAccess/)
    expect(query).toMatch(/creator\s*{\s*id\s+name\s*}/)
  })

  it('responds to RESEND_INVITATION_PENDING', () => {
    session.Invitation.create({ id: '4' })
    const action = {
      type: RESEND_INVITATION_PENDING,
      meta: { invitationToken: '4' }
    }
    ormSessionReducer(session, action)
    expect(session.Invitation.withId('4').resent).toBeTruthy()
  })

  it('responds to EXPIRE_INVITATION_PENDING', () => {
    session.Invitation.create({ id: '3' })
    const action = {
      type: EXPIRE_INVITATION_PENDING,
      meta: { invitationToken: '3' }
    }
    ormSessionReducer(session, action)
    expect(session.Invitation.idExists('3')).toBeFalsy()
  })

  it('responds to REINVITE_ALL_PENDING', () => {
    session.Group.create({ id: '1' })
    session.Invitation.create({ id: '2', group: '1' })
    session.Invitation.create({ id: '3', group: '1' })
    session.Invitation.create({ id: '4', group: '1' })
    session.Invitation.create({ id: '5' })
    const action = {
      type: REINVITE_ALL_PENDING,
      meta: { groupId: '1' }
    }
    ormSessionReducer(session, action)
    expect(
      session.Invitation.filter(i => i.group === '1')
        .toRefArray().map(i => i.resent)
    ).toEqual([true, true, true])
    expect(session.Invitation.withId('5').resent).toBeFalsy()
  })

  it('leaves invitations sent by members alone on REINVITE_ALL_PENDING', () => {
    session.Group.create({ id: '1' })
    session.Invitation.create({ id: '2', group: '1', inviterAccess: 'full' })
    session.Invitation.create({ id: '3', group: '1', inviterAccess: 'limited' })
    ormSessionReducer(session, { type: REINVITE_ALL_PENDING, meta: { groupId: '1' } })
    expect(session.Invitation.withId('2').resent).toBe(true)
    expect(session.Invitation.withId('3').resent).toBeFalsy()
  })

  it('matches the last snapshot for allowGroupInvites', () => {
    expect(allowGroupInvites('1', false)).toMatchSnapshot()
  })
})
