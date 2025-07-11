import { UPDATE_MEMBERSHIP_NAV_ORDER } from 'store/constants'

export function pinGroup (groupId) {
  return {
    type: UPDATE_MEMBERSHIP_NAV_ORDER,
    graphql: {
      query: `
        mutation UpdateMembershipNavOrder ($groupId: ID, $navOrder: Int) {
          updateMembership(groupId: $groupId, data: { navOrder: $navOrder }) {
            id
            navOrder
            group {
              id
            }
          }
        }
      `,
      variables: {
        groupId,
        navOrder: 0 // Pin to top
      }
    },
    meta: {
      groupId,
      navOrder: 0,
      optimistic: true
    }
  }
}

export function unpinGroup (groupId) {
  return {
    type: UPDATE_MEMBERSHIP_NAV_ORDER,
    graphql: {
      query: `
        mutation UpdateMembershipNavOrder ($groupId: ID, $navOrder: Int) {
          updateMembership(groupId: $groupId, data: { navOrder: $navOrder }) {
            id
            navOrder
            group {
              id
            }
          }
        }
      `,
      variables: {
        groupId,
        navOrder: null // Unpin
      }
    },
    meta: {
      groupId,
      navOrder: null,
      optimistic: true
    }
  }
}

export function updateGroupNavOrder (groupId, navOrder) {
  return {
    type: UPDATE_MEMBERSHIP_NAV_ORDER,
    graphql: {
      query: `
        mutation UpdateMembershipNavOrder ($groupId: ID, $navOrder: Int) {
          updateMembership(groupId: $groupId, data: { navOrder: $navOrder }) {
            id
            navOrder
            group {
              id
            }
          }
        }
      `,
      variables: {
        groupId,
        navOrder
      }
    },
    meta: {
      groupId,
      navOrder,
      optimistic: true
    }
  }
}
