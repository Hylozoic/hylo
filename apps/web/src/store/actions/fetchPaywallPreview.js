export const FETCH_PAYWALL_PREVIEW = 'FETCH_PAYWALL_PREVIEW'

/**
 * Titles-only preview of a paid group or space, for someone deciding whether to buy.
 * The server returns null when the steward turned the preview off.
 */
export default function fetchPaywallPreview ({ groupId }) {
  return {
    type: FETCH_PAYWALL_PREVIEW,
    graphql: {
      query: `
        query PaywallPreview ($id: ID) {
          group(id: $id) {
            id
            paywallPreview {
              postTitles
              actionTitles
              numActions
              numPeopleCompleted
            }
          }
        }
      `,
      variables: { id: groupId }
    }
  }
}
