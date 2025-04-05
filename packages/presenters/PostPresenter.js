import { uniq } from 'lodash/fp'
import { butterflyBush, caribbeanGreen, fakeAlpha, flushOrange, gold, pictonBlue, sunsetOrange } from 'style/colors'

// TODO: Confirm that this presenter is idempotent and reconcile/merge transformations with
// Mobile PostEditor.store, etc
export default function PostPresenter (post, { forGroupId } = {}) {
  if (!post) return post

  return {
    ...post,
    getAttachments: () => attachmentsResolver(post),
    getImages: () => imagesResolver(post),
    getFiles: () => filesResolver(post),
    getFileUrls: () => uniq(filesResolver(post).map(file => file.url)),
    getImageUrls: () => uniq(imagesResolver(post).map(image => image.url)),
    // TODO: Research and reconcile start and endTimeRaw with their incoming values, both are currently
    // used and I don't yet know when to use which. If "raw" values are needed then pass them through
    // as their default name (e.g "startTime" and "endTime") and use get* or some other naming for
    // the presented values.
    startTime: post.startTime ? new Date(post.startTime) : post.startTime,
    endTime: post.endTime ? new Date(post.endTime) : post.endTime,
    startTimeRaw: post.startTime,
    endTimeRaw: post.endTime,
    _presented: true
  }
}

export const attachmentsResolver = post => {
  // if remote exists set url to remote, if not do the following
  return post.attachments.map(attachment => {
    const url = attachment?.url || attachment?.remote
    return { ...attachment, url, local: attachment.local || url }
  })
}

export const imagesResolver = post => {
  return attachmentsResolver(post).filter(attachment => attachment.type === 'image')
}

export const filesResolver = post => {
  return attachmentsResolver(post).filter(attachment => attachment.type === 'file')
}

export const DEFAULT_POST_TYPE = 'discussion'

export const POST_TYPES = {
  discussion: {
    primaryColor: pictonBlue,
    iconName: 'Chat',
    backgroundColor: fakeAlpha(pictonBlue, 0.2),
    map: false
  },
  event: {
    primaryColor: sunsetOrange,
    iconName: 'Calendar',
    backgroundColor: fakeAlpha(sunsetOrange, 0.2),
    map: true
  },
  offer: {
    primaryColor: caribbeanGreen,
    iconName: 'Gift',
    backgroundColor: fakeAlpha(caribbeanGreen, 0.2),
    map: true
  },
  project: {
    primaryColor: flushOrange,
    iconName: 'Project',
    backgroundColor: fakeAlpha(flushOrange, 0.2),
    map: false
  },
  proposal: {
    primaryColor: butterflyBush,
    iconName: 'Proposal',
    backgroundColor: fakeAlpha(butterflyBush, 0.2),
    map: true
  },
  request: {
    primaryColor: caribbeanGreen,
    iconName: 'HandRaised',
    backgroundColor: fakeAlpha(caribbeanGreen, 0.2),
    map: true
  },
  resource: {
    primaryColor: gold,
    iconName: 'Resource',
    backgroundColor: fakeAlpha(gold, 0.2),
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
