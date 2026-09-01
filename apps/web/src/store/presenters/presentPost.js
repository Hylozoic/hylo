import { DateTimeHelpers } from '@hylo/shared'
import presentTopic from 'store/presenters/presentTopic'
import { getLocaleFromLocalStorage } from 'util/locale'

/** Parses noticeData whether the API returned an object or a JSON string. */
function parseNoticeData (value) {
  if (!value) return null
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch (e) {
      return null
    }
  }
  return value
}

export default function presentPost (post, groupId) {
  if (!post) return null

  // Raw posts came directly from the API, not processed through the model extractor
  // Used in the chat room
  const rawPost = !post.ref

  try {
    const createdAtHumanDate = DateTimeHelpers.humanDate(post.createdAt)
    const createdAtHumanDateShort = DateTimeHelpers.humanDate(post.createdAt, true)
    const editedAtHumanDate = DateTimeHelpers.humanDate(post.editedAt)

    const finalPost = {
      ...(rawPost ? post : post.ref),
      attachments: (rawPost ? post.attachments || [] : (post.attachments?.toModelArray?.() || [])).sort((a, b) => a.position - b.position),
      createdTimestamp: createdAtHumanDate,
      createdTimestampShort: createdAtHumanDateShort,
      creator: post.creator, // needed to load the creator object
      postMemberships: (rawPost ? post.postMemberships?.items || post.postMemberships || [] : (post.postMemberships?.toRefArray?.() || [])),
      commenters: (rawPost ? post.commenters?.items || [] : (post.commenters?.toModelArray?.() || [])),
      completionResponses: (rawPost ? post.completionResponses?.items || [] : post.completionResponses?.toModelArray() || []),
      editedTimestamp: post.editedAt ? `Edited ${editedAtHumanDate}` : null,
      eventInvitations: (rawPost ? post.eventInvitations?.items || [] : (post.eventInvitations?.toModelArray?.() || [])).map(eventInvitation => {
        const person = rawPost ? eventInvitation.person : eventInvitation.person.ref
        return {
          eventInvitationId: eventInvitation.id,
          response: eventInvitation.response,
          ...person
        }
      }),
      exactCreatedTimestamp: DateTimeHelpers.toDateTime(post.createdAt, { locale: getLocaleFromLocalStorage() }).toFormat('D t ZZZZ'),
      exactEditedTimestamp: DateTimeHelpers.toDateTime(post.editedAt, { locale: getLocaleFromLocalStorage() }).toFormat('D t ZZZZ'),
      fileAttachments: (rawPost ? post.attachments || [] : (post.attachments?.toModelArray?.() || [])).filter(a => a.type === 'file').sort((a, b) => a.position - b.position),
      imageAttachments: (rawPost ? post.attachments || [] : (post.attachments?.toModelArray?.() || [])).filter(a => a.type === 'image').sort((a, b) => a.position - b.position),
      groups: (rawPost ? post.groups || [] : (post.groups?.toModelArray?.() || [])),
      // Accessing the relation loads it; prefer .ref so url/title are plain fields
      linkPreview: rawPost ? post.linkPreview : (post.linkPreview?.ref || post.linkPreview),
      linkPreviewFeatured: !!(rawPost ? post.linkPreviewFeatured : post.ref?.linkPreviewFeatured),
      location: post.location, // needed to load the location object
      // GraphQL locationObject is stored nested on .ref; the locationId FK is usually empty
      locationObject: rawPost ? post.locationObject : (post.ref?.locationObject || post.locationObject?.ref || post.locationObject),
      members: (rawPost ? post.members?.items || [] : (post.members?.toModelArray?.() || [])).map(person => {
        return {
          ...(rawPost ? person : person.ref),
          skills: (rawPost ? person.skills?.items || [] : (person.skills?.toModelArray?.() || []))
        }
      }),
      noticeData: parseNoticeData(rawPost ? post.noticeData : post.ref?.noticeData),
      noticePosts: rawPost ? (post.noticePosts || []) : (post.ref?.noticePosts || post.noticePosts || []),
      proposalOptions: (rawPost ? post.proposalOptions?.items || [] : (post.proposalOptions?.toModelArray?.() || [])),
      topics: (rawPost ? post.topics || [] : (post.topics?.toModelArray?.() || []).map(topic => presentTopic(topic, {})))
    }
    return finalPost
  } catch (e) {
    console.log('error', e)
    return null
  }
}
