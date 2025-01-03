import { gql } from 'urql'

const resetNotificationsCountMutation = gql`
  mutation ResetNotificationsCountMutation {
    updateMe(changes: { newNotificationCount: 0 }) {
      id
      newNotificationCount
    }
  }
`

export default resetNotificationsCountMutation
