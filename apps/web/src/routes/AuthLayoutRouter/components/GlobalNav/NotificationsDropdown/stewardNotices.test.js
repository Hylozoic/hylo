import {
  bodyForNotification,
  imageForNotification,
  titleForNotification,
  urlForNotification
} from '@hylo/presenters/NotificationPresenter'
import en from '../../../../../../public/locales/en.json'

// Looks keys up in the English locale and fills in {{values}}, including _one/_other plurals
function t (key, values = {}) {
  const pluralKey = values.count !== undefined ? `${key}_${values.count === 1 ? 'one' : 'other'}` : null
  const template = (pluralKey && en[pluralKey]) || en[key]
  if (template === undefined) throw new Error(`Missing English string: ${pluralKey || key}`)
  return template.replace(/{{(\w+)}}/g, (_, name) => values[name])
}

const group = { id: '1', name: 'Seed Library', slug: 'seed-library', avatarUrl: 'group.png' }
const actor = { id: '7', name: 'Rey Requester', avatarUrl: 'rey.png' }

function notification (action, extra = {}) {
  return {
    id: '100',
    activity: { action, actor, group, meta: { reasons: [action] }, ...extra }
  }
}

describe('notices to someone who asked to join (D14)', () => {
  it('acknowledges the request and links to the group\'s About page', () => {
    const n = notification('acknowledgedJoinRequest')
    expect(titleForNotification(n, t)).toEqual('Request sent to <strong>Seed Library</strong>')
    expect(bodyForNotification(n, t)).toEqual("Its stewards review each request. We'll let you know when they answer.")
    expect(urlForNotification(n)).toEqual('/groups/seed-library/about')
    expect(imageForNotification(n)).toEqual('group.png')
  })

  it('links a request to a space to the space\'s About page', () => {
    const space = { id: '2', name: 'Garden', slug: 'seed-library-garden', parentGroup: { id: '1', slug: 'seed-library' } }
    const n = notification('acknowledgedJoinRequest', { group: space })
    expect(urlForNotification(n)).toEqual('/groups/seed-library/spaces/garden/about')
  })

  it('declines neutrally and points to the Group Explorer', () => {
    const n = notification('declinedJoinRequest')
    expect(titleForNotification(n, t)).toEqual('About your request to join <strong>Seed Library</strong>')
    expect(bodyForNotification(n, t)).toEqual("Your request wasn't approved this time. There are other groups you can join.")
    expect(bodyForNotification(n, t)).not.toContain(actor.name)
    expect(urlForNotification(n)).toEqual('/public/groups')
  })

  it('says when a request has had no answer for two weeks', () => {
    const n = notification('unansweredJoinRequest')
    expect(titleForNotification(n, t)).toEqual('No answer yet from <strong>Seed Library</strong>')
    expect(bodyForNotification(n, t)).toContain('two weeks')
    expect(urlForNotification(n)).toEqual('/public/groups')
  })
})
