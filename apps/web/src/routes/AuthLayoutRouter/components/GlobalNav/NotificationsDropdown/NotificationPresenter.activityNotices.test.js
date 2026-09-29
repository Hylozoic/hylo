import fs from 'fs'
import path from 'path'
import i18next from 'i18next'
import {
  ACTION_EVENT_NUDGE,
  ACTION_FUNDING_ROUND_PHASE_TRANSITION,
  ACTION_EVENT_RSVP,
  ACTION_PROJECT_JOINED,
  ACTION_PROPOSAL_CLOSED,
  ACTION_PROPOSAL_CLOSING_SOON,
  ACTION_PROPOSAL_OUTCOME,
  ACTION_PROPOSAL_VOTE,
  ACTION_REACTION,
  ACTION_REQUEST_HELPED,
  ACTION_REQUEST_MET,
  ACTION_VOTE_RESET,
  bodyForNotification,
  titleForNotification,
  urlForNotification
} from '@hylo/presenters/NotificationPresenter'

const LOCALES_DIR = path.resolve(__dirname, '../../../../../../public/locales')
const readLocale = locale => JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, `${locale}.json`), 'utf8'))

// A real i18next instance with the shipped strings, so plural keys resolve as in the app
async function translator (lng) {
  const i18n = i18next.createInstance()
  await i18n.init({
    lng,
    resources: { [lng]: { translation: readLocale(lng) } },
    keySeparator: false,
    nsSeparator: false,
    interpolation: { escapeValue: false }
  })
  return i18n.t.bind(i18n)
}

const sam = { id: '5', name: 'Sam', avatarUrl: 'sam.png' }
const post = { id: '10', title: 'Seed swap on Saturday', type: 'discussion', groups: { toRefArray: () => [{ slug: 'garden' }] } }
const group = { id: '1', name: 'Garden', slug: 'garden' }

const notificationFor = (action, activity = {}) => ({
  id: '1',
  activity: { action, actor: sam, post, group, meta: { reasons: [action] }, ...activity }
})

describe('grouped social feedback notices', () => {
  let t
  beforeAll(async () => { t = await translator('en') })

  describe(ACTION_REACTION, () => {
    it('names one person', () => {
      const notification = notificationFor(ACTION_REACTION, { meta: { reasons: ['reaction'], actorCount: 1 } })
      expect(titleForNotification(notification, t)).toBe('<strong>Sam</strong> reacted to your post')
      expect(bodyForNotification(notification, t)).toBe('"<strong>Seed swap on Saturday</strong>"')
      expect(urlForNotification(notification)).toMatch(/\/post\/10$/)
    })

    it('counts the others in the group, singular and plural', () => {
      const two = notificationFor(ACTION_REACTION, { meta: { reasons: ['reaction'], actorCount: 2 } })
      const four = notificationFor(ACTION_REACTION, { meta: { reasons: ['reaction'], actorCount: 4 } })
      expect(titleForNotification(two, t)).toBe('<strong>Sam</strong> and 1 other reacted to your post')
      expect(titleForNotification(four, t)).toBe('<strong>Sam</strong> and 3 others reacted to your post')
    })

    it('talks about the comment, and links to it, for a reaction to a comment', () => {
      const notification = notificationFor(ACTION_REACTION, {
        comment: { id: '77', text: '<p>I can bring tomatoes</p>' },
        meta: { reasons: ['reaction'], actorCount: 3 }
      })
      expect(titleForNotification(notification, t)).toBe('<strong>Sam</strong> and 2 others reacted to your comment')
      expect(bodyForNotification(notification, t)).toBe('"<strong>I can bring tomatoes</strong>"')
      expect(urlForNotification(notification)).toMatch(/commentId=77/)
    })

    it('is translated in the other languages', async () => {
      const tFr = await translator('fr')
      const notification = notificationFor(ACTION_REACTION, { meta: { reasons: ['reaction'], actorCount: 4 } })
      expect(titleForNotification(notification, tFr)).toBe('<strong>Sam</strong> et 3 autres personnes ont réagi à votre publication')
    })
  })

  describe(ACTION_EVENT_RSVP, () => {
    it('says whether one person is going or interested', () => {
      const going = notificationFor(ACTION_EVENT_RSVP, { meta: { reasons: ['eventRsvp'], actorCount: 1, response: 'yes' } })
      const interested = notificationFor(ACTION_EVENT_RSVP, { meta: { reasons: ['eventRsvp'], actorCount: 1, response: 'interested' } })
      expect(titleForNotification(going, t)).toBe('<strong>Sam</strong> is going to your event')
      expect(titleForNotification(interested, t)).toBe('<strong>Sam</strong> is interested in your event')
      expect(bodyForNotification(going, t)).toBe('"<strong>Seed swap on Saturday</strong>"')
      expect(urlForNotification(going)).toMatch(/\/post\/10$/)
    })

    it('counts everyone who answered', () => {
      const notification = notificationFor(ACTION_EVENT_RSVP, { meta: { reasons: ['eventRsvp'], actorCount: 3, response: 'yes' } })
      expect(titleForNotification(notification, t)).toBe('<strong>Sam</strong> and 2 others responded to your event')
    })
  })
})

