import { gql } from 'urql'
import postFieldsFragment from 'graphql/fragments/postFieldsFragment'

export default gql`
  mutation (
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
    }) {
      ...PostFieldsFragment
    }
    ${postFieldsFragment}
  }
`
