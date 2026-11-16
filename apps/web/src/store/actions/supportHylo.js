// GraphQL actions for Hylo supporter badges and the Support Hylo flow (#1754).
// None of these extract models: the screens using them keep the results in local state.

export const FETCH_SUPPORT_HYLO = 'FETCH_SUPPORT_HYLO'
export const CHECK_OPEN_COLLECTIVE_CONTRIBUTIONS = 'CHECK_OPEN_COLLECTIVE_CONTRIBUTIONS'
export const ATTRIBUTE_SUPPORT_CONTRIBUTION = 'ATTRIBUTE_SUPPORT_CONTRIBUTION'
export const SET_SUPPORTER_BADGE_VISIBILITY = 'SET_SUPPORTER_BADGE_VISIBILITY'
export const FETCH_GROUP_SUPPORTER_INFO = 'FETCH_GROUP_SUPPORTER_INFO'
export const CREATE_SUPPORT_INTENT = 'CREATE_SUPPORT_INTENT'
export const CONFIRM_SUPPORT_INTENT = 'CONFIRM_SUPPORT_INTENT'
export const FETCH_SUPPORTER_GRANTS = 'FETCH_SUPPORTER_GRANTS'
export const GRANT_SUPPORTER_STATUS = 'GRANT_SUPPORTER_STATUS'
export const REVOKE_SUPPORTER_STATUS = 'REVOKE_SUPPORTER_STATUS'
export const SEARCH_GROUPS_FOR_SUPPORTER_GRANT = 'SEARCH_GROUPS_FOR_SUPPORTER_GRANT'

export function fetchSupportHylo () {
  return {
    type: FETCH_SUPPORT_HYLO,
    graphql: {
      query: `query SupportHylo {
        supportHylo {
          checkAvailable
          supporterStatus
          showSupporterBadge
          hasIncognitoContributions
          manualGrant
          manualGrantExpiresAt
          contributions {
            id
            frequency
            status
            createdAt
            lastChargedAt
            isIncognito
            qualifies
            group { id name }
          }
          adminGroups { id name slug avatarUrl }
        }
      }`
    }
  }
}

export function checkOpenCollectiveContributions () {
  return {
    type: CHECK_OPEN_COLLECTIVE_CONTRIBUTIONS,
    graphql: {
      query: `mutation CheckOpenCollectiveContributions {
        checkOpenCollectiveContributions { found linkedCount linkedElsewhere supporterStatus }
      }`
    }
  }
}

export function attributeSupportContribution (contributionId, groupId) {
  return {
    type: ATTRIBUTE_SUPPORT_CONTRIBUTION,
    graphql: {
      query: `mutation AttributeSupportContribution ($contributionId: ID!, $groupId: ID) {
        attributeSupportContribution(contributionId: $contributionId, groupId: $groupId) { id group { id name } }
      }`,
      variables: { contributionId, groupId: groupId || null }
    }
  }
}

export function setSupporterBadgeVisibility ({ groupId, show }) {
  return {
    type: SET_SUPPORTER_BADGE_VISIBILITY,
    graphql: {
      query: `mutation SetSupporterBadgeVisibility ($groupId: ID, $show: Boolean!) {
        setSupporterBadgeVisibility(groupId: $groupId, show: $show)
      }`,
      variables: { groupId: groupId || null, show: !!show }
    }
  }
}

export function fetchGroupSupporterInfo (groupId) {
  return {
    type: FETCH_GROUP_SUPPORTER_INFO,
    graphql: {
      query: `query GroupSupporterInfo ($groupId: ID!) {
        groupSupporterInfo(groupId: $groupId) { supporterStatus showSupporterBadge }
      }`,
      variables: { groupId }
    }
  }
}

export function createSupportIntent (groupId) {
  return {
    type: CREATE_SUPPORT_INTENT,
    graphql: {
      query: `mutation CreateSupportIntent ($groupId: ID) {
        createSupportIntent(groupId: $groupId) { token tag }
      }`,
      variables: { groupId: groupId || null }
    }
  }
}

export function confirmSupportIntent (orderId) {
  return {
    type: CONFIRM_SUPPORT_INTENT,
    graphql: {
      query: `mutation ConfirmSupportIntent ($orderId: String!) {
        confirmSupportIntent(orderId: $orderId) { outcome supporterStatus group { id name slug } }
      }`,
      variables: { orderId }
    }
  }
}

export function fetchSupporterGrants () {
  return {
    type: FETCH_SUPPORTER_GRANTS,
    graphql: {
      query: `query SupporterGrants {
        supporterGrants {
          id
          note
          expiresAt
          createdAt
          user { id name avatarUrl }
          group { id name slug avatarUrl }
          grantedBy { id name }
        }
      }`
    }
  }
}

export function grantSupporterStatus ({ userId, groupId, note, expiresAt }) {
  return {
    type: GRANT_SUPPORTER_STATUS,
    graphql: {
      query: `mutation GrantSupporterStatus ($userId: ID, $groupId: ID, $note: String, $expiresAt: Date) {
        grantSupporterStatus(userId: $userId, groupId: $groupId, note: $note, expiresAt: $expiresAt) { id }
      }`,
      variables: { userId: userId || null, groupId: groupId || null, note: note || null, expiresAt: expiresAt || null }
    }
  }
}

export function revokeSupporterStatus (id) {
  return {
    type: REVOKE_SUPPORTER_STATUS,
    graphql: {
      query: `mutation RevokeSupporterStatus ($id: ID!) {
        revokeSupporterStatus(id: $id)
      }`,
      variables: { id }
    }
  }
}

export function searchGroupsForSupporterGrant (autocomplete) {
  return {
    type: SEARCH_GROUPS_FOR_SUPPORTER_GRANT,
    graphql: {
      query: `query SearchGroupsForSupporterGrant ($autocomplete: String) {
        groups(autocomplete: $autocomplete, first: 10) {
          items { id name slug avatarUrl }
        }
      }`,
      variables: { autocomplete }
    }
  }
}

// GraphQL errors can come back as a rejected action or as payload errors (see graphqlMiddleware)
export function supportErrorCode (resultOrError) {
  const errors = resultOrError?.payload?.errors || resultOrError?.errors
  const error = Array.isArray(errors) ? errors[0] : (resultOrError instanceof Error ? resultOrError : null)
  return error?.extensions?.code || error?.code || (error ? 'UNKNOWN' : null)
}
