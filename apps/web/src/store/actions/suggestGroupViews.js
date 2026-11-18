export const SUGGEST_GROUP_VIEWS = 'SUGGEST_GROUP_VIEWS'

/**
 * Asks the AI for views that would help a group grow, based on the group's
 * purpose, size, post counts and the titles of its recent posts and coming
 * events. The response (payload.data.suggestGroupViews) holds a short reply,
 * suggestions [{ name, why, prompt }] and the token usage; a suggestion's
 * prompt can be sent as the first message of a design.
 */
export default function suggestGroupViews (groupId) {
  return {
    type: SUGGEST_GROUP_VIEWS,
    graphql: {
      query: `mutation SuggestGroupViews ($groupId: ID!) {
        suggestGroupViews(groupId: $groupId)
      }`,
      variables: { groupId }
    },
    meta: { groupId }
  }
}
