import orm from 'store/models'
import * as store from './NotificationsList.store'
import { modalScreenName } from 'hooks/useIsModalScreen'

describe('action creators', () => {
  it('matches the last snapshot from markActivityRead', () => {
    expect(store.markActivityRead('1')).toMatchSnapshot()
  })

  it('matches the last snapshot from markAllActivitiesRead', () => {
    expect(store.markAllActivitiesRead()).toMatchSnapshot()
  })

  it('matches the last snapshot from updateNewNotificationCount', () => {
    expect(store.updateNewNotificationCount()).toMatchSnapshot()
  })
})

describe('truncateHTML', () => {
  it('removes tags', () => {
    const markup = '<p>Paragraph, with <em>emphasised</em> and <strong>strong</strong> text.'
    const expected = 'Paragraph, with emphasised and strong text.'
    const actual = store.truncateHTML(markup)
    expect(actual).toBe(expected)
  })

  it('removes unmatched tags', () => {
    const markup = '<p>Paragraph, without closing tag.'
    const expected = 'Paragraph, without closing tag.'
    const actual = store.truncateHTML(markup)
    expect(actual).toBe(expected)
  })

  it('decodes HTML entities', () => {
    const markup = '&gt;&amp;&quot;'
    const expected = '>&\"'
    const actual = store.truncateHTML(markup)
    expect(actual).toBe(expected)
  })

  it('trucates to NOTIFICATION_TEXT_MAX', () => {
    const markup = 'a '.repeat(store.NOTIFICATION_TEXT_MAX + 1)
    const expected = 'a '.repeat(store.NOTIFICATION_TEXT_MAX / 2) + '…'
    const actual = store.truncateHTML(markup)
    expect(actual).toBe(expected)
  })
})

