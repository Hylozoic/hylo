import { DateTimeHelpers } from '@hylo/shared'
import presentTopic from 'store/presenters/presentTopic'
import { localeLocalStorageSync } from 'util/locale'

export default function presentPost (post, groupId) {
  if (!post) return null

  // Raw posts came directly from the API, not processed through the model extractor
  // Used in the chat room
  const rawPost = !post.ref

  try {
    const createdAtHumanDate = DateTimeHelpers.humanDate(post.createdAt)
    const editedAtHumanDate = DateTimeHelpers.humanDate(post.editedAt)

    const finalPost = {
      ...(rawPost ? post : post.ref),
      attachments: (rawPost ? post.attachments || [] : post.attachments.toModelArray()).sort((a, b) => a.position - b.position),
      createdTimestamp: createdAtHumanDate,
      creator: post.creator, // needed to load the creator object
      commenters: (rawPost ? post.commenters?.items || [] : post.commenters.toModelArray()),
      editedTimestamp: post.editedAt ? `Edited ${editedAtHumanDate}` : null,
      eventInvitations: (rawPost ? post.eventInvitations?.items || [] : post.eventInvitations.toModelArray()).map(eventInvitation => {
        return {
          response: eventInvitation.response,
          ...(rawPost ? eventInvitation.person : eventInvitation.person.ref)
        }
      }),
      exactCreatedTimestamp: DateTimeHelpers.toDateTime(post.createdAt, { locale: localeLocalStorageSync() }).toFormat('D t ZZZZ'),
      exactEditedTimestamp: DateTimeHelpers.toDateTime(post.editedAt, { locale: localeLocalStorageSync() }).toFormat('D t ZZZZ'),
      fileAttachments: (rawPost ? post.attachments || [] : post.attachments.toModelArray()).filter(a => a.type === 'file').sort((a, b) => a.position - b.position),
      imageAttachments: (rawPost ? post.attachments || [] : post.attachments.toModelArray()).filter(a => a.type === 'image').sort((a, b) => a.position - b.position),
      groups: (rawPost ? post.groups?.items || [] : post.groups.toModelArray()),
      linkPreview: post.linkPreview, // needed to load the link preview object
      location: post.location, // needed to load the location object
      members: (rawPost ? post.members?.items || [] : post.members.toModelArray()).map(person => {
        return {
          ...(rawPost ? person : person.ref),
          skills: (rawPost ? person.skills?.items || [] : person.skills.toModelArray())
        }
      }),
      proposalOptions: (rawPost ? post.proposalOptions?.items || [] : post.proposalOptions.toModelArray()),
      topics: (rawPost ? post.topics?.items || [] : post.topics.toModelArray()).map(topic => presentTopic(topic, {}))
    }
    return finalPost
  } catch (e) {
    console.log('error', e)
  }
}
