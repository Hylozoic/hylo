import { RESET_NEW_POST_COUNT } from 'store/constants'

export default function resetNewPostCount (id, type, count = 0) {
  if (type !== 'Membership') {
    throw new Error(`bad type for resetNewPostCount: ${type}`)
  }

  return {
    type: RESET_NEW_POST_COUNT,
    graphql: {
      query: MembershipQuery,
      variables: {
        id,
        data: {
          newPostCount: count
        }
      }
    },
    meta: { id, type, count, optimistic: true }
  }
}

const MembershipQuery = `mutation($id: ID, $data: MembershipInput) {
    updateMembership(groupId: $id, data: $data) {
      id
    }
  }`
