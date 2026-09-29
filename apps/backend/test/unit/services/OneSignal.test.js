import OneSignal from '../../../api/services/OneSignal'

describe('OneSignal.createNotificationObject', () => {
  const base = { readerId: '5', alert: 'Sam: Hello', path: '/groups/garden/chat', appId: 'app' }

  it('sets the heading, the tray group for iOS and Android, and the collapse id', () => {
    const notification = OneSignal.createNotificationObject({
      ...base,
      heading: 'Garden',
      groupKey: 'group-4',
      collapseKey: 'chat-9'
    })
    expect(notification.headings).to.deep.equal({ en: 'Garden' })
    expect(notification.contents).to.deep.equal({ en: 'Sam: Hello' })
    expect(notification.thread_id).to.equal('group-4')
    expect(notification.android_group).to.equal('group-4')
    expect(notification.summary_arg).to.equal('Garden')
    expect(notification.collapse_id).to.equal('chat-9')
  })

  it('leaves grouping out when it is not given, as before', () => {
    const notification = OneSignal.createNotificationObject(base)
    expect(notification.headings).to.equal(undefined)
    expect(notification.thread_id).to.equal(undefined)
    expect(notification.android_group).to.equal(undefined)
    expect(notification.collapse_id).to.equal(undefined)
    expect(notification.data).to.deep.equal({ path: '/groups/garden/chat' })
    expect(notification.app_url).to.equal('hyloapp://groups/garden/chat')
  })

  it('does not collapse a push that has a tray group but no collapse key', () => {
    const notification = OneSignal.createNotificationObject({ ...base, heading: 'Garden', groupKey: 'group-4' })
    expect(notification.thread_id).to.equal('group-4')
    expect(notification.collapse_id).to.equal(undefined)
  })

  it('needs a reader', () => {
    expect(() => OneSignal.createNotificationObject({ alert: 'hi' })).to.throw(/readerId/)
  })
})
