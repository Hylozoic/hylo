import { GraphQLError } from 'graphql'
import { flatten, merge, pick, uniq } from 'lodash'
import setupPostAttrs from './setupPostAttrs'
import updateChildren from './updateChildren'
import { assertGroupsAcceptPostType } from './validatePostData'
import { groupRoom, pushToSockets } from '../../services/Websockets'
import { partitionImageUrls } from '../../../lib/uploader/rehostRemoteMedia'
import {
  POST_TYPE_TO_TYPED_VIEW,
  postCountsTowardChatUnread
} from '@hylo/shared'

export default async function createPost (userId, params) {
  await assertGroupsAcceptPostType(params.group_ids, params.type)
  const { hosted: hostedImageUrls, remote: remoteImageUrls } = partitionImageUrls(params.imageUrls)
  return setupPostAttrs(userId, merge(Post.newPostAttrs(), params), true)
    .then(attrs => bookshelf.transaction(transacting =>
      Post.create(attrs, { transacting })
        .tap(post => afterCreatingPost(post, merge(
          pick(params, 'localId', 'group_ids', 'imageUrl', 'videoUrl', 'docs', 'topicNames', 'memberIds', 'eventInviteeIds', 'fileUrls', 'fundingRoundId', 'announcement', 'location', 'location_id', 'proposalOptions', 'trackId', 'viewId', 'markAsReadTopicName', 'skip_link_preview'),
          { imageUrls: hostedImageUrls, children: params.requests, transacting }
        ))))
      .then(function (inserts) {
        inserts.setLocalId(params.localId)
        return inserts
      }).catch(function (error) {
        throw error
      }))
    .then(post => {
      if (remoteImageUrls.length > 0) {
        Queue.classMethod('Post', 'rehostAndAttachImages', {
          postId: post.id,
          userId,
          imageUrls: remoteImageUrls,
          startPosition: (hostedImageUrls || []).length
        }, 0)
      }
      if (post.get('type') === Post.Type.CHAT) {
        Queue.classMethod('Post', 'upsertChatActivityNotice', { postId: post.id }, 0)
      }
      return post
    })
}

export function afterCreatingPost (post, opts) {
  const userId = post.get('user_id')
  const mentioned = RichText.getUserMentions(post.details())
  const followerIds = uniq(mentioned.concat(userId))
  const trx = opts.transacting
  const trxOpts = pick(opts, 'transacting')
  return Promise.all(flatten([
    opts.group_ids && post.groups().attach(uniq(opts.group_ids), trxOpts),

    // Add mentioned users and creator as followers
    post.addFollowers(followerIds, {}, trxOpts),

    // Add media, if any
    // redux version
    opts.imageUrl && Media.createForSubject({
      subjectType: 'post',
      subjectId: post.id,
      type: 'image',
      url: opts.imageUrl
    }, trx),

    // evo version
    opts.imageUrls && Promise.map(opts.imageUrls, (url, i) =>
      Media.createForSubject({
        subjectType: 'post',
        subjectId: post.id,
        type: 'image',
        url,
        position: i
      }, trx)),

    // evo version
    opts.fileUrls && Promise.map(opts.fileUrls, (url, i) =>
      Media.createForSubject({
        subjectType: 'post',
        subjectId: post.id,
        type: 'file',
        url,
        position: i
      }, trx)),

    opts.children && updateChildren(post, opts.children, trx),

    // google doc / video not currently used in evo
    opts.videoUrl && Media.createForSubject({
      subjectType: 'post',
      subjectId: post.id,
      type: 'video',
      url: opts.videoUrl
    }, trx),
    opts.docs && Promise.map(opts.docs, (doc) => Media.createDoc(post.id, doc, trx)),

    opts.trackId && Track.addPost(post, opts.trackId, { ...trxOpts, userId }),

    // Track.addPost already links the post into the track-actions view — skip viewId
    // to avoid a parallel duplicate insert into collections_posts.
    opts.viewId && !opts.trackId && addPostToViewCollection(post, opts.viewId, userId, trxOpts),

    opts.fundingRoundId && post.get('type') === Post.Type.SUBMISSION && FundingRound.addPost(post, opts.fundingRoundId, userId, trxOpts)
  ]))
    .then(() => post.isProject() && post.setProjectMembers(opts.memberIds || [], trxOpts))
    .then(() => post.isEvent() && Queue.classMethod('Post', 'processEventCreated', { postId: post.id, eventInviteeIds: opts.eventInviteeIds, userId, params: opts.params }))
    .then(() => post.isProposal() && post.setProposalOptions({ options: opts.proposalOptions || [], userId, opts: trxOpts }))
    .then(() => Tag.updateForPost(post, opts.topicNames, userId, trx))
    .then(() => attachOrQueueLinkPreview(post, trx, opts.skip_link_preview))
    .then(() => notifyAndMarkAuthorRead(post, opts.localId, trx))
    // Mass GroupMembership / GroupViewUser new_post_count updates can touch thousands of
    // rows. Run in the background like delete.
    .then(() => Queue.classMethod('Post', 'incrementNewPostCountForCreatedPost', { postId: post.id }, 0))
    .then(() => Queue.classMethod('Post', 'createActivities', { postId: post.id }))
    .then(() => opts.fundingRoundId && post.get('type') === Post.Type.SUBMISSION && Queue.classMethod('FundingRound', 'notifyStewardsOfSubmission', { fundingRoundId: opts.fundingRoundId, postId: post.id, userId }))
    .then(() => Queue.classMethod('Post', 'notifySlack', { postId: post.id }))
    .then(() => Queue.classMethod('Post', 'zapierTriggers', { postId: post.id }))
    .catch((err) => {
      console.error('afterCreatingPost failed: ', err)
      throw new GraphQLError(`afterCreatingPost failed: ${err}`)
    })
}

