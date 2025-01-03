import { uniq } from 'lodash/fp'

export default function PostPresenter (post, forGroupId) {
  if (!post) return post

  const groupPostMembership = post.postMemberships.find(postMembership => {
    return Number(postMembership.group.id) === Number(forGroupId)
  })
  // if remote exists set url to remote, if not do the following
  const attachments = post.attachments.map(attachment => {
    const url = attachment?.url || attachment?.remote
    return { ...attachment, url, local: url }
  })
  const images = attachments.filter(attachment => attachment.type === 'image')
  const files = attachments.filter(attachment => attachment.type === 'file')

  return {
    ...post,
    attachments,
    images,
    files,
    fileUrls: uniq(files.map(file => file.url)),
    imageUrls: uniq(images.map(image => image.url)),
    pinned: groupPostMembership && groupPostMembership.pinned,
    startTime: post.startTime ? new Date(post.startTime) : post.startTime,
    endTime: post.endTime ? new Date(post.endTime) : post.endTime
    // TODO: URQL -- Doesn't seem to still be necessary, but confirm before removing
    // topics: post.topics.map(topic => presentTopic(topic, {}))
  }
}
