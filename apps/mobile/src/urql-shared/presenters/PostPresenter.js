import { uniq } from 'lodash/fp'

export default function PostPresenter (postFromQuery, forGroupId) {
  if (!postFromQuery) return postFromQuery

  const groupPostMembership = postFromQuery.postMemberships.find(postMembership => {
    return Number(postMembership.group) === Number(forGroupId)
  })
  // if remote exists set url to remote, if not do the following
  const attachments = postFromQuery.attachments.map(attachment => {
    const url = attachment?.url || attachment?.remote
    return { ...attachment, url, local: url }
  })
  const images = attachments.filter(attachment => attachment.type === 'image')
  const files = attachments.filter(attachment => attachment.type === 'file')

  return {
    ...postFromQuery,
    attachments,
    images,
    files,
    fileUrls: uniq(files.map(file => file.url)),
    imageUrls: uniq(images.map(image => image.url)),
    pinned: groupPostMembership && groupPostMembership.pinned,
    startTime: postFromQuery.startTime ? new Date(postFromQuery.startTime) : postFromQuery.startTime,
    endTime: postFromQuery.endTime ? new Date(postFromQuery.endTime) : postFromQuery.endTime
    // TODO: Doesn't seem to still be necessary, but confirm before removing
    // topics: post.topics.map(topic => presentTopic(topic, {}))
  }
}
