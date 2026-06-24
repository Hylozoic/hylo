import {
  DELETE_DRAFT,
  FETCH_DRAFT,
  FETCH_MY_DRAFTS,
  REMOVE_DRAFT,
  REMOVE_DRAFT_BY_CONTEXT,
  SAVE_DRAFT
} from 'store/constants'

const draftFields = `
  id
  type
  data
  groupId
  topicId
  postId
  messageThreadId
  postType
  isEdit
  navigateTo
  updatedAt
  group { id name slug }
  post { id }
  messageThread {
    id
    participants(first: 8) { id name }
  }
`

export function fetchMyDrafts () {
  return {
    type: FETCH_MY_DRAFTS,
    graphql: {
      query: `query FetchMyDrafts {
        myDrafts {
          ${draftFields}
        }
      }`
    },
    meta: {
      replaceAllDrafts: true,
      extractModel: {
        getRoot: data => data.myDrafts,
        modelName: 'Draft',
        append: false
      }
    }
  }
}

export function fetchDraft ({ type, postId, groupId, topicId, messageThreadId, postType, isEdit }) {
  return {
    type: FETCH_DRAFT,
    graphql: {
      query: `query FetchDraft($type: String, $postId: ID, $groupId: ID, $topicId: ID, $messageThreadId: ID, $postType: String, $isEdit: Boolean) {
        draft(type: $type, postId: $postId, groupId: $groupId, topicId: $topicId, messageThreadId: $messageThreadId, postType: $postType, isEdit: $isEdit) {
          ${draftFields}
        }
      }`,
      variables: { type, postId, groupId, topicId, messageThreadId, postType, isEdit }
    },
    meta: {
      extractModel: {
        getRoot: data => data.draft,
        modelName: 'Draft',
        append: true
      }
    }
  }
}

export function saveDraft ({ type, data, postId, groupId, topicId, messageThreadId, postType, isEdit, navigateTo }) {
  return {
    type: SAVE_DRAFT,
    graphql: {
      query: `mutation SaveDraft($type: String!, $data: String!, $postId: ID, $groupId: ID, $topicId: ID, $messageThreadId: ID, $postType: String, $isEdit: Boolean, $navigateTo: String) {
        saveDraft(type: $type, data: $data, postId: $postId, groupId: $groupId, topicId: $topicId, messageThreadId: $messageThreadId, postType: $postType, isEdit: $isEdit, navigateTo: $navigateTo) {
          ${draftFields}
        }
      }`,
      variables: { type, data, postId, groupId, topicId, messageThreadId, postType, isEdit, navigateTo }
    },
    meta: {
      extractModel: {
        getRoot: data => data.saveDraft,
        modelName: 'Draft',
        append: true
      }
    }
  }
}

export function deleteDraft (id) {
  return {
    type: DELETE_DRAFT,
    graphql: {
      query: `mutation DeleteDraft($id: ID!) {
        deleteDraft(id: $id) {
          success
        }
      }`,
      variables: { id }
    },
    meta: { id }
  }
}

export function removeDraft (id) {
  return {
    type: REMOVE_DRAFT,
    meta: { id }
  }
}

export function removeDraftByContext ({ type, postId, groupId, topicId, messageThreadId, postType, isEdit }) {
  return {
    type: REMOVE_DRAFT_BY_CONTEXT,
    meta: { type, postId, groupId, topicId, messageThreadId, postType, isEdit }
  }
}
