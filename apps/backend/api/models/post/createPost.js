import { GraphQLError } from 'graphql'
import { flatten, merge, pick, uniq } from 'lodash'
import setupPostAttrs from './setupPostAttrs'
import updateChildren from './updateChildren'
import { groupRoom, pushToSockets } from '../../services/Websockets'

export default async function createPost (userId, params) {
  return setupPostAttrs(userId, merge(Post.newPostAttrs(), params), true)
    .then(attrs => bookshelf.transaction(transacting =>
      Post.create(attrs, { transacting })
        .tap(post => afterCreatingPost(post, merge(
          pick(params, 'localId', 'group_ids', 'imageUrl', 'videoUrl', 'docs', 'topicNames', 'memberIds', 'eventInviteeIds', 'imageUrls', 'fileUrls', 'fundingRoundId', 'announcement', 'location', 'location_id', 'proposalOptions', 'trackId', 'markAsReadTopicName'),
          { children: params.requests, transacting }
        ))))
      .then(function (inserts) {
        inserts.setLocalId(params.localId)
        return inserts
      }).catch(function (error) {
        throw error
      }))
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

    opts.trackId && Track.addPost(post, opts.trackId, trxOpts),

    opts.fundingRoundId && post.get('type') === Post.Type.SUBMISSION && FundingRound.addPost(post, opts.fundingRoundId, userId, trxOpts)
  ]))
    .then(() => post.isProject() && post.setProjectMembers(opts.memberIds || [], trxOpts))
    .then(() => post.isEvent() && Queue.classMethod('Post', 'processEventCreated', { postId: post.id, eventInviteeIds: opts.eventInviteeIds, userId, params: opts.params }))
    .then(() => post.isProposal() && post.setProposalOptions({ options: opts.proposalOptions || [], userId, opts: trxOpts }))
    .then(() => Tag.updateForPost(post, opts.topicNames, userId, trx))
    .then(() => updateTagsAndGroups(post, opts.localId, trx, opts.markAsReadTopicName))
    .then(() => Queue.classMethod('Group', 'doesMenuUpdate', { post: { type: post.get('type'), location_id: post.get('location_id') }, groupIds: opts.group_ids }))
    .then(() => Queue.classMethod('Post', 'createActivities', { postId: post.id }))
    .then(() => opts.fundingRoundId && post.get('type') === Post.Type.SUBMISSION && Queue.classMethod('FundingRound', 'notifyStewardsOfSubmission', { fundingRoundId: opts.fundingRoundId, postId: post.id, userId }))
    .then(() => Queue.classMethod('Post', 'notifySlack', { postId: post.id }))
    .then(() => Queue.classMethod('Post', 'zapierTriggers', { postId: post.id }))
    .catch((err) => {
      console.error('afterCreatingPost failed: ', err)
      throw new GraphQLError(`afterCreatingPost failed: ${err}`)
    })
}

async function updateTagsAndGroups (post, localId, trx, markAsReadTopicName = null) {
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
  const notifySockets = payload.groups.map(g => {
    return pushToSockets(
      groupRoom(g.id),
      'newPost',
      Object.assign({}, payload, { groups: [g] })
    )
  })

  const groupTagsQuery = GroupTag.query(q => {
    q.whereIn('tag_id', tags.map('id'))
  }).query()

  const tagFollowQuery = TagFollow.query(q => {
    q.whereIn('tag_id', tags.map('id'))
    q.whereIn('group_id', groups.map('id'))
    q.whereNot('user_id', post.get('user_id'))
  }).query()

  // Find the specific tag the user is actively viewing so we can always mark it read.
  const markAsReadTag = markAsReadTopicName ? tags.find(t => t.get('name') === markAsReadTopicName) : null
  const markAsReadTagId = markAsReadTag ? markAsReadTag.get('id') : null

  // For the topic the user is currently viewing: always update last_read_post_id.
  const activeTopicTagFollowQuery = markAsReadTagId ? TagFollow.query(q => {
    q.where('tag_id', markAsReadTagId)
    q.whereIn('group_id', groups.map('id'))
    q.where('user_id', post.get('user_id'))
  }).query() : null

  // For all other topics: only update last_read_post_id when new_post_count = 0
  // (avoids hiding unread posts when creating from outside a chat room).
  const otherTagIds = tags.filter(t => t.get('id') !== markAsReadTagId).map(t => t.get('id'))
  const otherMyTagFollowQuery = otherTagIds.length > 0 ? TagFollow.query(q => {
    q.whereIn('tag_id', otherTagIds)
    q.whereIn('group_id', groups.map('id'))
    q.where('user_id', post.get('user_id'))
    q.where('new_post_count', 0)
  }).query() : null

  const groupMembershipQuery = GroupMembership.query(q => {
    q.whereIn('group_id', groups.map('id'))
    q.whereNot('group_memberships.user_id', post.get('user_id'))
    q.where('group_memberships.active', true)
  }).query()

  if (trx) {
    groupTagsQuery.transacting(trx)
    tagFollowQuery.transacting(trx)
    if (activeTopicTagFollowQuery) activeTopicTagFollowQuery.transacting(trx)
    if (otherMyTagFollowQuery) otherMyTagFollowQuery.transacting(trx)
    groupMembershipQuery.transacting(trx)
  }

  const trackAsNewPost = ![Post.Type.ACTION, Post.Type.SUBMISSION].includes(post.get('type'))

  return Promise.all([
    notifySockets,
    trackAsNewPost && groupTagsQuery.update({ updated_at: new Date() }),
    trackAsNewPost && tagFollowQuery.update({ updated_at: new Date() }).increment('new_post_count'),
    trackAsNewPost && activeTopicTagFollowQuery && activeTopicTagFollowQuery.update({ updated_at: new Date(), last_read_post_id: post.get('id') }),
    trackAsNewPost && otherMyTagFollowQuery && otherMyTagFollowQuery.update({ updated_at: new Date(), last_read_post_id: post.get('id') }),
    groupMembershipQuery.update({ updated_at: new Date() }).increment('new_post_count')
  ])
}
