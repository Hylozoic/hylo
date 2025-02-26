import i18n from '../../i18n.mjs'
import { DateTime } from 'luxon'
import presentTopic from 'store/presenters/presentTopic'
import { TextHelpers } from '@hylo/shared'
import { getLocaleAsString } from 'components/Calendar/calendar-util'

export default function presentPost (post, groupId) {
  if (!post) return null

  const postMembership = post.postMemberships.toRefArray().find(p =>
    Number(p.group) === Number(groupId))
  const pinned = postMembership && postMembership.pinned
  const createdAtHumanDate = TextHelpers.humanDate(post.createdAt)
  const createdAtHumanDateShort = TextHelpers.humanDate(post.createdAt, true)
  const editedAtHumanDate = TextHelpers.humanDate(post.editedAt)

  return {
    ...post.ref,
    creator: post.creator,
    linkPreview: post.linkPreview,
    location: post.location,
    isPublic: post.isPublic,
    clickthrough: post.clickthrough,
    commenters: post.commenters.toModelArray(),
    groups: post.groups.toModelArray(),
    attachments: post.attachments
      .orderBy('position').toModelArray(),
    imageAttachments: post.attachments
      .orderBy('position').filter(a => a.type === 'image').toRefArray(),
    fileAttachments: post.attachments
      .orderBy('position').filter(a => a.type === 'file').toModelArray(),
    pinned,
    topics: post.topics.toModelArray().map(topic => presentTopic(topic, {})),
    members: post.members.toModelArray().map(person => {
      return {
        ...person.ref,
        skills: person.skills.toRefArray()
      }
    }),
    eventInvitations: post.eventInvitations.toModelArray().map(eventInvitation => {
      return {
        response: eventInvitation.response,
        ...eventInvitation.person.ref
      }
    }),
    proposalOptions: post.proposalOptions?.toModelArray() || [],
    createdTimestampForGrid: createdAtHumanDateShort,
    createdTimestamp: `${i18n.t('Posted')} ${createdAtHumanDate}`,
    editedTimestamp: post.editedAt ? `${i18n.t('Edited')} ${editedAtHumanDate}` : null,
    exactCreatedTimestamp: DateTime.fromISO(post.createdAt).setLocale(getLocaleAsString()).toFormat('D t ZZZZ'),
    exactEditedTimestamp: DateTime.fromISO(post.editedAt).setLocale(getLocaleAsString()).toFormat('D t ZZZZ')
  }
}
