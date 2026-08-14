import orm from 'store/models'
import {
  chatActivityBucketKey,
  confirmOptimisticChatInNotice,
  optimisticChatActivityNoticeId,
  prependCurrentHourNotices,
  reconcileChatActivityNoticesAfterFetch,
  replaceOptimisticChatActivityNotice,
  snapshotChatActivityNotices,
  upsertOptimisticChatActivityNotice
} from './chatActivityNotice'

describe('chatActivityBucketKey', () => {
  it('builds a UTC hour bucket key', () => {
    expect(chatActivityBucketKey(1234, new Date('2026-08-06T17:40:00.000Z'))).toEqual('1234:2026-08-06T17')
  })
})

describe('upsertOptimisticChatActivityNotice', () => {
  let session

  beforeEach(() => {
    session = orm.session(orm.getEmptyState())
    session.Group.create({ id: '10', slug: 'bar', name: 'Bar' })
  })

  it('creates an optimistic notice for the first chat in an hour', () => {
    const createdAt = '2026-08-14T04:10:00.000Z'
    const notice = upsertOptimisticChatActivityNotice(session, {
      groupId: '10',
      chat: { id: 'post_1', details: '<p>hi</p>', createdAt, creator: { id: '1', name: 'Tibet' } }
    })

    expect(notice.id).toEqual(optimisticChatActivityNoticeId('10', createdAt))
    expect(notice.noticePosts[0].details).toEqual('<p>hi</p>')
    expect(notice.noticePosts[0].creator.name).toEqual('Tibet')
    expect(notice.noticeData.postCount).toEqual(1)
    expect(notice.noticeData.bucketKey).toEqual(chatActivityBucketKey('10', createdAt))
  })

  it('prepends a later chat onto the same hour notice', () => {
    upsertOptimisticChatActivityNotice(session, {
      groupId: '10',
      chat: { id: 'post_1', details: '<p>first</p>', createdAt: '2026-08-14T04:10:00.000Z' }
    })
    const notice = upsertOptimisticChatActivityNotice(session, {
      groupId: '10',
      chat: { id: 'post_2', details: '<p>second</p>', createdAt: '2026-08-14T04:40:00.000Z' }
    })

    expect(session.Post.all().toModelArray().filter(p => p.type === 'chat_activity')).toHaveLength(1)
    expect(notice.noticePosts.map(p => p.id)).toEqual(['post_2', 'post_1'])
    expect(notice.noticeData.postCount).toEqual(2)
  })

  it('replaces localId with the saved chat id without double counting', () => {
    upsertOptimisticChatActivityNotice(session, {
      groupId: '10',
      chat: { id: 'post_1', details: '<p>hi</p>', createdAt: '2026-08-14T04:10:00.000Z' }
    })
    const notice = confirmOptimisticChatInNotice(session, {
      groupId: '10',
      localId: 'post_1',
      chat: { id: '99', details: '<p>hi</p>', createdAt: '2026-08-14T04:10:00.000Z' }
    })

    expect(notice.noticeData.postCount).toEqual(1)
    expect(notice.noticePosts.map(p => p.id)).toEqual(['99'])
    expect(notice.noticeData.recentPostIds).toEqual(['99'])
  })

  it('does nothing when the group is not in the ORM', () => {
    expect(upsertOptimisticChatActivityNotice(session, {
      groupId: 'missing',
      chat: { id: 'post_1', details: '<p>hi</p>' }
    })).toBe(null)
  })
})

describe('replaceOptimisticChatActivityNotice', () => {
  it('deletes the temporary notice when the real one arrives', () => {
    const session = orm.session(orm.getEmptyState())
    session.Group.create({ id: '10', slug: 'bar', name: 'Bar' })
    const createdAt = '2026-08-14T04:10:00.000Z'
    const optimistic = upsertOptimisticChatActivityNotice(session, {
      groupId: '10',
      chat: { id: 'post_1', details: '<p>hi</p>', createdAt }
    })
    session.Post.create({
      id: '500',
      type: 'chat_activity',
      createdAt,
      noticeData: optimistic.noticeData,
      noticePosts: optimistic.noticePosts,
      groups: ['10']
    })

    replaceOptimisticChatActivityNotice(session, session.Post.withId('500'))

    expect(session.Post.idExists(optimistic.id)).toBe(false)
    expect(session.Post.idExists('500')).toBe(true)
  })
})

describe('prependCurrentHourNotices', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it('puts the current-hour notice first on All Activity', () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-08-14T04:20:00.000Z'))
    const session = orm.session(orm.getEmptyState())
    session.Group.create({ id: '10', slug: 'bar', name: 'Bar' })
    session.Post.create({ id: '18', type: 'discussion', createdAt: '2026-08-14T03:00:00.000Z' })
    const notice = upsertOptimisticChatActivityNotice(session, {
      groupId: '10',
      chat: { id: 'post_1', details: '<p>hi</p>', createdAt: '2026-08-14T04:10:00.000Z' }
    })
    const discussion = session.Post.withId('18')

    const next = prependCurrentHourNotices(session, [discussion], { filter: 'all+notices', slug: 'bar' })
    expect(next.map(p => p.id)).toEqual([notice.id, '18'])
  })

  it('matches a space notice onto the parent All Activity slug', () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-08-14T04:20:00.000Z'))
    const session = orm.session(orm.getEmptyState())
    session.Group.create({
      id: '11',
      slug: 'space',
      name: 'Space',
      type: 'space',
      parentId: '1'
    })
    const notice = upsertOptimisticChatActivityNotice(session, {
      groupId: '11',
      chat: { id: 'post_1', details: '<p>hi</p>', createdAt: '2026-08-14T04:10:00.000Z' }
    })

    const next = prependCurrentHourNotices(session, [], { filter: 'all+notices', slug: 'parent', groupId: '1' })
    expect(next.map(p => p.id)).toEqual([notice.id])
  })
})

describe('reconcileChatActivityNoticesAfterFetch', () => {
  it('keeps a locally newer same-hour card over stale fetch data', () => {
    const session = orm.session(orm.getEmptyState())
    session.Group.create({ id: '10', slug: 'bar', name: 'Bar' })
    const notice = upsertOptimisticChatActivityNotice(session, {
      groupId: '10',
      chat: { id: 'post_2', details: '<p>new</p>', createdAt: '2026-08-14T04:40:00.000Z' }
    })
    const preserved = snapshotChatActivityNotices(session.Post)
    notice.update({
      createdAt: '2026-08-14T04:10:00.000Z',
      noticeData: { ...notice.noticeData, postCount: 1, recentPostIds: ['post_1'] },
      noticePosts: [{ id: 'post_1', details: '<p>old</p>', createdAt: '2026-08-14T04:10:00.000Z' }]
    })

    reconcileChatActivityNoticesAfterFetch(session, preserved)

    const next = session.Post.withId(notice.id)
    expect(next.noticeData.postCount).toEqual(1)
    expect(next.noticePosts[0].id).toEqual('post_2')
  })
})
