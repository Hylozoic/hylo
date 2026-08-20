import { PLACEHOLDER_COPY, PLACEHOLDER_NAME } from '../constants'
import { buildMe, buildPeople, peopleById, ME_ID } from './people'
import {
  buildGroups,
  buildGroupViews,
  buildMemberships,
  MAIN_GROUP_ID,
  MAIN_COORDINATOR_ROLE_ID
} from './groups'
import { buildTrack, buildTrackActions, TRACK_ID } from './tracks'
import { buildFundingRound, FUNDING_ROUND_ID } from './fundingRounds'
import { buildPosts, indexPosts } from './posts'
import { buildCommentsByPostId, buildReactionsByPostId, buildProposalData } from './comments'
import { buildMessageThreads } from './messageThreads'
import { buildNotifications, unreadNotificationCount } from './notifications'

/**
 * Assemble the full English sandbox seed.
 * Pass the result through loadSandboxSeed() to materialize timestamps.
 *
 * Edit content in this folder — names are PLACEHOLDER_NAME (12× `%`),
 * prose is PLACEHOLDER_COPY (200× `*`).
 */
export function buildEnSeed () {
  const me = buildMe()
  const people = buildPeople()
  const peopleMap = peopleById(people, me)
  const groups = buildGroups()
  const track = buildTrack()
  const fundingRound = buildFundingRound()
  const memberships = buildMemberships(groups)
  const groupViews = buildGroupViews(groups, track, fundingRound)

  const postCollections = buildPosts(peopleMap, ME_ID)
  postCollections.byId = indexPosts(postCollections)

  const trackActions = buildTrackActions(peopleMap, ME_ID)
  for (const action of trackActions) {
    postCollections.byId[action.id] = action
  }

  const commentsByPostId = buildCommentsByPostId(peopleMap, ME_ID)
  const reactionsByPostId = buildReactionsByPostId(peopleMap, ME_ID)
  const proposalData = buildProposalData()

  attachCommentsAndReactions(postCollections.byId, commentsByPostId, reactionsByPostId, proposalData)

  const messageThreads = buildMessageThreads(peopleMap)
  const notifications = buildNotifications({
    peopleById: peopleMap,
    meId: ME_ID,
    groups,
    postsById: postCollections.byId,
    track,
    fundingRound
  })

  return {
    meta: {
      locale: 'en',
      version: 1,
      placeholderRules: {
        name: '12 characters of %',
        copy: '200 characters of *'
      }
    },
    me: {
      ...me,
      newNotificationCount: unreadNotificationCount(notifications),
      memberships,
      groupRoles: { items: groups.groupRoles.filter(role => role.id === MAIN_COORDINATOR_ROLE_ID) }
    },
    people,
    peopleById: peopleMap,
    groups: {
      all: [
        groups.main,
        groups.simple,
        groups.spaces.chat,
        groups.spaces.track,
        groups.spaces.funding
      ],
      main: groups.main,
      simple: groups.simple,
      spaces: groups.spaces,
      roles: groups.groupRoles
    },
    groupViews,
    track: { ...track, actions: trackActions },
    fundingRound: {
      ...fundingRound,
      submissions: {
        items: postCollections.fundingSubmissions,
        total: postCollections.fundingSubmissions.length,
        hasMore: false
      }
    },
    posts: postCollections,
    proposals: proposalData,
    messageThreads,
    notifications,
    // Convenience exports for mock resolvers
    ids: {
      me: ME_ID,
      mainGroup: MAIN_GROUP_ID,
      track: TRACK_ID,
      fundingRound: FUNDING_ROUND_ID
    }
  }
}

function attachCommentsAndReactions (postsById, commentsByPostId, reactionsByPostId, proposalData) {
  for (const [postId, comments] of Object.entries(commentsByPostId)) {
    const post = postsById[postId]
    if (!post) continue
    const items = comments.map(c => normalizeComment(c, postId))
    const commenters = uniqueCommenters(items)
    post.comments = { items, total: items.length, hasMore: false }
    post.commentsTotal = countComments(items)
    post.commenters = commenters.slice(0, 3)
    post.commentersTotal = commenters.length
  }

  for (const [postId, reactions] of Object.entries(reactionsByPostId)) {
    const post = postsById[postId]
    if (!post) continue
    post.postReactions = reactions
    post.postReactionsTotal = reactions.length
    post.peopleReactedTotal = reactions.length
    post.reactionsSummary = summarizeReactions(reactions)
  }

  for (const [postId, data] of Object.entries(proposalData)) {
    const post = postsById[postId]
    if (!post) continue
    post.proposalOptions = { items: data.options, total: data.options.length, hasMore: false }
    post.proposalVotes = data.votes
    post.proposalStatus = data.proposalStatus
    post.votingMethod = data.votingMethod
  }
}

function normalizeComment (comment, postId, parentId = null) {
  const rawChildren = Array.isArray(comment.childComments)
    ? comment.childComments
    : (comment.childComments?.items || [])
  const children = rawChildren.map(child => normalizeComment(child, postId, comment.id))
  return {
    ...comment,
    parentComment: parentId ? { id: parentId } : null,
    post: { id: postId },
    attachments: comment.attachments || [],
    commentReactions: comment.commentReactions || [],
    childComments: { items: children, total: children.length, hasMore: false }
  }
}

function uniqueCommenters (comments) {
  const seen = new Set()
  const people = []
  for (const comment of comments) {
    const person = comment.creator
    if (person?.id && !seen.has(String(person.id))) {
      seen.add(String(person.id))
      people.push({ id: person.id, name: person.name, avatarUrl: person.avatarUrl })
    }
    const nested = comment.childComments?.items || []
    for (const child of uniqueCommenters(nested)) {
      if (!seen.has(String(child.id))) {
        seen.add(String(child.id))
        people.push(child)
      }
    }
  }
  return people
}

function countComments (comments) {
  return comments.reduce((sum, comment) => {
    return sum + 1 + (comment.childComments?.items?.length || 0)
  }, 0)
}

function summarizeReactions (reactions) {
  const summary = {}
  for (const r of reactions) {
    summary[r.emojiFull] = (summary[r.emojiFull] || 0) + 1
  }
  return summary
}

export { PLACEHOLDER_COPY, PLACEHOLDER_NAME, ME_ID, MAIN_GROUP_ID }
