export const DESIGN_GROUP_VIEW_TURN = 'DESIGN_GROUP_VIEW_TURN'

/**
 * One turn of the "Design your own view" chat. `messages` is the conversation
 * so far, ending with the steward's new message; `currentView` is the design
 * being edited, if any; `images` is what the steward has uploaded for the page,
 * [{ url, name }], the only images the AI may place. Nothing is saved: the response
 * (payload.data.designGroupViewTurn) holds the AI's reply, the whole page as
 * building blocks, and the token usage and estimated cost.
 */
export default function designGroupViewTurn (groupId, messages, currentView = null, images = []) {
  return {
    type: DESIGN_GROUP_VIEW_TURN,
    graphql: {
      query: `mutation DesignGroupViewTurn ($groupId: ID!, $messages: JSON!, $currentView: JSON, $images: JSON) {
        designGroupViewTurn(groupId: $groupId, messages: $messages, currentView: $currentView, images: $images)
      }`,
      variables: {
        groupId,
        messages,
        currentView,
        images
      }
    },
    meta: {
      groupId
    }
  }
}