describe('selectors/refiners', () => {
  const navigation = {}
  let session = null

  beforeEach(() => {
    navigation.navigate = jest.fn()
    session = orm.session(orm.getEmptyState())
    session.Activity.create({
      actor: '1',
      action: 'commentMention',
      comment: '1',
      group: null,
      createdAt: 'Wed Oct 04 2017 00:06:56 GMT+1300 (NZDT)',
      id: '1',
      meta: { reasons: [] },
      post: '333',
      unread: false
    })
    session.Activity.create({
      action: 'tag',
      id: '2',
      unread: true
    })
    session.Comment.create({
      id: '1',
      text: '<a href="#" data-entity-type="mention" data-user-id="86895">Rich Churcher</a>'
    })
    session.Group.create({ id: '222', name: 'Aardvarks Alert' })
    session.Notification.create({ id: '1', activity: '1' })
    session.Notification.create({ id: '2', activity: '2' })
    session.Person.create({
      id: '1',
      avatarUrl: 'https://wombat.com',
      name: 'Wombat McAardvark'
    })
    session.Post.create({
      id: '333',
      title: 'This post should have a really long title. It should not even come close to fitting on a notification header. It should be truncated.',
      details: 'So detailed.'
    })
  })

  describe('refineActivity', () => {
    it('matches the previous ACTION_COMMENT snapshot', () => {
      session.Activity.withId('1').update({ action: 'newComment' })
      const notification = session.Notification.withId('1')
      const actual = store.refineActivity(notification.activity, navigation)
      expect(actual).toMatchSnapshot()
    })

    it('navigates to PostDetails for ACTION_COMMENT', () => {
      session.Activity.withId('1').update({ action: 'newComment' })
      const notification = session.Notification.withId('1')
      const actual = store.refineActivity(notification.activity, navigation)
      actual.onPress()
      expect(navigation.navigate).toHaveBeenCalledWith(modalScreenName('Post Details'), { id: '333' })
    })

    it('matches the previous ACTION_COMMENT_MENTION snapshot', () => {
      const notification = session.Notification.withId('1')
      const actual = store.refineActivity(notification.activity, navigation)
      expect(actual).toMatchSnapshot()
    })

    it('navigates to PostDetails for ACTION_COMMENT_MENTION', () => {
      const notification = session.Notification.withId('1')
      const actual = store.refineActivity(notification.activity, navigation)
      actual.onPress()
      expect(navigation.navigate).toHaveBeenCalledWith(modalScreenName('Post Details'), { id: '333' })
    })

    it('matches the previous ACTION_MENTION snapshot', () => {
      session.Activity.withId('1').update({ action: 'mention' })
      const notification = session.Notification.withId('1')
      const actual = store.refineActivity(notification.activity, navigation)
      expect(actual).toMatchSnapshot()
    })

    it('navigates to PostDetails for ACTION_MENTION', () => {
      session.Activity.withId('1').update({ action: 'mention' })
      const notification = session.Notification.withId('1')
      const actual = store.refineActivity(notification.activity, navigation)
      actual.onPress()
      expect(navigation.navigate).toHaveBeenCalledWith(modalScreenName('Post Details'), { id: '333' })
    })

    it('matches the previous ACTION_TAG snapshot', () => {
      session.Activity.withId('1').update({ action: 'tag', meta: { reasons: ['tag: aardvark'] } })
      const notification = session.Notification.withId('1')
      const actual = store.refineActivity(notification.activity, navigation)
      expect(actual).toMatchSnapshot()
    })

    it('navigates to Post Detail for ACTION_TAG', () => {
      session.Activity.withId('1').update({ action: 'tag', meta: { reasons: ['tag: aardvark'] } })
      const notification = session.Notification.withId('1')
      const actual = store.refineActivity(notification.activity, navigation)
      actual.onPress()
      expect(navigation.navigate).toHaveBeenCalledWith('Chat', { postId: '333', topicName: 'aardvark' })
    })

    it('matches the previous ACTION_JOIN_REQUEST snapshot', () => {
      session.Activity.withId('1').update({ action: 'joinRequest', group: '222' })
      const notification = session.Notification.withId('1')
      const actual = store.refineActivity(notification.activity, navigation)
      expect(actual).toMatchSnapshot()
    })

    it('navigates to Settings for ACTION_JOIN_REQUEST', () => {
      session.Activity.withId('1').update({ action: 'joinRequest', group: '222' })
      const notification = session.Notification.withId('1')
      const actual = store.refineActivity(notification.activity, navigation)
      actual.onPress()
      expect(navigation.navigate).toHaveBeenCalledWith(
        'Group Settings',
        {
          screen: 'Join Requests',
          params: { groupId: '222', groupSlug: undefined }
        }
      )
    })

    it('matches the previous ACTION_APPROVED_JOIN_REQUEST snapshot', () => {
      session.Activity.withId('1').update({ action: 'approvedJoinRequest', group: '222' })
      const notification = session.Notification.withId('1')
      const actual = store.refineActivity(notification.activity, navigation)
      expect(actual).toMatchSnapshot()
    })

    it('navigates to Stream (group) for ACTION_APPROVED_JOIN_REQUEST', () => {
      session.Activity.withId('1').update({ action: 'approvedJoinRequest', group: '222' })
      const notification = session.Notification.withId('1')
      const actual = store.refineActivity(notification.activity, navigation)
      actual.onPress()
      expect(navigation.navigate).toHaveBeenCalledWith('Stream', { groupId: '222' })
    })

    it('matches the previous ACTION_ANNOUNCEMENT snapshot', () => {
      session.Activity.withId('1').update({ action: 'announcement' })
      const notification = session.Notification.withId('1')
      const actual = store.refineActivity(notification.activity, navigation)
      expect(actual).toMatchSnapshot()
    })

    it('navigates to PostDetails for ACTION_ANNOUNCEMENT', () => {
      session.Activity.withId('1').update({ action: 'announcement' })
      const notification = session.Notification.withId('1')
      const actual = store.refineActivity(notification.activity, navigation)
      actual.onPress()
      expect(navigation.navigate).toHaveBeenCalledWith(modalScreenName('Post Details'), { id: '333' })
    })
  })

  describe('refineNotification', () => {
    it('sets avatarSeparator between read and unread', () => {
      const notifications = session.Notification.all().toModelArray()
      const actual = store.refineNotification(navigation)(notifications[0], 0, notifications)
      expect(actual.avatarSeparator).toBe(true)
    })

    it('does not set avatarSeparator between read and read', () => {
      session.Activity.all().update({ unread: false })
      const notifications = session.Notification.all().toModelArray()
      const actual = store.refineNotification(navigation)(notifications[0], 0, notifications)
      expect(actual.avatarSeparator).toBe(false)
    })

    it('does not set avatarSeparator between unread and unread', () => {
      session.Activity.all().update({ unread: true })
      const notifications = session.Notification.all().toModelArray()
      const actual = store.refineNotification(navigation)(notifications[0], 0, notifications)
      expect(actual.avatarSeparator).toBe(false)
    })

    it('matches the last snapshot', () => {
      const notifications = session.Notification.all().toModelArray()
      const actual = store.refineNotification(navigation)(notifications[0], 0, notifications)
      expect(actual.avatarSeparator).toMatchSnapshot()
    })
  })
  describe('reasonInWhitelist', () => {
    it('returns expected values', () => {
      const { reasonInWhitelist } = store
      const whitelist = ['announcement', 'mention']
      const validReason = 'announcement'
      const invalidReason = 'invalidReason'
      const formatedReason = 'mention: 2'
      expect(reasonInWhitelist(validReason, whitelist)).toBeTruthy()
      expect(reasonInWhitelist(invalidReason, whitelist)).toBeFalsy()
      expect(reasonInWhitelist(formatedReason, whitelist)).toBeTruthy()
    })
  })
})
