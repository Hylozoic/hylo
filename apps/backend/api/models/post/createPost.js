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
          pick(params, 'localId', 'group_ids', 'imageUrl', 'videoUrl', 'docs', 'topicNames', 'memberIds', 'eventInviteeIds', 'imageUrls', 'fileUrls', 'announcement', 'location', 'location_id', 'proposalOptions', 'trackId'),
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

    // Add creator to RSVPs
    post.get('type') === 'event' &&
      EventInvitation.create({ userId, inviterId: userId, eventId: post.id, response: EventInvitation.RESPONSE.YES }, trxOpts),

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

    opts.trackId && Track.addPost(post, opts.trackId, trxOpts)
  ]))
    .then(() => post.isProject() && post.setProjectMembers(opts.memberIds || [], trxOpts))
    .then(() => post.isEvent() && post.updateEventInvitees(opts.eventInviteeIds || [], userId, trxOpts))
    .then(() => post.isProposal() && post.setProposalOptions({ options: opts.proposalOptions || [], userId, opts: trxOpts }))
    .then(() => Tag.updateForPost(post, opts.topicNames, userId, trx))
    .then(() => updateTagsAndGroups(post, opts.localId, trx))
    .then(() => Queue.classMethod('Group', 'doesMenuUpdate', { post: { type: post.get('type'), location_id: post.get('location_id') }, groupIds: opts.group_ids }))
    .then(() => Queue.classMethod('Post', 'createActivities', { postId: post.id }))
    .then(() => Queue.classMethod('Post', 'notifySlack', { postId: post.id }))
    .then(() => Queue.classMethod('Post', 'zapierTriggers', { postId: post.id }))
    .catch((err) => { throw new GraphQLError(`afterCreatingPost failed: ${err}`) })
}

async function updateTagsAndGroups (post, localId, trx) {
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

  const groupMembershipQuery = GroupMembership.query(q => {
    q.whereIn('group_id', groups.map('id'))
    q.whereNot('group_memberships.user_id', post.get('user_id'))
    q.where('group_memberships.active', true)
  }).query()

  if (trx) {
    groupTagsQuery.transacting(trx)
    tagFollowQuery.transacting(trx)
    groupMembershipQuery.transacting(trx)
  }

  return Promise.all([
    notifySockets,
    groupTagsQuery.update({ updated_at: new Date() }),
    tagFollowQuery.update({ updated_at: new Date() }).increment('new_post_count'),
    groupMembershipQuery.update({ updated_at: new Date() }).increment('new_post_count')
  ])
}
