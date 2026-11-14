export const DESIGN_GROUP_VIEW_TURN = 'DESIGN_GROUP_VIEW_TURN'

/**
 * One turn of the "Design your own view" chat. `messages` is the conversation
 * so far, ending with the steward's new message; `currentView` is the design
 * being edited, if any; `images` is what the steward has uploaded for the page,
 * [{ url, name }], the only images the AI may place; `documents` is the PDFs they
 * attached, [{ url, name }]. The AI is shown both so it can read them. `postIds` is the
 * posts from the group they picked to build the page around. Nothing is saved: the response
 * (payload.data.designGroupViewTurn) holds the AI's reply, the whole page as
 * building blocks, and the token usage and estimated cost.
 */
export default function designGroupViewTurn (groupId, messages, currentView = null, images = [], documents = [], postIds = []) {
  return {
    type: DESIGN_GROUP_VIEW_TURN,
    graphql: {
      query: `mutation DesignGroupViewTurn ($groupId: ID!, $messages: JSON!, $currentView: JSON, $images: JSON, $documents: JSON, $postIds: [ID]) {
        designGroupViewTurn(groupId: $groupId, messages: $messages, currentView: $currentView, images: $images, documents: $documents, postIds: $postIds)
      }`,
      variables: {
        groupId,
        messages,
        currentView,
        images,
        documents,
        postIds
      }
    },
    meta: {
      groupId
    }
  }
}
