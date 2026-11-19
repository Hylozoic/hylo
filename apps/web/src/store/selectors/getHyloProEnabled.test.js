import orm from '../models'
import getHyloProEnabled from './getHyloProEnabled'

describe('getHyloProEnabled', () => {
  let savedFlag

  beforeEach(() => {
    savedFlag = process.env.VITE_FEATURE_FLAG_HYLO_PRO
    delete process.env.VITE_FEATURE_FLAG_HYLO_PRO
  })

  afterEach(() => {
    if (savedFlag === undefined) {
      delete process.env.VITE_FEATURE_FLAG_HYLO_PRO
    } else {
      process.env.VITE_FEATURE_FLAG_HYLO_PRO = savedFlag
    }
  })

  function stateWithMe (me) {
    const session = orm.session(orm.getEmptyState())
    if (me) session.Me.create({ id: '1', ...me })
    return { orm: session.state }
  }

  it('follows the flag for people who are not Hylo staff', () => {
    process.env.VITE_FEATURE_FLAG_HYLO_PRO = 'on'
    expect(getHyloProEnabled(stateWithMe({ isAdmin: false }))).toBe(true)
    process.env.VITE_FEATURE_FLAG_HYLO_PRO = 'off'
    expect(getHyloProEnabled(stateWithMe({ isAdmin: false }))).toBe(false)
    expect(getHyloProEnabled(stateWithMe({}))).toBe(false)
    expect(getHyloProEnabled(stateWithMe(null))).toBe(false)
  })

  it('is on for Hylo staff even when the flag is off', () => {
    process.env.VITE_FEATURE_FLAG_HYLO_PRO = 'off'
    expect(getHyloProEnabled(stateWithMe({ isAdmin: true }))).toBe(true)
  })
})
