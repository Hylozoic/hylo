import { gql } from 'urql'
import membershipFieldsFragment from '../fragments/membershipFieldsFragment'

export default gql`
  mutation UpdateMembershipNavOrderMutation ($groupId: ID, $navOrder: Int) {
    updateMembership(groupId: $groupId, data: { navOrder: $navOrder }) {
      ...MembershipFieldsFragment
    }
  }
  ${membershipFieldsFragment}
`
