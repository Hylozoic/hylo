import { sid } from '../helpers'

/**
 * Notifications for sandbox Me, grounded in seeded posts, comments, spaces,
 * the orientation track, and the bioregional grants round.
 */
export function buildNotifications ({ peopleById, meId, groups, postsById, track, fundingRound }) {
  const p002 = peopleById[sid('person', '002')]
  const p003 = peopleById[sid('person', '003')]
  const p004 = peopleById[sid('person', '004')]
  const p006 = peopleById[sid('person', '006')]
  const p007 = peopleById[sid('person', '007')]
  const p008 = peopleById[sid('person', '008')]
  const p009 = peopleById[sid('person', '009')]
  const p010 = peopleById[sid('person', '010')]
  const p011 = peopleById[sid('person', '011')]
  const p016 = peopleById[sid('person', '016')]
  const starter = peopleById[sid('person', 'starter', '001')]

  const main = groups.main
  const chatSpace = groups.spaces.chat
  const fundingSpace = groups.spaces.funding
  const trackSpace = groups.spaces.track

  const forest = postsById[sid('post', '001')]
  const gathering = postsById[sid('post', '004')]
  const rights = postsById[sid('post', '006')]
  const wage = postsById[sid('post', '008')]
  const bioregional = postsById[sid('post', '012')]
  const chatNotes = postsById[sid('post', 'chat', '002')]
  const mycorrhizal = postsById[sid('post', 'fr', '001')]

  const items = [
    // Oldest first — higher ids sort to the top of the dropdown
    note('001', -86400 * 19, false, {
      action: 'eventInvitation',
      actor: p003,
      group: main,
      post: gathering
    }),
    note('002', -86400 * 13 + 2000, false, {
      action: 'newComment',
      actor: p002,
      group: main,
      post: forest,
      comment: commentOn(forest, '001-c02')
    }),
    note('003', -86400 * 13 + 10000, false, {
      action: 'newComment',
      actor: p006,
      group: main,
      post: forest,
      comment: commentOn(forest, '001-c07')
    }),
    note('004', -86400 * 13 + 14000, false, {
      action: 'commentMention',
      actor: p007,
      group: main,
      post: forest,
      comment: commentOn(forest, '001-c11')
    }),
    note('005', -86400 * 6, false, {
      action: 'newPost',
      actor: p004,
      group: main,
      post: rights
    }),
    note('006', -86400 * 5, false, {
      action: 'fundingRoundNewSubmission',
      actor: p016,
      group: fundingSpace,
      parent: main,
      post: mycorrhizal,
      fundingRound
    }),
    note('007', -86400 * 3 + 1000, false, {
      action: 'newComment',
      actor: p006,
      group: main,
      post: wage,
      comment: commentOn(wage, '008-c01')
    }),
    note('008', -43200, false, {
      action: 'newPost',
      actor: p009,
      group: main,
      post: bioregional
    }),
    note('009', -7200, false, {
      action: 'memberJoinedGroup',
      actor: starter,
      group: main
    }),
    note('010', -7000, true, {
      action: 'chat',
      actor: p010,
      group: chatSpace,
      parent: main,
      post: chatNotes,
      meta: { reasons: ['chat: general'] }
    }),
    note('011', -3600, true, {
      action: 'fundingRoundReminder',
      actor: peopleById[meId],
      group: fundingSpace,
      parent: main,
      fundingRound,
      meta: { reasons: [], reminderType: 'votingClosing3Days' }
    }),
    note('012', -1800, true, {
      action: 'trackEnrollment',
      actor: p008,
      group: trackSpace,
      parent: main,
      track
    }),
    note('013', -900, true, {
      action: 'joinRequest',
      actor: p011,
      group: chatSpace,
      parent: main,
      otherGroup: groupStub(main)
    })
  ]

  return items
}

export function unreadNotificationCount (notifications) {
  return notifications.filter(n => n.activity.unread).length
}

function commentOn (post, num) {
  const items = post?.comments?.items || []
  return items.find(c => c.id === sid('comment', num)) || items[0] || null
}

function note (num, createdAt_offset, unread, {
  action,
  actor,
  group,
  parent,
  post,
  comment,
  track,
  fundingRound,
  otherGroup,
  meta
}) {
  return {
    id: sid('notification', num),
    createdAt_offset,
    activity: {
      id: sid('activity', num),
      action,
      unread,
      actor,
      post: postStub(post, group),
      comment: comment ? { id: comment.id, text: comment.text } : null,
      group: groupStub(group, parent),
      otherGroup: otherGroup || null,
      track: track ? { id: track.id, name: track.name } : null,
      fundingRound: fundingRound ? { id: fundingRound.id, title: fundingRound.title } : null,
      contributionAmount: null,
      meta: { reasons: [], ...meta }
    }
  }
}

function groupStub (group, parent = null) {
  if (!group) return null
  return {
    id: group.id,
    name: group.name,
    slug: group.slug,
    homeRoute: group.homeRoute,
    type: group.type || null,
    parentId: group.parentId || parent?.id || null,
    parentGroup: parent ? { id: parent.id, slug: parent.slug } : null
  }
}

function postStub (post, group) {
  if (!post) return null
  return {
    id: post.id,
    title: post.title,
    details: post.details,
    type: post.type,
    groups: group ? [{ id: group.id, slug: group.slug }] : (post.groups || []),
    topics: []
  }
}