/** Links a newly created post into a view's ordered collections_posts list. */
async function addPostToViewCollection (post, viewId, userId, { transacting } = {}) {
  const view = await GroupView.where({ id: viewId }).fetch({ transacting })
  if (!view) return null

  const existing = await CollectionPost.find(viewId, post.id, { transacting })
  if (existing) return existing

  const row = await bookshelf.knex('collections_posts')
    .modify(q => { if (transacting) q.transacting(transacting) })
    .where({ view_id: viewId })
    .select(bookshelf.knex.raw('coalesce(max("order"), -1) as max_order'))
    .first()
  const nextOrder = Number(row.max_order) + 1

  return CollectionPost.create({
    view_id: viewId,
    post_id: post.id,
    order: nextOrder,
    user_id: userId
  }, { transacting })
}

/**
 * If the post has no link preview, attach one from the first URL in its body/title.
 * Reuses an already-fetched preview when present so the newPost socket payload includes it;
 * otherwise queues a background fetch (Zapier / email / API creates skip the editor preview).
 * Honors skipLinkPreview when the author removed the preview in the editor.
 */
async function attachOrQueueLinkPreview (post, trx, skipLinkPreview) {
  if (skipLinkPreview || post.get('link_preview_id')) return

  const url = RichText.getFirstExternalUrl(post.get('description')) ||
    RichText.getFirstExternalUrl(post.get('name'))

  if (!url) return

  const existing = await LinkPreview.find(url)
  if (existing?.get('done') && existing.get('title')) {
    await post.save({ link_preview_id: existing.id }, { patch: true, transacting: trx })
    return
  }

  // Default 2s delay: this runs inside the create transaction, and delay(0) is
  // immediately runnable so the worker can miss the uncommitted post and no-op.
  return Queue.classMethod('Post', 'generateLinkPreview', { postId: post.id, url })
}

/**
 * Increment unread for GroupMemberships, typed views, and chat views.
 * Called as a background job so large groups do not block createPost.
 */
