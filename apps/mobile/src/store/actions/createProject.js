// TODO: URLQ - this is no longer used, but analytics still need to be translated

import { get } from 'lodash/fp'
import { TextHelpers, AnalyticsEvents } from '@hylo/shared'
import createProjectMutation from 'graphql/mutations/createProjectMutation'
import { CREATE_PROJECT } from 'store/constants'

export default function createProject (postParams) {
  const {
    type,
    title,
    details,
    groups,
    linkPreview,
    imageUrls,
    fileUrls,
    topicNames,
    sendAnnouncement,
    memberIds = [],
    acceptContributions,
    donationsLink,
    projectManagementLink,
    isPublic
  } = postParams
  const linkPreviewId = linkPreview && linkPreview.id
  const groupIds = groups.map(c => c.id)

  return {
    type: CREATE_PROJECT,
    graphql: {
      query: createProjectMutation,
      variables: {
        type,
        title,
        details,
        linkPreviewId,
        groupIds,
        imageUrls,
        fileUrls,
        announcement: sendAnnouncement,
        topicNames,
        memberIds,
        acceptContributions,
        donationsLink,
        projectManagementLink,
        isPublic
      }
    },
    meta: {
      extractModel: {
        modelName: 'Post',
        getRoot: get('createProject')
      },
      analytics: {
        eventName: AnalyticsEvents.POST_CREATED,
        detailsLength: TextHelpers.textLengthHTML(details),
        isAnnouncement: sendAnnouncement
      }
    }
  }
}
