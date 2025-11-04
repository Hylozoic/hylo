import { DateTimeHelpers } from '@hylo/shared'
import presentTopic from 'store/presenters/presentTopic'
import { getLocaleFromLocalStorage } from 'util/locale'

// Memoize timestamp formatting to avoid expensive recalculations
const timestampCache = new Map()
const MAX_CACHE_SIZE = 1000 // Prevent memory leak with max cache size

function getTimestamps (createdAt, editedAt) {
  const cacheKey = `${createdAt}:${editedAt || ''}`

  if (timestampCache.has(cacheKey)) {
    return timestampCache.get(cacheKey)
  }

  const locale = getLocaleFromLocalStorage()
  const result = {
    createdTimestamp: DateTimeHelpers.humanDate(createdAt),
    editedTimestamp: editedAt ? `Edited ${DateTimeHelpers.humanDate(editedAt)}` : null,
    exactCreatedTimestamp: DateTimeHelpers.toDateTime(createdAt, { locale }).toFormat('D t ZZZZ'),
    exactEditedTimestamp: editedAt ? DateTimeHelpers.toDateTime(editedAt, { locale }).toFormat('D t ZZZZ') : null
  }

  // Limit cache size to prevent memory issues
  if (timestampCache.size >= MAX_CACHE_SIZE) {
    const firstKey = timestampCache.keys().next().value
    timestampCache.delete(firstKey)
  }

  timestampCache.set(cacheKey, result)
  return result
}

export default function presentPost (post, groupId) {
  if (!post) return null

  // Raw posts came directly from the API, not processed through the model extractor
  // Used in the chat room
  const rawPost = !post.ref

  try {
    const { createdTimestamp, editedTimestamp, exactCreatedTimestamp, exactEditedTimestamp } = getTimestamps(post.createdAt, post.editedAt)

    const finalPost = {
      ...(rawPost ? post : post.ref),
      attachments: (rawPost ? post.attachments || [] : post.attachments.toModelArray()).sort((a, b) => a.position - b.position),
      createdTimestamp,
      creator: post.creator, // needed to load the creator object
      commenters: (rawPost ? post.commenters?.items || [] : post.commenters.toModelArray()),
      completionResponses: (rawPost ? post.completionResponses?.items || [] : post.completionResponses?.toModelArray() || []),
      editedTimestamp,
      eventInvitations: (rawPost ? post.eventInvitations?.items || [] : post.eventInvitations.toModelArray()).map(eventInvitation => {
        return {
          response: eventInvitation.response,
          ...(rawPost ? eventInvitation.person : eventInvitation.person.ref)
        }
      }),
      exactCreatedTimestamp,
      exactEditedTimestamp,
      fileAttachments: (rawPost ? post.attachments || [] : post.attachments.toModelArray()).filter(a => a.type === 'file').sort((a, b) => a.position - b.position),
      imageAttachments: (rawPost ? post.attachments || [] : post.attachments.toModelArray()).filter(a => a.type === 'image').sort((a, b) => a.position - b.position),
      groups: (rawPost ? post.groups || [] : post.groups.toModelArray()),
      linkPreview: post.linkPreview, // needed to load the link preview object
      location: post.location, // needed to load the location object
      members: (rawPost ? post.members?.items || [] : post.members.toModelArray()).map(person => {
        return {
          ...(rawPost ? person : person.ref),
          skills: (rawPost ? person.skills?.items || [] : person.skills.toModelArray())
        }
      }),
      proposalOptions: (rawPost ? post.proposalOptions?.items || [] : post.proposalOptions.toModelArray()),
      topics: (rawPost ? post.topics || [] : post.topics.toModelArray().map(topic => presentTopic(topic, {})))
    }
    return finalPost
  } catch (e) {
    console.log('error', e)
  }
}
