import { get, uniqueId } from 'lodash/fp'
import { TextHelpers, AnalyticsEvents } from '@hylo/shared'
import createPostMutation from '@graphql/mutations/createPostMutation'
import { CREATE_POST } from 'store/constants'

export default function createPost (postParams) {
  const query = createPostMutation

  const {
    acceptContributions,
    completionAction,
    completionActionSettings,
    details,
    donationsLink,
    endTime,
    eventInviteeIds = [],
    fileUrls,
    fundingRoundId,
    groups,
    imageUrls,
    linkPreview,
    linkPreviewFeatured,
    localId,
    location,
    locationId,
    memberIds = [],
    isAnonymousVote,
    isPublic,
    isStrictProposal,
    projectManagementLink,
    proposalOptions,
    votingMethod,
    quorum,
    sendAnnouncement,
    startTime,
    timezone,
    title,
    topicNames,
    trackId,
    type
  } = postParams
  const linkPreviewId = linkPreview && linkPreview.id
  const groupIds = groups.map(c => c.id)

  return {
    type: CREATE_POST,
    graphql: {
      query,
      variables: {
        acceptContributions,
        announcement: sendAnnouncement,
        completionAction,
        completionActionSettings,
        details,
        donationsLink,
        endTime: endTime && endTime.valueOf(),
        eventInviteeIds,
        fileUrls,
        fundingRoundId,
        groupIds,
        imageUrls,
        isAnonymousVote,
        isPublic,
        isStrictProposal,
        linkPreviewId,
        linkPreviewFeatured,
        localId: localId || uniqueId('post_'), // to match the optimistically created post and replace it with the real one
        location,
        locationId,
        memberIds,
        projectManagementLink,
        proposalOptions,
        votingMethod,
        quorum,
        startTime: startTime && startTime.valueOf(),
        timezone,
        title,
        topicNames,
        trackId,
        type
      }
    },
    meta: {
      extractModel: {
        modelName: 'Post',
        getRoot: get('createPost')
      },
      analytics: {
        eventName: AnalyticsEvents.POST_CREATED,
        detailsLength: TextHelpers.textLengthHTML(details),
        fundingRoundId,
        groupId: groupIds,
        isAnnouncement: sendAnnouncement,
        isPublic,
        topics: topicNames,
        trackId,
        type
      },
      type,
      fundingRoundId,
      groupIds,
      trackId
    }
  }
}
