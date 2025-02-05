import meAuthFieldsFragment from '../fragments/meAuthFieldsFragment'
import { gql } from 'urql'

export const updateUserSettingsMutation = gql`
  mutation UpdateUserSettingsMutation ($changes: MeInput) {
    updateMe(changes: $changes) {
      ...MeAuthFieldsFragment
    }
  },
  ${meAuthFieldsFragment}
`

export default updateUserSettingsMutation
