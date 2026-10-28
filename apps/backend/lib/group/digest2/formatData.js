/* eslint-disable camelcase */
import {
  curry, find, sortBy
} from 'lodash/fp'
import { aggregateChatRooms } from './util'

const presentComment = curry((slug, comment) => ({
  id: comment.id,
  text: RichText.qualifyLinks(comment.text(), slug),
  user: comment.relations.user.pick('id', 'name', 'avatar_url')
}))

const relatedModels = (relation) => {
  if (!relation) return []
  if (relation.models) return relation.models
  return []
}

/**
 * Prefer a child space over the parent group, matching All Activity cards.
 */
const sourceGroupForPost = (post, parentGroup, spacesById) => {
  const groups = relatedModels(post.relations?.groups)
  const space = groups.find(g => spacesById.has(String(g.id)))
  return space || parentGroup
}

const isChildSpace = (sourceGroup, parentGroup) =>
  sourceGroup && String(sourceGroup.id) !== String(parentGroup.id)

const withSpaceFields = (presented, sourceGroup, parentGroup) => {
  if (!isChildSpace(sourceGroup, parentGroup)) return presented
  return {
    ...presented,
    space_id: sourceGroup.id,
    space_name: sourceGroup.get ? sourceGroup.get('name') : sourceGroup.name
  }
}

const withChatSource = (presented, sourceGroup, parentGroup) => {
  const source = sourceGroup || parentGroup
  return {
    ...withSpaceFields(presented, source, parentGroup),
    source_group_id: source.id,
    source_group_name: source.get ? source.get('name') : source.name,
    chat_url: Frontend.Route.chat(source)
  }
}

/** Ids of every group this post was sent to, used to label unified digests. */
const postedInIds = (post) =>
  relatedModels(post?.relations?.groups).map(g => g.id).filter(id => id != null)

/** Milliseconds for sorting Coming up / Ending soon after groups are merged. */
const sortAt = (post, field) => {
  const value = post.get ? post.get(field) : null
  if (!value) return null
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? null : time
}

const presentPost = (post, parentGroup, spacesById, type = 'digest') => {
  const sourceGroup = sourceGroupForPost(post, parentGroup, spacesById)
  const presented = post.presentForEmail({ group: sourceGroup, type })
  const withSource = presented.type === 'chat'
    ? withChatSource(presented, sourceGroup, parentGroup)
    : withSpaceFields(presented, sourceGroup, parentGroup)
  const ids = postedInIds(post)
  if (ids.length === 0) return withSource
  return { ...withSource, posted_in: ids }
}

const formatData = curry((group, data) => {
  const spaces = data.spaces?.models || data.spaces || []
  const spacesById = new Map(spaces.map(s => [String(s.id), s]))
  const posts = data.posts.map(post => presentPost(post, group, spacesById))
  const ret = {}
  for (const type of ['discussion', 'event', 'offer', 'project', 'proposal', 'request', 'resource', 'chat']) {
    ret[type + 's'] = sortBy(p => -p.id, posts.filter(p => p.type === type))
  }
  ret.chat_rooms = aggregateChatRooms(ret.chats)
  if (data.upcomingPostReminders?.startingSoon) {
    ret.upcoming = data.upcomingPostReminders.startingSoon.map(p => {
      const presented = presentPost(p, group, spacesById, 'oneline')
      const at = sortAt(p, 'start_time')
      return at == null ? presented : { ...presented, sort_at: at }
    })
  }
  if (data.upcomingPostReminders?.endingSoon) {
    ret.ending = data.upcomingPostReminders.endingSoon.map(p => {
      const presented = presentPost(p, group, spacesById, 'oneline')
      const at = sortAt(p, 'end_time')
      return at == null ? presented : { ...presented, sort_at: at }
    })
  }

  const postsWithNewComments = []
  data.comments.forEach(comment => {
    let post = find(p => p.id === parseInt(comment.get('post_id')), postsWithNewComments)
    if (!post) {
      post = presentPost(comment.relations.post, group, spacesById)
      postsWithNewComments.push(post)
    }
    post.comment_count = post.comment_count ? post.comment_count + 1 : 1
    const groupSlug = (typeof group.get === 'function' && group.get('slug')) || group.slug
    post.comments.push(presentComment(groupSlug, comment))
  })

  ret.posts_with_new_comments = sortBy(p => -p.id, postsWithNewComments)

  // Add funding round submissions
  if (data.fundingRoundSubmissions && data.fundingRoundSubmissions.length > 0) {
    ret.funding_rounds = data.fundingRoundSubmissions.map(fr => ({
      id: fr.fundingRoundId,
      title: fr.fundingRoundTitle,
      submission_count: fr.submissionCount,
      url: Frontend.Route.fundingRound({ id: fr.fundingRoundId }, group)
    }))
  }

  ret.num_sections = Object.keys(ret).filter(k => k !== 'chats' && Array.isArray(ret[k]) && ret[k].length > 0).length
  return ret.num_sections > 0 ? ret : null
})

export default formatData
