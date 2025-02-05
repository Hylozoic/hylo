import { gql } from 'urql'
import notificationFieldsFragment from '../fragments/notificationFieldsFragment'

export default gql`
  query NotificationsQuery ($first: Int = 20, $offset: Int = 0) {
    notifications (first: $first, offset: $offset, order: "desc") {
      total
      hasMore
      items {
        ...NotificationFieldsFragment
      }
    }
  }
  ${notificationFieldsFragment}
`
