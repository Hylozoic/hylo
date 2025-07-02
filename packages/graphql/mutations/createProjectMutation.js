import { gql } from 'urql'
import postFieldsFragment from '../fragments/postFieldsFragment'

// TODO: URQL - analytics
// analytics: {
//   eventName: AnalyticsEvents.POST_CREATED,
//   detailsLength: TextHelpers.textLengthHTML(details),
//   isAnnouncement: sendAnnouncement
// }

export default gql`
  mutation CreateProjectMutation (
    $title: String
    $details: String
    $linkPreviewId: String
    $groupIds: [ID]
    $imageUrls: [String]
    $fileUrls: [String]
    $announcement: Boolean
    $isPublic: Boolean
    $topicNames: [String]
    $memberIds: [ID]
    $acceptContributions: Boolean
    $donationsLink: String
    $projectManagementLink: String
    $startTime: Date
    $endTime: Date
    $timezone: String
  ) {
    createProject(data: {
      title: $title
      details: $details
      linkPreviewId: $linkPreviewId
      groupIds: $groupIds
      imageUrls: $imageUrls
      fileUrls: $fileUrls
      announcement: $announcement
      isPublic: $isPublic
      topicNames: $topicNames
      memberIds: $memberIds
      acceptContributions: $acceptContributions
      donationsLink: $donationsLink
      projectManagementLink: $projectManagementLink
      startTime: $startTime
      endTime: $endTime
      timezone: $timezone
    }) {
      ...PostFieldsFragment
    }
  }
  ${postFieldsFragment}
`
