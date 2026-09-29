import {
  needsFullTrack,
  nextIncompleteAction,
  progressFromCounts,
  progressFromSettings,
  suggestedTracks,
  trackProgress,
  trackProgressBySpaceId,
  trackShareUrl
} from './trackProgress'

describe('trackProgress', () => {
  it('counts completed actions out of all of them', () => {
    expect(trackProgress([{ id: 1, completedAt: '2026-01-01' }, { id: 2 }, { id: 3, completedAt: '2026-01-02' }]))
      .toEqual({ completed: 2, total: 3, percent: 67, isComplete: false })
  })

  it('is complete only when every action is done', () => {
    expect(trackProgress([{ id: 1, completedAt: 'x' }]).isComplete).toBe(true)
    expect(trackProgress([]).isComplete).toBe(false)
    expect(trackProgress(undefined)).toEqual({ completed: 0, total: 0, percent: 0, isComplete: false })
  })
})

describe('progressFromCounts', () => {
  it('never shows more completed than there are actions, or less than none', () => {
    expect(progressFromCounts(5, 3)).toEqual({ completed: 3, total: 3, percent: 100, isComplete: true })
    expect(progressFromCounts(-1, 4)).toEqual({ completed: 0, total: 4, percent: 0, isComplete: false })
    expect(progressFromCounts(1, 0)).toEqual({ completed: 0, total: 0, percent: 0, isComplete: false })
  })
})

describe('progressFromSettings', () => {
  it('reads the count recorded on the enrollment', () => {
    expect(progressFromSettings({ actionsCompleted: 2 }, 5, false)).toMatchObject({ completed: 2, total: 5 })
    expect(progressFromSettings(null, 5, false)).toMatchObject({ completed: 0, total: 5 })
  })

  it('shows a completed track as all done', () => {
    expect(progressFromSettings({ actionsCompleted: 3 }, 5, true)).toMatchObject({ completed: 5, total: 5, isComplete: true })
    expect(progressFromSettings({ completedAt: '2026-01-01' }, 4, false)).toMatchObject({ completed: 4, total: 4 })
  })
})

describe('needsFullTrack', () => {
  it('fetches a track that is not stored yet', () => {
    expect(needsFullTrack(null)).toBe(true)
    expect(needsFullTrack(undefined)).toBe(true)
  })

  it('fetches a track a notification stored with only a few fields', () => {
    expect(needsFullTrack({ id: '3', actionDescriptor: 'Action' })).toBe(true)
  })

  it('is done once the full track, with the viewer\'s enrollment, is stored', () => {
    expect(needsFullTrack({ id: '3', isEnrolled: true })).toBe(false)
    expect(needsFullTrack({ id: '3', isEnrolled: false })).toBe(false)
    expect(needsFullTrack({ id: '3', isEnrolled: null })).toBe(false)
  })
})

describe('nextIncompleteAction', () => {
  const actions = [
    { id: '1', title: 'Watch', completedAt: 'x' },
    { id: '2', title: 'Read' },
    { id: '3', title: 'Write', completedAt: 'x' },
    { id: '4', title: 'Share' }
  ]

  it('picks the first unfinished action after the current one', () => {
    expect(nextIncompleteAction(actions, '2').title).toBe('Share')
    expect(nextIncompleteAction(actions, '1').title).toBe('Read')
  })

  it('wraps around to an earlier unfinished action', () => {
    expect(nextIncompleteAction(actions, '4').title).toBe('Read')
  })

  it('returns null when everything else is done', () => {
    expect(nextIncompleteAction([{ id: '1' }, { id: '2', completedAt: 'x' }], '1')).toBe(null)
    expect(nextIncompleteAction([], '1')).toBe(null)
  })

  it('starts from the top when the current action is not in the list', () => {
    expect(nextIncompleteAction(actions, '99').title).toBe('Read')
  })
})

describe('suggestedTracks', () => {
  const space = (id, name, track, extra = {}) => ({ id, name, slug: `s${id}`, status: 'published', active: true, track: { id: `t${id}`, numActions: 3, ...track }, ...extra })

  it('suggests other published tracks not yet completed, enrolled ones first, at most three', () => {
    const spaces = [
      space('1', 'Current', {}),
      space('2', 'Beta', {}),
      space('3', 'Alpha', {}),
      space('4', 'Done', { didComplete: true }),
      space('5', 'Draft', {}, { status: 'draft' }),
      space('6', 'Enrolled', { isEnrolled: true }),
      space('7', 'Empty', { numActions: 0 }),
      space('8', 'Gamma', {}),
      { id: '9', name: 'Not a track', slug: 's9', status: 'published' }
    ]
    expect(suggestedTracks(spaces, '1').map(s => s.name)).toEqual(['Enrolled', 'Alpha', 'Beta'])
  })

  it('links a shared track to its About page', () => {
    expect(trackShareUrl('garden', { slug: 'garden-onboarding' })).toMatch(/\/groups\/garden\/spaces\/.*\/about$/)
    expect(trackShareUrl(null, { slug: 'x' })).toBe(null)
  })
})

describe('trackProgressBySpaceId', () => {
  it('maps each track space to the learner\'s progress', () => {
    const data = {
      me: {
        memberships: [
          { group: { id: '10', track: { id: '1', numActions: 4, didComplete: false, userSettings: { actionsCompleted: 1 } } } },
          { group: { id: '11', track: { id: '2', numActions: 2, didComplete: true, userSettings: {} } } },
          { group: { id: '12', track: null } }
        ]
      }
    }
    expect(trackProgressBySpaceId(data)).toEqual({
      10: { completed: 1, total: 4, percent: 25, isComplete: false },
      11: { completed: 2, total: 2, percent: 100, isComplete: true }
    })
  })
})
