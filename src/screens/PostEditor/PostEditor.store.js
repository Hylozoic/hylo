import { get } from 'lodash/fp'
import { divToP, textLength } from 'hylo-utils/text'
import { AnalyticsEvents } from 'hylo-utils/constants'
import postFieldsFragment from 'graphql/fragments/postFieldsFragment'

export const MODULE_NAME = 'PostEditor'
export const CREATE_POST = `${MODULE_NAME}/CREATE_POST`
export const CREATE_PROJECT = `${MODULE_NAME}/CREATE_PROJECT`

export const UPDATE_POST = `${MODULE_NAME}/UPDATE_POST`
export const UPDATE_POST_PENDING = `${UPDATE_POST}_PENDING`

export const MAX_TITLE_LENGTH = 100

export const projectEndpointFragment = `createProject(data: {
  title: $title
  details: $details
  groupIds: $groupIds
  imageUrls: $imageUrls
  fileUrls: $fileUrls
  announcement: $announcement
  topicNames: $topicNames
  memberIds: $memberIds
})`

export function createPost (post) {
  const {
    type,
    title,
    details,
    groups,
    startTime,
    endTime,
    location,
    locationId,
    imageUrls = [],
    fileUrls = [],
    topicNames = [],
    memberIds = [],
    sendAnnouncement
  } = post
  const groupIds = groups.map(c => c.id)
  const preprocessedDetails = divToP(details)
  return {
    type: CREATE_POST,
    graphql: {
      query: `mutation (
        $type: String
        $title: String
        $details: String
        $groupIds: [String]
        $startTime: Date
        $endTime: Date
        $location: String
        $locationId: ID
        $imageUrls: [String]
        $fileUrls: [String]
        $announcement: Boolean
        $topicNames: [String]
        $memberIds: [ID]        
      ) {
        createPost(data: {
          type: $type
          title: $title
          details: $details
          groupIds: $groupIds
          startTime: $startTime
          endTime: $endTime
          location: $location
          locationId: $locationId
          imageUrls: $imageUrls
          fileUrls: $fileUrls
          announcement: $announcement
          topicNames: $topicNames
          memberIds: $memberIds
        }) {
          ${postFieldsFragment(false)}
        }
      }`,
      variables: {
        type,
        title,
        details: preprocessedDetails,
        groupIds,
        startTime,
        endTime,
        location,
        locationId,
        imageUrls,
        fileUrls,
        announcement: sendAnnouncement,
        topicNames,
        memberIds
      }
    },
    meta: {
      extractModel: 'Post',
      analytics: {
        eventName: AnalyticsEvents.POST_CREATED,
        detailsLength: textLength(preprocessedDetails),
        isAnnouncement: sendAnnouncement
      }
    }
  }
}

export function createProject (post) {
  const {
    title,
    details,
    groups,
    startTime,
    endTime,
    location,
    locationId,
    imageUrls = [],
    fileUrls = [],
    topicNames = [],
    memberIds = [],
    sendAnnouncement
  } = post
  const groupIds = groups.map(c => c.id)
  const preprocessedDetails = divToP(details)
  return {
    type: CREATE_PROJECT,
    graphql: {
      query: `mutation (
        $title: String
        $details: String
        $groupIds: [String]
        $startTime: Date
        $endTime: Date
        $location: String
        $locationId: ID
        $imageUrls: [String]
        $fileUrls: [String]
        $announcement: Boolean
        $topicNames: [String]
        $memberIds: [ID]        
      ) {
        createProject(data: {
          title: $title
          details: $details
          groupIds: $groupIds
          startTime: $startTime
          endTime: $endTime
          location: $location
          locationId: $locationId
          imageUrls: $imageUrls
          fileUrls: $fileUrls
          announcement: $announcement
          topicNames: $topicNames
          memberIds: $memberIds
        }) {
          ${postFieldsFragment(false)}
        }
      }`,
      variables: {
        title,
        details: preprocessedDetails,
        groupIds,
        startTime,
        endTime,
        location,
        locationId,
        imageUrls,
        fileUrls,
        announcement: sendAnnouncement,
        topicNames,
        memberIds
      }
    },
    meta: {
      extractModel: 'Post',
      analytics: {
        eventName: AnalyticsEvents.POST_CREATED,
        detailsLength: textLength(preprocessedDetails),
        isAnnouncement: sendAnnouncement
      }
    }
  }
}

export function updatePost (post) {
  const {
    id,
    type,
    title,
    details,
    groups,
    startTime,
    endTime,
    location,
    locationId,
    imageUrls = [],
    fileUrls = [],
    topicNames = [],
    memberIds = []
  } = post
  const groupIds = groups.map(c => c.id)
  const preprocessedDetails = divToP(details)
  return {
    type: UPDATE_POST,
    graphql: {
      query: `mutation ($id: ID
        $type: String
        $title: String
        $details: String
        $groupIds: [String]
        $startTime: Date
        $endTime: Date
        $location: String
        $locationId: ID
        $imageUrls: [String]
        $fileUrls: [String]
        $topicNames: [String]
        $memberIds: [ID]        
      ) {
        updatePost(id: $id, data: {
          type: $type
          title: $title
          details: $details
          groupIds: $groupIds
          startTime: $startTime
          endTime: $endTime
          location: $location
          locationId: $locationId
          imageUrls: $imageUrls
          fileUrls: $fileUrls
          topicNames: $topicNames
          memberIds: $memberIds
        }) {
          ${postFieldsFragment(true)}
        }
      }`,
      variables: {
        id,
        type,
        title,
        details: preprocessedDetails,
        groupIds,
        startTime,
        endTime,
        location,
        locationId,
        imageUrls,
        fileUrls,
        topicNames,
        memberIds
      }
    },
    meta: {
      extractModel: {
        modelName: 'Post',
        getRoot: get('updatePost'),
        append: false
      },
      analytics: {
        eventName: AnalyticsEvents.POST_UPDATED,
        detailsLength: textLength(preprocessedDetails)
      }
    }
  }
}

export default function reducer (state = {}, action) {
  switch (action.type) {
  }
  return state
}

export function ormSessionReducer (session, action) {
  const { type, meta } = action
  if (type === UPDATE_POST_PENDING) {
    // deleting all attachments and topics here because we restore them from the result of the UPDATE_POST action
    const post = session.Post.withId(meta.graphql.variables.id)
    post.attachments.delete()
    post.update({ topics: [] })
  }
}
