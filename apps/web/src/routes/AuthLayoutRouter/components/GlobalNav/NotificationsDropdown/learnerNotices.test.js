import {
  bodyForNotification,
  titleForNotification,
  urlForNotification
} from '@hylo/presenters/NotificationPresenter'

// Stand-in for i18next: fills in {{values}} so the text can be checked
const t = (text, values = {}) => text.replace(/{{(\w+)}}/g, (_, key) => values[key])

const notification = (action, activity = {}) => ({
  id: '1',
  activity: {
    action,
    actor: { id: '9', name: 'Author', avatarUrl: null },
    group: { id: '2', slug: 'garden', name: 'Garden Club' },
    meta: { reasons: [action] },
    ...activity
  }
})

describe('notices from open requests and tracks', () => {
  it('asks the author about a request nobody has replied to, opening the post with the question', () => {
    const n = notification('openRequestNudge', { post: { id: '5', title: 'Need a ladder', type: 'request', groups: [] } })
    expect(titleForNotification(n, t)).toBe('Nobody has replied to your request yet')
    expect(bodyForNotification(n, t)).toBe('"<strong>Need a ladder</strong>": still needed, or met?')
    expect(urlForNotification(n)).toMatch(/\/post\/5\?nudge=open-request$/)
  })

  it('says "offer" for an offer', () => {
    const n = notification('openRequestNudge', { post: { id: '5', title: 'Spare seedlings', type: 'offer', groups: [] } })
    expect(titleForNotification(n, t)).toBe('Nobody has replied to your offer yet')
    expect(bodyForNotification(n, t)).toBe('"<strong>Spare seedlings</strong>": still available, or taken?')
  })

  it('congratulates the learner and links to the track\'s actions', () => {
    const n = notification('trackCompletedLearner', { track: { id: '7', space: { name: 'Composting basics', slug: 'compost' } } })
    expect(titleForNotification(n, t)).toBe('You completed <strong>Composting basics</strong>!')
    expect(bodyForNotification(n, t)).toBe('Congratulations! See what to explore next.')
    expect(urlForNotification(n)).toMatch(/^\/groups\/garden\/spaces\/[^/]+\/track-actions$/)
  })

  it('reminds an idle learner of their next action and links to it', () => {
    const n = notification('trackReminder', {
      track: { id: '7', space: { name: 'Composting basics', slug: 'compost' } },
      post: { id: '42', title: 'Build a bin', type: 'action', groups: [] }
    })
    expect(titleForNotification(n, t)).toBe('Pick up where you left off in <strong>Composting basics</strong>')
    expect(bodyForNotification(n, t)).toBe('Next: Build a bin')
    expect(urlForNotification(n)).toMatch(/^\/groups\/garden\/spaces\/[^/]+\/track-actions\/post\/42$/)
  })

  it('falls back to My Tracks when the track\'s space is unknown', () => {
    const n = notification('trackCompletedLearner', { track: { id: '7', space: { name: 'Composting basics' } } })
    expect(urlForNotification(n)).toBe('/my/tracks')
  })
})
