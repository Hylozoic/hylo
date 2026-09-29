import fs from 'fs'
import path from 'path'
import i18next from 'i18next'
import {
  ACTION_EVENT_RSVP,
  ACTION_REACTION,
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