describe('proposal notices', () => {
  let t
  beforeAll(async () => { t = await translator('en') })

  it('groups votes for the author', () => {
    const one = notificationFor(ACTION_PROPOSAL_VOTE, { meta: { reasons: ['proposalVote'], actorCount: 1 } })
    const three = notificationFor(ACTION_PROPOSAL_VOTE, { meta: { reasons: ['proposalVote'], actorCount: 3 } })
    expect(titleForNotification(one, t)).toBe('<strong>Sam</strong> voted on your proposal')
    expect(titleForNotification(three, t)).toBe('<strong>Sam</strong> and 2 others voted on your proposal')
  })

  it('says voting closes soon', () => {
    const notification = notificationFor(ACTION_PROPOSAL_CLOSING_SOON, { meta: { reasons: ['proposalClosingSoon'] } })
    expect(titleForNotification(notification, t)).toBe('Voting closes soon on <strong>Seed swap on Saturday</strong>')
    expect(bodyForNotification(notification, t)).toBe("You haven't voted yet")
    expect(urlForNotification(notification)).toMatch(/\/post\/10$/)
  })

  it('gives voters the result and asks the author to record the outcome', () => {
    const voter = notificationFor(ACTION_PROPOSAL_CLOSED, { meta: { reasons: ['proposalClosed'], winningOption: '👍 Yes' } })
    const author = notificationFor(ACTION_PROPOSAL_CLOSED, { meta: { reasons: ['proposalClosed'], tie: true, forAuthor: true } })
    expect(titleForNotification(voter, t)).toBe('Voting closed on <strong>Seed swap on Saturday</strong>')
    expect(bodyForNotification(voter, t)).toBe('Result: <strong>👍 Yes</strong>.')
    expect(titleForNotification(author, t)).toBe('Voting closed on your proposal <strong>Seed swap on Saturday</strong>')
    expect(bodyForNotification(author, t)).toBe('The vote ended in a tie. Record the outcome for your voters.')
  })

  it('shares the recorded outcome', () => {
    const notification = notificationFor(ACTION_PROPOSAL_OUTCOME, { meta: { reasons: ['proposalOutcome'], outcome: 'Blue it is' } })
    expect(titleForNotification(notification, t)).toBe('<strong>Sam</strong> recorded the outcome of <strong>Seed swap on Saturday</strong>')
    expect(bodyForNotification(notification, t)).toBe('"<strong>Blue it is</strong>"')
  })

  it('has a title and body for a vote reset', () => {
    const notification = notificationFor(ACTION_VOTE_RESET, { meta: { reasons: ['voteReset'] } })
    expect(titleForNotification(notification, t)).toBe('<strong>Sam</strong> changed the options on <strong>Seed swap on Saturday</strong>')
    expect(bodyForNotification(notification, t)).toBe('Your vote was reset. You can vote again.')
  })
})

describe('event reminders', () => {
  it('nudges an invitee who has not answered', async () => {
    const t = await translator('en')
    const notification = notificationFor(ACTION_EVENT_NUDGE, { meta: { reasons: ['eventNudge'] } })
    expect(titleForNotification(notification, t)).toBe('Are you going to <strong>Seed swap on Saturday</strong>?')
    expect(bodyForNotification(notification, t)).toBe("It starts in about a day, and you haven't answered <strong>Sam</strong>'s invitation yet")
    expect(urlForNotification(notification)).toMatch(/\/post\/10$/)
  })
})

describe('project joins', () => {
  it('tells the creator who joined', async () => {
    const t = await translator('en')
    const notification = notificationFor(ACTION_PROJECT_JOINED, { post: { ...post, type: 'project' }, meta: { reasons: ['projectJoined'] } })
    expect(titleForNotification(notification, t)).toBe('<strong>Sam</strong> joined your project')
    expect(bodyForNotification(notification, t)).toBe('"<strong>Seed swap on Saturday</strong>"')
    expect(urlForNotification(notification)).toMatch(/\/post\/10$/)
  })
})

describe("'Who helped?' notices", () => {
  it('thanks a helper, including on older notices', async () => {
    const t = await translator('en')
    for (const action of [ACTION_REQUEST_HELPED, 'newContribution']) {
      const notification = notificationFor(action, { meta: { reasons: [action] } })
      expect(titleForNotification(notification, t)).toBe('<strong>Sam</strong> says you helped with their request')
      expect(bodyForNotification(notification, t)).toBe('"<strong>Seed swap on Saturday</strong>"')
      expect(urlForNotification(notification)).toMatch(/\/post\/10$/)
    }
  })

  it('tells followers a request was met', async () => {
    const t = await translator('en')
    const notification = notificationFor(ACTION_REQUEST_MET, { meta: { reasons: ['requestMet'] } })
    expect(titleForNotification(notification, t)).toBe('Request met: <strong>Seed swap on Saturday</strong>')
    expect(bodyForNotification(notification, t)).toBe('<strong>Sam</strong> marked it as met')
  })
})

describe('funding round results (D77)', () => {
  const completed = meta => notificationFor(ACTION_FUNDING_ROUND_PHASE_TRANSITION, {
    fundingRound: { id: '4', group: { name: 'Spring Round' } },
    meta: { reasons: ['fundingRoundPhaseTransition:completed'], phase: 'completed', ...meta }
  })

  it("tells a submitter their own submission's result", async () => {
    const t = await translator('en')
    const notification = completed({
      submissionResults: [{ postId: '8', title: 'Garden beds', tokens: 30, rank: 2 }],
      submissionCount: 5,
      tokenType: 'credits'
    })
    expect(bodyForNotification(notification, t)).toBe('Your submission "Garden beds" received 30 credits and ranked 2 of 5.')
  })

  it('says the stewards will follow up when results are hidden, and keeps the old text for everyone else', async () => {
    const t = await translator('en')
    expect(bodyForNotification(completed({ resultsHidden: true }), t)).toBe('Voting has closed. The stewards will follow up with the results.')
    expect(bodyForNotification(completed({}), t)).toBe('Voting has closed and the round has ended')
  })
})