export async function incrementNewPostCount (post) {
  if (Post.isNoticeType(post.get('type'))) return

  const { groups } = post.relations

  if (!groups || groups.length === 0) {
    return
  }

  const postType = post.get('type')
  const authorId = post.get('user_id')
  const typedViewType = POST_TYPE_TO_TYPED_VIEW[postType]
  const groupIds = groups.map('id')

  const memberRows = await bookshelf.knex('group_memberships')
    .whereIn('group_id', groupIds)
    .whereNot('user_id', authorId)
    .where('active', true)
    .select('group_id', 'user_id')

  const membersByGroup = new Map()
  for (const row of memberRows) {
    const key = String(row.group_id)
    if (!membersByGroup.has(key)) membersByGroup.set(key, [])
    membersByGroup.get(key).push(row.user_id)
  }

  const viewTypes = []
  if (typedViewType) viewTypes.push(typedViewType)
  if (postCountsTowardChatUnread(postType)) viewTypes.push(GroupView.Type.CHAT)

  const views = viewTypes.length === 0
    ? []
    : (await GroupView.query(q => {
        q.whereIn('group_id', groupIds)
        q.whereIn('type', viewTypes)
      }).fetchAll()).models

  const viewsByGroupType = new Map()
  for (const view of views) {
    viewsByGroupType.set(`${String(view.get('group_id'))}:${view.get('type')}`, view)
  }

  const jobs = []
  for (const group of groups.models) {
    const memberIds = membersByGroup.get(String(group.id)) || []
    if (memberIds.length === 0) continue

    if (typedViewType) {
      const typedView = viewsByGroupType.get(`${String(group.id)}:${typedViewType}`)
      if (typedView) jobs.push(GroupViewUser.incrementNewPostCount(typedView.id, memberIds))
    }
    if (postCountsTowardChatUnread(postType)) {
      const chatView = viewsByGroupType.get(`${String(group.id)}:${GroupView.Type.CHAT}`)
      if (chatView) jobs.push(GroupViewUser.incrementNewPostCount(chatView.id, memberIds))
    }
  }

  return Promise.all([
    GroupMembership.query(q => {
      q.whereIn('group_id', groupIds)
      q.whereNot('group_memberships.user_id', authorId)
      q.where('group_memberships.active', true)
    }).query().update({ updated_at: new Date() }).increment('new_post_count'),
    Promise.all(jobs)
  ])
}

/**
 * After tags are synced: notify sockets, bump GroupTag freshness, and mark the
 * author's matching views read up to this post (typed common view + chat when applicable).
 */
async function notifyAndMarkAuthorRead (post, localId, trx) {
  await post.load([
    'media', 'groups', 'linkPreview', 'tags', 'user'
  ], { transacting: trx })

  const { tags, groups } = post.relations

  // NOTE: the payload object is released to many users, so it cannot be
  // subject to the usual permissions checks (which groups
  // the user is allowed to view, etc). This means we either omit the
  // information, or (as below) we only post group data for the socket
  // room it's being pushed to.
  const payload = post.getNewPostSocketPayload()
  payload.localId = localId
  const rooms = new Set()
  const notifySockets = []
  payload.groups.forEach(g => {
    rooms.add(String(g.id))
    notifySockets.push(pushToSockets(
      groupRoom(g.id),
      'newPost',
      Object.assign({}, payload, { groups: [g] })
    ))
  })
  // Space posts also go to the parent room so the parent menu can badge
  // without every client joining every space room.
  groups.models.forEach(group => {
    const parentId = group.get('parent_id')
    if (!parentId || rooms.has(String(parentId))) return
    rooms.add(String(parentId))
    const g = payload.groups.find(p => String(p.id) === String(group.id))
    if (!g) return
    notifySockets.push(pushToSockets(
      groupRoom(parentId),
      'newPost',
      Object.assign({}, payload, { groups: [g] })
    ))
  })

  const groupTagsQuery = GroupTag.query(q => {
    q.whereIn('tag_id', tags.map('id'))
  }).query()

  if (trx) {
    groupTagsQuery.transacting(trx)
  }

  const trackAsNewPost = ![Post.Type.ACTION, Post.Type.SUBMISSION].includes(post.get('type'))
  const postType = post.get('type')
  const authorId = post.get('user_id')
  const postId = post.get('id')
  const typedViewType = POST_TYPE_TO_TYPED_VIEW[postType]

  const markAuthorViewsRead = Promise.map(groups.models, async group => {
    const jobs = []

    if (typedViewType) {
      const typedView = await GroupView.where({
        group_id: group.id,
        type: typedViewType
      }).fetch({ transacting: trx })
      if (typedView) {
        jobs.push(GroupViewUser.markAuthorRead(typedView.id, authorId, postId, { transacting: trx }))
      }
    }

    if (postCountsTowardChatUnread(postType)) {
      const chatView = await GroupView.where({
        group_id: group.id,
        type: GroupView.Type.CHAT
      }).fetch({ transacting: trx })
      if (chatView) {
        jobs.push(GroupViewUser.markAuthorRead(chatView.id, authorId, postId, { transacting: trx }))
      }
    }

    return Promise.all(jobs)
  })

  return Promise.all([
    notifySockets,
    trackAsNewPost && groupTagsQuery.update({ updated_at: new Date() }),
    markAuthorViewsRead
  ])
}
