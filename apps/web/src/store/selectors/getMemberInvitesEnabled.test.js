import orm from '../models'
import getMemberInvitesEnabled from './getMemberInvitesEnabled'

describe('getMemberInvitesEnabled', () => {
  let savedFlag

  beforeEach(() => {
    savedFlag = process.env.VITE_FEATURE_FLAG_MEMBER_INVITES
    delete process.env.VITE_FEATURE_FLAG_MEMBER_INVITES
  })

  afterEach(() => {
    if (savedFlag === undefined) {
      delete process.env.VITE_FEATURE_FLAG_MEMBER_INVITES
    } else {
      process.env.VITE_FEATURE_FLAG_MEMBER_INVITES = savedFlag
    }
  })

  function stateWithMe (me) {
    const session = orm.session(orm.getEmptyState())
    if (me) session.Me.create({ id: '1', ...me })
    return { orm: session.state }
  }

  it('follows the web flag while the server has not said', () => {
    expect(getMemberInvitesEnabled(stateWithMe({}))).toBe(true)
    expect(getMemberInvitesEnabled(stateWithMe(null))).toBe(true)
    process.env.VITE_FEATURE_FLAG_MEMBER_INVITES = 'off'
    expect(getMemberInvitesEnabled(stateWithMe({}))).toBe(false)
  })

  it('is off when the server reports member invitations unavailable, whatever the web flag', () => {
    process.env.VITE_FEATURE_FLAG_MEMBER_INVITES = 'on'
    expect(getMemberInvitesEnabled(stateWithMe({ memberInvitesEnabled: false }))).toBe(false)
    expect(getMemberInvitesEnabled(stateWithMe({ memberInvitesEnabled: true }))).toBe(true)
  })

  it('is off when the web flag is off, even if the server allows it', () => {
    process.env.VITE_FEATURE_FLAG_MEMBER_INVITES = 'off'
    expect(getMemberInvitesEnabled(stateWithMe({ memberInvitesEnabled: true }))).toBe(false)
  })
})
