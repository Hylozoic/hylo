import { DateTime } from 'luxon'
import presentTopic from 'store/presenters/presentTopic'
import { TextHelpers } from '@hylo/shared'

export default function presentPost (post, groupId) {
  if (!post) return null

  // Raw posts came directly from the API, not processed through the model extractor
  // Used in the chat room
  const rawPost = !post.ref

  try {
    const createdAtHumanDate = TextHelpers.humanDate(post.createdAt)
    const editedAtHumanDate = TextHelpers.humanDate(post.editedAt)

    const finalPost = {
      ...(rawPost ? post : post.ref),
      attachments: (rawPost ? post.attachments || [] : post.attachments.toModelArray()).sort((a, b) => a.position - b.position),
      createdTimestamp: createdAtHumanDate,
      creator: post.creator, // needed to load the creator object
      commenters: (rawPost ? post.commenters?.items || [] : post.commenters.toModelArray()),
      completionResponses: (rawPost ? post.completionResponses?.items || [] : post.completionResponses?.toModelArray() || []),
      editedTimestamp: post.editedAt ? `Edited ${editedAtHumanDate}` : null,
      eventInvitations: (rawPost ? post.eventInvitations?.items || [] : post.eventInvitations.toModelArray()).map(eventInvitation => {
        return {
          response: eventInvitation.response,
          ...(rawPost ? eventInvitation.person : eventInvitation.person.ref)
        }
      }),
      exactCreatedTimestamp: DateTime.fromISO(post.createdAt).toFormat('D t ZZZZ'),
      exactEditedTimestamp: DateTime.fromISO(post.editedAt).toFormat('D t ZZZZ'),
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
