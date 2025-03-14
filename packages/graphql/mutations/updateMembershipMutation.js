import { gql } from 'urql'
import membershipFieldsFragment from '../fragments/membershipFieldsFragment'

export default gql`
  mutation UpdateMembershipMutation ($groupId: ID, $data: MembershipInput) {
    updateMembership(groupId: $groupId, data: $data) {
      ...MembershipFieldsFragment
    }
  }
  ${membershipFieldsFragment}
`
