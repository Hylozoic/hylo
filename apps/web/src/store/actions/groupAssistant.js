/**
 * The Group Assistant (Axl): a private thread between a group's stewards and
 * an AI assistant. Every request is refused by the server unless the viewer
 * holds the Administration responsibility in the group.
 */
export const FETCH_GROUP_ASSISTANT = 'FETCH_GROUP_ASSISTANT'
export const ASK_GROUP_ASSISTANT = 'ASK_GROUP_ASSISTANT'
export const UPDATE_GROUP_ASSISTANT_SETTINGS = 'UPDATE_GROUP_ASSISTANT_SETTINGS'
export const MARK_GROUP_ASSISTANT_DRAFT_POSTED = 'MARK_GROUP_ASSISTANT_DRAFT_POSTED'

/**
 * payload.data.groupAssistant: { hasPro, configured, settings, spaces, stewards, messages }
 */
export function fetchGroupAssistant (groupId) {
  return {
    type: FETCH_GROUP_ASSISTANT,
    graphql: {
      query: `query GroupAssistant ($groupId: ID!) {
        groupAssistant(groupId: $groupId)
      }`,
      variables: { groupId }
    },
    meta: { groupId }
  }
}

/**
 * A steward writes in the thread and the assistant answers.
 * payload.data.askGroupAssistant: { messages: [theirs, the answer], usage }
 */
export function askGroupAssistant (groupId, text) {
  return {
    type: ASK_GROUP_ASSISTANT,
    graphql: {
      query: `mutation AskGroupAssistant ($groupId: ID!, $text: String!) {
        askGroupAssistant(groupId: $groupId, text: $text)
      }`,
      variables: { groupId, text }
    },
    meta: { groupId }
  }
}

/**
 * Saves some or all of the assistant's settings; fields left out keep their value.
 * payload.data.updateGroupAssistantSettings has the same shape as groupAssistant.
 */
export function updateGroupAssistantSettings (groupId, settings) {
  return {
    type: UPDATE_GROUP_ASSISTANT_SETTINGS,
    graphql: {
      query: `mutation UpdateGroupAssistantSettings ($groupId: ID!, $settings: JSON!) {
        updateGroupAssistantSettings(groupId: $groupId, settings: $settings)
      }`,
      variables: { groupId, settings }
    },
    meta: { groupId }
  }
}

/**
 * Records that the steward posted a draft, as the post or comment they just made.
 * payload.data.markGroupAssistantDraftPosted is the updated message.
 */
export function markGroupAssistantDraftPosted ({ messageId, partIndex, postId, commentId }) {
  return {
    type: MARK_GROUP_ASSISTANT_DRAFT_POSTED,
    graphql: {
      query: `mutation MarkGroupAssistantDraftPosted ($messageId: ID!, $partIndex: Int!, $postId: ID, $commentId: ID) {
        markGroupAssistantDraftPosted(messageId: $messageId, partIndex: $partIndex, postId: $postId, commentId: $commentId)
      }`,
      variables: { messageId, partIndex, postId, commentId }
    },
    meta: { messageId }
  }
}
