import presentTopic from 'store/presenters/presentTopic'

export default function presentPost (post, forGroupId) {
  if (!post) return null

  const groupPostMembership = post.postMemberships.toRefArray().find(postMembership => {
    return Number(postMembership.group) === Number(forGroupId)
  })
  const pinnedInGroup = groupPostMembership && groupPostMembership.pinned

  return {
    ...post.ref,
    attachments: post.attachments
      .orderBy('position').toModelArray(),
    clickthrough: post.clickthrough,
    creator: post.creator,
    commenters: post.commenters.toModelArray(),
    eventInvitations: post.eventInvitations.toModelArray().map(eventInvitation => {
      return {
        response: eventInvitation.response,
        ...eventInvitation.person.ref
      }
    }),
    fileAttachments: post.attachments
      .orderBy('position').filter(a => a.type === 'file').toModelArray(),
    fileUrls: post.getFileUrls(),
    groups: post.groups.toModelArray(),
    imageUrls: post.getImageUrls(),
    isPublic: post.isPublic,
    linkPreview: post.linkPreview,
    location: post.location,
    members: post.members.toModelArray().map(person => {
      return {
        ...person.ref,
        skills: person.skills.toRefArray()
      }
    }),
    pinned: pinnedInGroup,
    topics: post.topics.toModelArray().map(topic => presentTopic(topic, {}))
  }
}
