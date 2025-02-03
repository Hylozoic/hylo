import { uniq } from 'lodash/fp'
import { butterflyBush, caribbeanGreen, fakeAlpha, flushOrange, gold, pictonBlue, sunsetOrange } from 'style/colors'

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
    endTime: post.endTime ? new Date(post.endTime) : post.endTime,
    startTimeRaw: post.startTime,
    endTimeRaw: post.endTime,
    // TODO: URQL -- Doesn't seem to still be necessary, but confirm before removing
    // topics: post.topics.map(topic => presentTopic(topic, {}))
  }
}

export const POST_TYPES = {
  discussion: {
    primaryColor: pictonBlue,
    backgroundColor: fakeAlpha(pictonBlue, 0.2),
    map: false
  },
  event: {
    primaryColor: sunsetOrange,
    backgroundColor: fakeAlpha(sunsetOrange, 0.2),
    map: true
  },
  offer: {
    primaryColor: caribbeanGreen,
    backgroundColor: fakeAlpha(caribbeanGreen, 0.2),
    map: true
  },
  resource: {
    primaryColor: gold,
    backgroundColor: fakeAlpha(gold, 0.2),
    map: true
  },
  project: {
    primaryColor: flushOrange,
    backgroundColor: fakeAlpha(flushOrange, 0.2),
    map: false
  },
  request: {
    primaryColor: caribbeanGreen,
    backgroundColor: fakeAlpha(caribbeanGreen, 0.2),
    map: true
  },
  proposal: {
    primaryColor: butterflyBush,
    backgroundColor: fakeAlpha(butterflyBush, 0.2),
    map: true
  }
}

// proposal status
export const PROPOSAL_STATUS_DISCUSSION = 'discussion'
export const PROPOSAL_STATUS_VOTING = 'voting'
export const PROPOSAL_STATUS_CASUAL = 'casual'
export const PROPOSAL_STATUS_COMPLETED = 'completed'

// Voting methods
export const VOTING_METHOD_SINGLE = 'single'
export const VOTING_METHOD_MULTI_UNRESTRICTED = 'multi-unrestricted'
