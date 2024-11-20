import { gql } from 'urql'
import postFieldsFragment from 'graphql/fragments/postFieldsFragment'

export default gql`
  mutation CreatePostMutation (
    $type: String,
    $title: String,
    $details: String,
    $linkPreviewId: String,
    $linkPreviewFeatured: Boolean,
    $groupIds: [ID],
    $imageUrls: [String],
    $fileUrls: [String],
    $announcement: Boolean,
    $topicNames: [String],
    $acceptContributions: Boolean,
    $donationsLink: String,
    $projectManagementLink: String,
    $eventInviteeIds: [ID],
    $memberIds: [ID],
    $startTime: Date,
    $endTime: Date,
    $location: String,
    $locationId: ID,
    $isPublic: Boolean
  ) {
    createPost(data: {
      type: $type,
      title: $title,
      details: $details,
      linkPreviewId: $linkPreviewId,
      linkPreviewFeatured: $linkPreviewFeatured,
      groupIds: $groupIds,
      imageUrls: $imageUrls,
      fileUrls: $fileUrls,
      announcement: $announcement,
      topicNames: $topicNames,
      acceptContributions: $acceptContributions,
      donationsLink: $donationsLink,
      projectManagementLink: $projectManagementLink,
      eventInviteeIds: $eventInviteeIds,
      memberIds: $memberIds,
      startTime: $startTime,
      endTime: $endTime,
      location: $location,
      locationId: $locationId,
      isPublic: $isPublic
    }) {
      ...PostFieldsFragment
    }
  }
  ${postFieldsFragment}
`
