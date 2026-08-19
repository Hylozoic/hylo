import { materializeTimestamps } from '../helpers'
import { PLACEHOLDER_COPY, PLACEHOLDER_NAME } from '../constants'
import { buildMe, buildPeople, meAsPerson, peopleById, ME_ID } from './people'
import {
  buildGroups,
  buildGroupViews,
  buildMemberships,
  MAIN_GROUP_ID
} from './groups'
import { buildTrack, buildTrackActions, TRACK_ID } from './tracks'
import { buildFundingRound, FUNDING_ROUND_ID } from './fundingRounds'
import { buildPosts, indexPosts } from './posts'
import { buildCommentsByPostId, buildReactionsByPostId, buildProposalData } from './comments'
import { buildMessageThreads } from './messageThreads'

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

  return {
    meta: {
      locale: 'en',
      version: 1,
      placeholderRules: {
        name: '12 characters of %',
        copy: '200 characters of *'
      }
    },
    me: { ...me, memberships },
    people,
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
    post.comments = { items: comments, total: comments.length, hasMore: false }
    post.commentsTotal = comments.length
    post.commentersTotal = comments.length
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

function summarizeReactions (reactions) {
  const summary = {}
  for (const r of reactions) {
    summary[r.emojiFull] = (summary[r.emojiFull] || 0) + 1
  }
  return summary
}

export { PLACEHOLDER_COPY, PLACEHOLDER_NAME, ME_ID, MAIN_GROUP_ID }
