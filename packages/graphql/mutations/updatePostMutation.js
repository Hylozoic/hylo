import { gql } from 'urql'
import postFieldsFragment from '../fragments/postFieldsFragment'

// TODO: URQL - analytics:
// analytics: {
//   eventName: AnalyticsEvents.POST_UPDATED,
//   detailsLength: TextHelpers.textLengthHTML(details),
//   groupId: groupIds,
//   isPublic,
//   topics: topicNames,
//   type
// }

export default gql`
  mutation UpdatePostMutation (
    $id: ID,
    $type: String,
    $title: String,
    $details: String,
    $linkPreviewId: String,
    $linkPreviewFeatured: Boolean,
    $groupIds: [ID],
    $imageUrls: [String],
    $fileUrls: [String],
    $topicNames: [String],
    $memberIds: [ID],
    $acceptContributions: Boolean,
    $donationsLink: String,
    $projectManagementLink: String,
    $eventInviteeIds: [ID],
    $startTime: Date,
    $endTime: Date,
    $timezone: String,
    $location: String,
    $locationId: ID,
    $isPublic: Boolean
  ) {
    updatePost(id: $id, data: {
      type: $type,
      title: $title,
      details: $details,
      linkPreviewId: $linkPreviewId,
      linkPreviewFeatured: $linkPreviewFeatured,
      groupIds: $groupIds,
      imageUrls: $imageUrls,
      fileUrls: $fileUrls,
      topicNames: $topicNames,
      memberIds: $memberIds,
      acceptContributions: $acceptContributions,
      donationsLink: $donationsLink,
      projectManagementLink: $projectManagementLink,
      eventInviteeIds: $eventInviteeIds,
      startTime: $startTime,
      endTime: $endTime,
      timezone: $timezone,
      location: $location,
      locationId: $locationId,
      isPublic: $isPublic
    }) {
      ...PostFieldsFragment
    }
  }
  ${postFieldsFragment}
`
